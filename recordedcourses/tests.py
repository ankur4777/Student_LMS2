import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import User
from institutions.models import Organization
from recordedcourses.models import RecordedCourse, RecordedLesson


class CollegeAdminRecordedCourseAPITests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="College A", code="CA")
        self.org_b = Organization.objects.create(name="College B", code="CB")

        self.admin_a = User.objects.create_user(
            username="admin_a", password="pass12345", role="college_admin", organization=self.org_a
        )
        self.admin_b = User.objects.create_user(
            username="admin_b", password="pass12345", role="college_admin", organization=self.org_b
        )
        self.student = User.objects.create_user(
            username="student_a", password="pass12345", role="student", organization=self.org_a
        )
        self.parent = User.objects.create_user(
            username="parent_a", password="pass12345", role="parent", organization=self.org_a
        )
        self.teacher = User.objects.create_user(
            username="teacher_a", password="pass12345", role="teacher", organization=self.org_a
        )

        self.course_a = RecordedCourse.objects.create(
            organization=self.org_a, title="Python", price="4999.00", access_duration_days=180
        )
        self.course_b = RecordedCourse.objects.create(
            organization=self.org_b, title="Data Science", price="6999.00", access_duration_days=180
        )

        self.list_url = "/api/recorded-courses/college-admin/courses/"

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_college_admin_lists_only_own_organization_courses(self):
        self.authenticate(self.admin_a)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.data["courses"]]
        self.assertIn(self.course_a.id, ids)
        self.assertNotIn(self.course_b.id, ids)

    def test_college_admin_can_create_course_only_in_own_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.post(
            self.list_url,
            {"title": "Django", "description": "Backend course", "price": "3999.00", "access_duration_days": 90},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        created = RecordedCourse.objects.get(id=response.data["course"]["id"])
        self.assertEqual(created.organization, self.org_a)

    def test_cross_organization_course_id_tampering_returns_not_found(self):
        self.authenticate(self.admin_a)
        url = f"/api/recorded-courses/college-admin/courses/{self.course_b.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {"title": "Hacked"}, format="json").status_code, 404)
        self.course_b.refresh_from_db()
        self.assertEqual(self.course_b.title, "Data Science")

    def test_non_college_admin_roles_cannot_use_course_collection(self):
        for user in (self.student, self.parent, self.teacher):
            self.authenticate(user)
            self.assertEqual(self.client.get(self.list_url).status_code, 403)
            self.assertEqual(
                self.client.post(
                    self.list_url, {"title": "No", "price": "1.00", "access_duration_days": 30}, format="json"
                ).status_code,
                403,
            )

    def test_unauthenticated_course_request_is_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.list_url).status_code, 401)

    def test_invalid_price_and_duration_are_rejected(self):
        self.authenticate(self.admin_a)
        response = self.client.post(
            self.list_url, {"title": "Invalid", "price": "-1", "access_duration_days": 0}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(RecordedCourse.objects.filter(organization=self.org_a, title="Invalid").exists())


@override_settings(PRIVATE_MEDIA_ROOT=Path(tempfile.gettempdir()) / "lms-recordedcourses-tests")
class CollegeAdminRecordedLessonAPITests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="College A", code="LCA")
        self.org_b = Organization.objects.create(name="College B", code="LCB")
        self.admin_a = User.objects.create_user(
            username="lesson_admin_a", password="pass12345", role="college_admin", organization=self.org_a
        )
        self.admin_b = User.objects.create_user(
            username="lesson_admin_b", password="pass12345", role="college_admin", organization=self.org_b
        )
        self.student = User.objects.create_user(
            username="lesson_student", password="pass12345", role="student", organization=self.org_a
        )
        self.course_a = RecordedCourse.objects.create(
            organization=self.org_a, title="Course A", price="1000.00", access_duration_days=60
        )
        self.course_b = RecordedCourse.objects.create(
            organization=self.org_b, title="Course B", price="1000.00", access_duration_days=60
        )

    def video(self, name="lesson.mp4"):
        return SimpleUploadedFile(name, b"fake-video-content", content_type="video/mp4")

    def test_college_admin_can_upload_lesson_to_own_course(self):
        self.client.force_authenticate(user=self.admin_a)
        url = f"/api/recorded-courses/college-admin/courses/{self.course_a.id}/lessons/"
        response = self.client.post(
            url, {"title": "Lesson 1", "position": "1", "video": self.video()}, format="multipart"
        )
        self.assertEqual(response.status_code, 201)
        lesson = RecordedLesson.objects.get(id=response.data["lesson"]["id"])
        self.assertEqual(lesson.course.organization, self.org_a)

    def test_cross_organization_course_cannot_receive_lesson(self):
        self.client.force_authenticate(user=self.admin_a)
        url = f"/api/recorded-courses/college-admin/courses/{self.course_b.id}/lessons/"
        response = self.client.post(
            url, {"title": "Injected", "position": "1", "video": self.video()}, format="multipart"
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(RecordedLesson.objects.filter(course=self.course_b, title="Injected").exists())

    def test_cross_organization_lesson_id_tampering_returns_not_found(self):
        lesson_b = RecordedLesson.objects.create(
            course=self.course_b, title="Private B", position=1, video=self.video("private-b.mp4")
        )
        self.client.force_authenticate(user=self.admin_a)
        url = f"/api/recorded-courses/college-admin/lessons/{lesson_b.id}/"
        response = self.client.patch(url, {"title": "Hacked"}, format="multipart")
        self.assertEqual(response.status_code, 404)
        lesson_b.refresh_from_db()
        self.assertEqual(lesson_b.title, "Private B")

    def test_duplicate_lesson_position_is_rejected(self):
        RecordedLesson.objects.create(
            course=self.course_a, title="Existing", position=1, video=self.video("existing.mp4")
        )
        self.client.force_authenticate(user=self.admin_a)
        url = f"/api/recorded-courses/college-admin/courses/{self.course_a.id}/lessons/"
        response = self.client.post(
            url, {"title": "Duplicate", "position": "1", "video": self.video("duplicate.mp4")}, format="multipart"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(RecordedLesson.objects.filter(course=self.course_a, title="Duplicate").exists())

    def test_student_cannot_upload_lesson(self):
        self.client.force_authenticate(user=self.student)
        url = f"/api/recorded-courses/college-admin/courses/{self.course_a.id}/lessons/"
        response = self.client.post(
            url, {"title": "No Access", "position": "1", "video": self.video()}, format="multipart"
        )
        self.assertEqual(response.status_code, 403)
