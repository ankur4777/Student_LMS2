"""Phase 24: real encoded MP4 upload and private lesson playback regression.

Unlike the full API journey, this test does not mock ffprobe. A disposable
H.264 MP4 is generated locally with FFmpeg, uploaded through the actual
College Admin endpoint, and served through the student-only playback route.

Video decoding, HTML <video> events, and real-time watch milestones still need
manual browser acceptance checks. No real user, external URL or VPS is used.
"""
import shutil
import subprocess
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITransactionTestCase

from accounts.models import StudentProfile, User
from institutions.models import Organization
from recordedcourses.models import (
    CourseModule, OrganizationLearningSettings, RecordedCourse,
    RecordedCourseAccess, RecordedLesson,
)


ROOT = "/api/recorded-courses/"


class RealVideoPlaybackAPITests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="P24 Real Media QA", code="P24-REAL")
        self.other_org = Organization.objects.create(name="P24 Other Tenant", code="P24-OTHER")
        self.admin = User.objects.create_user(
            username="p24-admin", password="local-test", role="college_admin",
            organization=self.org,
        )
        self.student_user = User.objects.create_user(
            username="p24-student", password="local-test", role="student",
            organization=self.org,
        )
        self.unenrolled_user = User.objects.create_user(
            username="p24-unenrolled", password="local-test", role="student",
            organization=self.org,
        )
        self.other_user = User.objects.create_user(
            username="p24-cross-tenant", password="local-test", role="student",
            organization=self.other_org,
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="P24-S",
        )
        StudentProfile.objects.create(
            user=self.unenrolled_user, admission_number="P24-NO",
        )
        StudentProfile.objects.create(
            user=self.other_user, admission_number="P24-CROSS",
        )
        self.course = RecordedCourse.objects.create(
            organization=self.org, title="Local H264 Playback QA",
            price=Decimal("0.00"),
        )
        self.module = CourseModule.objects.create(
            course=self.course, title="Actual MP4", position=1, is_published=True,
        )
        OrganizationLearningSettings.objects.create(organization=self.org, is_enabled=True)
        OrganizationLearningSettings.objects.create(organization=self.other_org, is_enabled=True)
        feature_patch = patch(
            "recordedcourses.learning_access.student_feature_is_enabled",
            return_value=True,
        )
        feature_patch.start()
        self.addCleanup(feature_patch.stop)

    def test_real_h264_upload_verified_duration_and_private_stream(self):
        # These binaries are installed in feature CI. Fail explicitly on a
        # developer laptop rather than silently marking real-media coverage OK.
        for binary in ("ffmpeg", "ffprobe"):
            self.assertIsNotNone(
                shutil.which(binary),
                f"{binary} is required for this real-MP4 test. Install FFmpeg and add its bin folder to PATH.",
            )

        with TemporaryDirectory(prefix="mysls-phase24-") as folder:
            temp = Path(folder)
            clip_path = temp / "phase24.mp4"
            result = subprocess.run(
                [
                    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                    "-y", "-f", "lavfi", "-i",
                    "color=c=black:s=160x90:r=12",
                    "-t", "3", "-an", "-c:v", "libx264",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(clip_path),
                ],
                capture_output=True, text=True, timeout=40, check=False,
            )
            self.assertEqual(
                result.returncode, 0,
                "FFmpeg could not generate the local H.264 QA clip: " + result.stderr[-700:],
            )
            video_bytes = clip_path.read_bytes()
            self.assertGreater(len(video_bytes), 500)
            self.assertEqual(video_bytes[4:8], b"ftyp")

            # Override *only* lesson file storage; all files are deleted at
            # the end of this test. Other models and storage remain untouched.
            field = RecordedLesson._meta.get_field("video")
            original_storage = field.storage
            field.storage = FileSystemStorage(location=str(temp / "private-media"))
            try:
                self.client.force_authenticate(user=self.admin)
                created = self.client.post(
                    ROOT + f"learning/manage/modules/{self.module.pk}/lessons/",
                    {
                        "title": "Real H264 lecture",
                        "video": SimpleUploadedFile(
                            "phase24.mp4", video_bytes, content_type="video/mp4",
                        ),
                    },
                    format="multipart",
                )
                self.assertEqual(created.status_code, 201, getattr(created, "data", None))
                lesson = RecordedLesson.objects.get(pk=created.data["lesson"]["id"])
                self.assertIsNotNone(lesson.duration_verified_at)
                self.assertAlmostEqual(lesson.verified_duration_seconds, 3.0, delta=0.2)

                # Neither the private absolute media path nor a public video
                # URL should be returned in the lesson authoring payload.
                self.assertNotIn("video_url", created.data["lesson"])
                self.assertNotIn("private-media", str(created.data["lesson"]))

                playback_url = ROOT + f"learning/student/lessons/{lesson.pk}/play/"
                session_url = ROOT + f"learning/student/lessons/{lesson.pk}/viewing-session/"
                heartbeat_url = ROOT + f"learning/student/lessons/{lesson.pk}/heartbeat/"
                complete_url = ROOT + f"learning/student/lessons/{lesson.pk}/complete/"

                # A logged-in student of the same college still needs an
                # active enrollment to access the private lesson bytes.
                self.client.force_authenticate(user=self.unenrolled_user)
                self.assertEqual(self.client.get(playback_url).status_code, 403)
                self.client.force_authenticate(user=self.other_user)
                self.assertEqual(self.client.get(playback_url).status_code, 404)
                self.client.force_authenticate(user=None)
                self.assertIn(self.client.get(playback_url).status_code, (401, 403))

                RecordedCourseAccess.objects.create(
                    organization=self.org, course=self.course, student=self.student,
                )
                self.client.force_authenticate(user=self.student_user)
                playback = self.client.get(playback_url)
                self.assertEqual(playback.status_code, 200)
                self.assertTrue(playback.streaming)
                self.assertTrue(playback["Content-Type"].startswith("video/mp4"))
                self.assertEqual(playback["Cache-Control"], "private, no-store")
                self.assertEqual(playback["X-Content-Type-Options"], "nosniff")
                self.assertNotIn("phase24.mp4", playback["Content-Disposition"])
                try:
                    returned_video = b"".join(playback.streaming_content)
                finally:
                    playback.close()
                self.assertEqual(returned_video, video_bytes)

                ticket = self.client.post(session_url)
                self.assertEqual(ticket.status_code, 200, getattr(ticket, "data", None))
                self.assertAlmostEqual(
                    ticket.data["verified_duration_seconds"], 3.0, delta=0.2,
                )
                # Neither an immediate completion nor a claimed 60-second
                # duration for a server-verified 3-second file may earn credit.
                self.assertEqual(self.client.post(
                    complete_url,
                    {"playback_ticket": ticket.data["ticket"]},
                    format="json",
                ).status_code, 400)
                self.assertEqual(self.client.post(
                    heartbeat_url,
                    {
                        "playback_ticket": ticket.data["ticket"],
                        "position_seconds": 2, "duration_seconds": 60,
                    },
                    format="json",
                ).status_code, 400)

                # Feature OFF must block fresh private streaming, without
                # changing old purchased-course/recording routes.
                OrganizationLearningSettings.objects.filter(
                    organization=self.org,
                ).update(is_enabled=False)
                self.assertEqual(self.client.get(playback_url).status_code, 403)
            finally:
                field.storage = original_storage
