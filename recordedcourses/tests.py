from datetime import time, timedelta
from decimal import Decimal
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import (
    ParentProfile,
    StudentProfile,
    TeacherProfile,
    User,
)
from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from institutions.models import Organization
from liveclasses.models import LiveClass, LiveClassRecording
from recordedcourses.models import (
    RecordedClassAccess,
    RecordedClassPurchase,
    RecordedCourse,
    RecordedCourseAccess,
    RecordedCoursePurchase,
    RecordedLesson,
)


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



class RecordedCoursePurchaseAccessSecurityTests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="Purchase College A", code="PCA")
        self.org_b = Organization.objects.create(name="Purchase College B", code="PCB")

        self.admin_a = User.objects.create_user(
            username="purchase_admin_a", password="pass12345", role="college_admin", organization=self.org_a
        )
        self.admin_b = User.objects.create_user(
            username="purchase_admin_b", password="pass12345", role="college_admin", organization=self.org_b
        )
        self.student_user_a = User.objects.create_user(
            username="purchase_student_a", password="pass12345", role="student", organization=self.org_a
        )
        self.student_a = StudentProfile.objects.create(
            user=self.student_user_a, admission_number="PCA001"
        )
        self.other_student_user_a = User.objects.create_user(
            username="purchase_student_other", password="pass12345", role="student", organization=self.org_a
        )
        self.other_student_a = StudentProfile.objects.create(
            user=self.other_student_user_a, admission_number="PCA002"
        )
        self.student_user_b = User.objects.create_user(
            username="purchase_student_b", password="pass12345", role="student", organization=self.org_b
        )
        self.student_b = StudentProfile.objects.create(
            user=self.student_user_b, admission_number="PCB001"
        )
        self.parent_user_a = User.objects.create_user(
            username="purchase_parent_a", password="pass12345", role="parent", organization=self.org_a
        )
        self.parent_a = ParentProfile.objects.create(user=self.parent_user_a)
        ParentStudent.objects.create(parent=self.parent_a, student=self.student_a, relationship="guardian")
        self.teacher_a = User.objects.create_user(
            username="purchase_teacher_a", password="pass12345", role="teacher", organization=self.org_a
        )

        self.course_a = RecordedCourse.objects.create(
            organization=self.org_a, title="Purchase Python", price="2500.00", access_duration_days=90
        )
        self.inactive_course_a = RecordedCourse.objects.create(
            organization=self.org_a, title="Hidden Course", price="1000.00", access_duration_days=30, is_active=False
        )
        self.course_b = RecordedCourse.objects.create(
            organization=self.org_b, title="Purchase Data", price="3500.00", access_duration_days=90
        )

    def test_student_catalog_contains_only_active_same_org_courses(self):
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get("/api/recorded-courses/student/catalog/")
        self.assertEqual(response.status_code, 200)
        ids = [course["id"] for course in response.data["courses"]]
        self.assertIn(self.course_a.id, ids)
        self.assertNotIn(self.inactive_course_a.id, ids)
        self.assertNotIn(self.course_b.id, ids)

    def test_student_purchase_uses_authenticated_student_and_server_price(self):
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.post(
            "/api/recorded-courses/student/purchases/",
            {"course_id": self.course_a.id, "student_id": self.other_student_a.id, "amount": "1.00", "status": "paid"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        purchase = RecordedCoursePurchase.objects.get(id=response.data["purchase"]["id"])
        self.assertEqual(purchase.student, self.student_a)
        self.assertEqual(purchase.purchased_by_student, self.student_a)
        self.assertEqual(purchase.amount, Decimal("2500.00"))
        self.assertEqual(purchase.status, RecordedCoursePurchase.Status.PENDING)
        self.assertFalse(RecordedCourseAccess.objects.filter(purchase=purchase).exists())

    def test_student_cannot_purchase_cross_org_or_inactive_course(self):
        self.client.force_authenticate(user=self.student_user_a)
        cross = self.client.post(
            "/api/recorded-courses/student/purchases/", {"course_id": self.course_b.id}, format="json"
        )
        inactive = self.client.post(
            "/api/recorded-courses/student/purchases/", {"course_id": self.inactive_course_a.id}, format="json"
        )
        self.assertEqual(cross.status_code, 404)
        self.assertEqual(inactive.status_code, 404)

    def test_parent_catalog_returns_only_linked_same_org_child(self):
        self.client.force_authenticate(user=self.parent_user_a)
        response = self.client.get("/api/recorded-courses/parent/catalog/")
        self.assertEqual(response.status_code, 200)
        child_ids = [child["id"] for child in response.data["children"]]
        self.assertEqual(child_ids, [self.student_a.id])
        course_ids = [course["id"] for course in response.data["courses"]]
        self.assertIn(self.course_a.id, course_ids)
        self.assertNotIn(self.course_b.id, course_ids)

    def test_parent_can_purchase_only_for_linked_child(self):
        self.client.force_authenticate(user=self.parent_user_a)
        allowed = self.client.post(
            "/api/recorded-courses/parent/purchases/",
            {"course_id": self.course_a.id, "student_id": self.student_a.id, "amount": "1.00", "status": "paid"},
            format="json",
        )
        self.assertEqual(allowed.status_code, 201)
        purchase = RecordedCoursePurchase.objects.get(id=allowed.data["purchase"]["id"])
        self.assertEqual(purchase.student, self.student_a)
        self.assertEqual(purchase.purchased_by_parent, self.parent_a)
        self.assertEqual(purchase.amount, Decimal("2500.00"))
        self.assertEqual(purchase.status, RecordedCoursePurchase.Status.PENDING)

        blocked = self.client.post(
            "/api/recorded-courses/parent/purchases/",
            {"course_id": self.course_a.id, "student_id": self.other_student_a.id},
            format="json",
        )
        self.assertEqual(blocked.status_code, 403)

        cross_org = self.client.post(
            "/api/recorded-courses/parent/purchases/",
            {"course_id": self.course_a.id, "student_id": self.student_b.id},
            format="json",
        )
        self.assertEqual(cross_org.status_code, 403)

    def test_wrong_roles_and_anonymous_are_rejected(self):
        self.client.force_authenticate(user=self.teacher_a)
        self.assertEqual(self.client.get("/api/recorded-courses/student/catalog/").status_code, 403)
        self.assertEqual(self.client.get("/api/recorded-courses/parent/catalog/").status_code, 403)
        self.assertEqual(self.client.get("/api/recorded-courses/college-admin/purchases/").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/recorded-courses/student/catalog/").status_code, 401)
        self.assertEqual(self.client.get("/api/recorded-courses/parent/catalog/").status_code, 401)

    def test_college_admin_lists_only_own_org_purchases(self):
        own = RecordedCoursePurchase.objects.create(
            organization=self.org_a,
            course=self.course_a,
            student=self.student_a,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.course_a.price,
        )
        other = RecordedCoursePurchase.objects.create(
            organization=self.org_b,
            course=self.course_b,
            student=self.student_b,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_b,
            amount=self.course_b.price,
        )
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/recorded-courses/college-admin/purchases/")
        self.assertEqual(response.status_code, 200)
        ids = [purchase["id"] for purchase in response.data["purchases"]]
        self.assertIn(own.id, ids)
        self.assertNotIn(other.id, ids)

    def test_cross_org_admin_cannot_verify_purchase(self):
        purchase = RecordedCoursePurchase.objects.create(
            organization=self.org_a,
            course=self.course_a,
            student=self.student_a,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.course_a.price,
        )
        self.client.force_authenticate(user=self.admin_b)
        response = self.client.post(
            f"/api/recorded-courses/college-admin/purchases/{purchase.id}/verify/",
            {"payment_method": "cash", "payment_reference": "NOPE"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, RecordedCoursePurchase.Status.PENDING)
        self.assertFalse(RecordedCourseAccess.objects.filter(purchase=purchase).exists())

    def test_verification_marks_paid_and_grants_correct_access(self):
        purchase = RecordedCoursePurchase.objects.create(
            organization=self.org_a,
            course=self.course_a,
            student=self.student_a,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.course_a.price,
        )
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            f"/api/recorded-courses/college-admin/purchases/{purchase.id}/verify/",
            {"payment_method": "cash", "payment_reference": "RC-1001"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, RecordedCoursePurchase.Status.PAID)
        self.assertEqual(purchase.payment_method, "cash")
        access = RecordedCourseAccess.objects.get(purchase=purchase)
        self.assertEqual(access.organization, self.org_a)
        self.assertEqual(access.course, self.course_a)
        self.assertEqual(access.student, self.student_a)
        self.assertTrue(access.has_access)
        self.assertIsNotNone(access.expires_at)

    def test_student_cannot_verify_own_purchase(self):
        purchase = RecordedCoursePurchase.objects.create(
            organization=self.org_a,
            course=self.course_a,
            student=self.student_a,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.course_a.price,
        )
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.post(
            f"/api/recorded-courses/college-admin/purchases/{purchase.id}/verify/",
            {"payment_method": "cash"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, RecordedCoursePurchase.Status.PENDING)



class RecordedCoursePlaybackSecurityTests(RecordedCoursePurchaseAccessSecurityTests):
    def setUp(self):
        super().setUp()
        self.lesson_a = RecordedLesson.objects.create(
            course=self.course_a,
            title="Secure Lesson A",
            position=1,
            video=SimpleUploadedFile("secure-a.mp4", b"secure-video-a", content_type="video/mp4"),
        )
        self.lesson_b = RecordedLesson.objects.create(
            course=self.course_b,
            title="Secure Lesson B",
            position=1,
            video=SimpleUploadedFile("secure-b.mp4", b"secure-video-b", content_type="video/mp4"),
        )

    def grant_access(self, student=None, course=None, **overrides):
        student = student or self.student_a
        course = course or self.course_a
        defaults = {
            "organization": course.organization,
            "course": course,
            "student": student,
            "starts_at": timezone.now() - timedelta(minutes=1),
            "expires_at": timezone.now() + timedelta(days=30),
            "is_active": True,
        }
        defaults.update(overrides)
        return RecordedCourseAccess.objects.create(**defaults)

    def test_valid_student_can_list_purchased_course_without_private_video_path(self):
        self.grant_access()
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get("/api/recorded-courses/student/my-courses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["courses"]), 1)
        payload = response.data["courses"][0]
        self.assertEqual(payload["id"], self.course_a.id)
        self.assertEqual(payload["lessons"][0]["id"], self.lesson_a.id)
        self.assertNotIn("video", payload["lessons"][0])
        self.assertNotIn("video_url", payload["lessons"][0])
        self.assertNotIn("purchased_recorded_courses", str(response.data))

    def test_valid_student_can_open_course_and_stream_lesson(self):
        self.grant_access()
        self.client.force_authenticate(user=self.student_user_a)
        detail = self.client.get(f"/api/recorded-courses/student/my-courses/{self.course_a.id}/")
        self.assertEqual(detail.status_code, 200)
        playback = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(playback.status_code, 200)
        self.assertEqual(playback["Content-Type"], "video/mp4")
        self.assertEqual(playback["Cache-Control"], "private, no-store")
        self.assertNotIn("purchased_recorded_courses", playback.get("Content-Disposition", ""))

    def test_student_without_access_is_blocked(self):
        self.client.force_authenticate(user=self.student_user_a)
        detail = self.client.get(f"/api/recorded-courses/student/my-courses/{self.course_a.id}/")
        playback = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(detail.status_code, 403)
        self.assertEqual(playback.status_code, 403)

    def test_pending_purchase_does_not_grant_playback(self):
        RecordedCoursePurchase.objects.create(
            organization=self.org_a,
            course=self.course_a,
            student=self.student_a,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.course_a.price,
            status=RecordedCoursePurchase.Status.PENDING,
        )
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(response.status_code, 403)

    def test_expired_access_is_blocked(self):
        self.grant_access(expires_at=timezone.now() - timedelta(seconds=1))
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(response.status_code, 403)

    def test_revoked_access_is_blocked(self):
        self.grant_access(revoked_at=timezone.now())
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(response.status_code, 403)

    def test_other_same_org_student_cannot_use_another_students_access(self):
        self.grant_access()
        self.client.force_authenticate(user=self.other_student_user_a)
        response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(response.status_code, 403)

    def test_cross_org_lesson_id_tampering_is_blocked(self):
        self.grant_access()
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_b.id}/play/")
        self.assertEqual(response.status_code, 404)

    def test_inactive_lesson_and_inactive_course_are_blocked(self):
        self.grant_access()
        self.lesson_a.is_active = False
        self.lesson_a.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.student_user_a)
        lesson_response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(lesson_response.status_code, 404)

        self.lesson_a.is_active = True
        self.lesson_a.save(update_fields=["is_active"])
        self.course_a.is_active = False
        self.course_a.save(update_fields=["is_active"])
        course_response = self.client.get(f"/api/recorded-courses/student/my-courses/{self.course_a.id}/")
        playback_response = self.client.get(f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/")
        self.assertEqual(course_response.status_code, 403)
        self.assertEqual(playback_response.status_code, 404)

    def test_parent_teacher_admin_and_anonymous_cannot_use_student_playback(self):
        url = f"/api/recorded-courses/student/lessons/{self.lesson_a.id}/play/"
        self.grant_access()
        for user in (self.parent_user_a, self.teacher_a, self.admin_a):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(url).status_code, 401)



@override_settings(
    PRIVATE_MEDIA_ROOT=Path(tempfile.gettempdir()) / "lms-recorded-class-tests"
)
class RecordedClassPurchaseAccessSecurityTests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(
            name="Recorded Class College A",
            code="RCCA",
        )
        self.org_b = Organization.objects.create(
            name="Recorded Class College B",
            code="RCCB",
        )

        self.admin_a = User.objects.create_user(
            username="recording_admin_a",
            password="pass12345",
            role="college_admin",
            organization=self.org_a,
        )
        self.admin_b = User.objects.create_user(
            username="recording_admin_b",
            password="pass12345",
            role="college_admin",
            organization=self.org_b,
        )

        self.teacher_user_a = User.objects.create_user(
            username="recording_teacher_a",
            password="pass12345",
            role="teacher",
            organization=self.org_a,
        )
        self.teacher_a = TeacherProfile.objects.create(
            user=self.teacher_user_a,
            employee_id="RCT-A",
        )
        self.teacher_user_b = User.objects.create_user(
            username="recording_teacher_b",
            password="pass12345",
            role="teacher",
            organization=self.org_b,
        )
        self.teacher_b = TeacherProfile.objects.create(
            user=self.teacher_user_b,
            employee_id="RCT-B",
        )

        self.student_user_a = User.objects.create_user(
            username="recording_student_a",
            password="pass12345",
            role="student",
            organization=self.org_a,
        )
        self.student_a = StudentProfile.objects.create(
            user=self.student_user_a,
            admission_number="RCS-A",
        )
        self.student_user_b = User.objects.create_user(
            username="recording_student_b",
            password="pass12345",
            role="student",
            organization=self.org_b,
        )
        self.student_b = StudentProfile.objects.create(
            user=self.student_user_b,
            admission_number="RCS-B",
        )

        self.session_a = AcademicSession.objects.create(
            organization=self.org_a,
            name="2026-A",
            start_date=timezone.localdate() - timedelta(days=60),
            end_date=timezone.localdate() + timedelta(days=300),
            is_active=True,
        )
        self.classroom_a = ClassRoom.objects.create(
            organization=self.org_a,
            name="Class A",
            academic_session=self.session_a,
        )
        self.section_a = Section.objects.create(
            organization=self.org_a,
            name="A",
            classroom=self.classroom_a,
        )
        self.subject_a = Subject.objects.create(
            organization=self.org_a,
            name="Mathematics",
            code="MATH-RC",
            classroom=self.classroom_a,
        )
        self.assignment_a = TeacherAssignment.objects.create(
            teacher=self.teacher_a,
            subject=self.subject_a,
            section=self.section_a,
            is_active=True,
        )
        self.enrollment_a = StudentEnrollment.objects.create(
            student=self.student_a,
            section=self.section_a,
            roll_number="RCA-001",
            is_active=True,
        )

        self.session_b = AcademicSession.objects.create(
            organization=self.org_b,
            name="2026-B",
            start_date=timezone.localdate() - timedelta(days=60),
            end_date=timezone.localdate() + timedelta(days=300),
            is_active=True,
        )
        self.classroom_b = ClassRoom.objects.create(
            organization=self.org_b,
            name="Class B",
            academic_session=self.session_b,
        )
        self.section_b = Section.objects.create(
            organization=self.org_b,
            name="B",
            classroom=self.classroom_b,
        )
        self.subject_b = Subject.objects.create(
            organization=self.org_b,
            name="Science",
            code="SCI-RC",
            classroom=self.classroom_b,
        )
        self.assignment_b = TeacherAssignment.objects.create(
            teacher=self.teacher_b,
            subject=self.subject_b,
            section=self.section_b,
            is_active=True,
        )
        StudentEnrollment.objects.create(
            student=self.student_b,
            section=self.section_b,
            roll_number="RCB-001",
            is_active=True,
        )

        self.live_class_a = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="Paid Mathematics Recording",
            class_date=timezone.localdate() - timedelta(days=1),
            start_time=time(10, 0),
            end_time=time(11, 0),
            status=LiveClass.Status.COMPLETED,
        )
        self.recording_a = LiveClassRecording.objects.create(
            live_class=self.live_class_a,
            uploaded_by=self.teacher_a,
            title="Paid Mathematics Recording",
            video=self.video("paid-math.mp4"),
            is_available=True,
            price=Decimal("1200.00"),
            access_duration_days=30,
        )

        self.live_class_b = LiveClass.objects.create(
            organization=self.org_b,
            teacher_assignment=self.assignment_b,
            title="Other College Recording",
            class_date=timezone.localdate() - timedelta(days=1),
            start_time=time(12, 0),
            end_time=time(13, 0),
            status=LiveClass.Status.COMPLETED,
        )
        self.recording_b = LiveClassRecording.objects.create(
            live_class=self.live_class_b,
            uploaded_by=self.teacher_b,
            title="Other College Recording",
            video=self.video("other-college.mp4"),
            is_available=True,
            price=Decimal("1500.00"),
            access_duration_days=30,
        )

    def video(self, name):
        return SimpleUploadedFile(
            name,
            b"recorded-class-video",
            content_type="video/mp4",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_student_purchase(self):
        self.authenticate(self.student_user_a)
        return self.client.post(
            "/api/recorded-courses/student/recorded-class-purchases/",
            {
                "recording_public_id": str(self.recording_a.public_id),
                "amount": "1.00",
                "status": "paid",
            },
            format="json",
        )

    def test_admin_can_configure_own_recording_purchase_settings(self):
        self.authenticate(self.admin_a)

        response = self.client.patch(
            (
                "/api/recorded-courses/college-admin/recorded-classes/"
                f"{self.recording_a.public_id}/purchase-settings/"
            ),
            {
                "price": "999.00",
                "access_duration_days": 45,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.recording_a.refresh_from_db()
        self.assertEqual(self.recording_a.price, Decimal("999.00"))
        self.assertEqual(self.recording_a.access_duration_days, 45)

        cross_org = self.client.patch(
            (
                "/api/recorded-courses/college-admin/recorded-classes/"
                f"{self.recording_b.public_id}/purchase-settings/"
            ),
            {"price": "1.00"},
            format="json",
        )
        self.assertEqual(cross_org.status_code, 404)

    def test_recorded_class_list_hides_playback_until_access_is_granted(self):
        self.authenticate(self.student_user_a)

        before = self.client.get(
            "/api/live-classes/student/recorded/"
        )

        self.assertEqual(before.status_code, 200)
        item = next(
            row for row in before.data
            if str(row["recording_public_id"]) == str(
                self.recording_a.public_id
            )
        )
        self.assertEqual(item["recording_price"], Decimal("1200.00"))
        self.assertTrue(item["recording_price_configured"])
        self.assertFalse(item["recording_has_access"])
        self.assertIsNone(item["recording_playback_url"])

        purchase_response = self.create_student_purchase()
        purchase_id = purchase_response.data["purchase"]["id"]

        self.authenticate(self.admin_a)
        verify_response = self.client.post(
            (
                "/api/recorded-courses/college-admin/"
                f"recorded-class-purchases/{purchase_id}/verify/"
            ),
            {"payment_method": "cash"},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)

        self.authenticate(self.student_user_a)
        after = self.client.get(
            "/api/live-classes/student/recorded/"
        )
        item = next(
            row for row in after.data
            if str(row["recording_public_id"]) == str(
                self.recording_a.public_id
            )
        )
        self.assertTrue(item["recording_has_access"])
        self.assertIsNotNone(item["recording_access_expires_at"])
        self.assertEqual(
            item["recording_playback_url"],
            (
                "/api/live-classes/student/recordings/"
                f"{self.recording_a.public_id}/play/"
            ),
        )

    def test_unpriced_recording_cannot_be_purchased(self):
        self.recording_a.price = None
        self.recording_a.save(update_fields=["price", "updated_at"])
        self.authenticate(self.student_user_a)

        response = self.client.post(
            "/api/recorded-courses/student/recorded-class-purchases/",
            {
                "recording_public_id": str(self.recording_a.public_id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "college admin must set a price",
            str(response.data["detail"]).lower(),
        )
        self.assertFalse(RecordedClassPurchase.objects.exists())

    def test_student_cannot_purchase_cross_organization_recording(self):
        self.authenticate(self.student_user_a)

        response = self.client.post(
            "/api/recorded-courses/student/recorded-class-purchases/",
            {
                "recording_public_id": str(self.recording_b.public_id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(RecordedClassPurchase.objects.exists())

    def test_student_purchase_uses_server_price_and_stays_pending(self):
        response = self.create_student_purchase()

        self.assertEqual(response.status_code, 201)
        purchase = RecordedClassPurchase.objects.get(
            id=response.data["purchase"]["id"]
        )
        self.assertEqual(purchase.student, self.student_a)
        self.assertEqual(
            purchase.purchased_by_student,
            self.student_a,
        )
        self.assertEqual(purchase.amount, Decimal("1200.00"))
        self.assertEqual(
            purchase.status,
            RecordedClassPurchase.Status.PENDING,
        )
        self.assertFalse(
            RecordedClassAccess.objects.filter(
                purchase=purchase
            ).exists()
        )

    def test_duplicate_pending_recorded_class_purchase_is_rejected(self):
        first = self.create_student_purchase()
        second = self.create_student_purchase()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(
            RecordedClassPurchase.objects.filter(
                recording=self.recording_a,
                student=self.student_a,
                status=RecordedClassPurchase.Status.PENDING,
            ).count(),
            1,
        )

    def test_free_recording_grants_access_immediately(self):
        free_live_class = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="Free Revision Recording",
            class_date=timezone.localdate() - timedelta(days=2),
            start_time=time(14, 0),
            end_time=time(15, 0),
            status=LiveClass.Status.COMPLETED,
        )
        free_recording = LiveClassRecording.objects.create(
            live_class=free_live_class,
            uploaded_by=self.teacher_a,
            title="Free Revision Recording",
            video=self.video("free-revision.mp4"),
            is_available=True,
            price=Decimal("0.00"),
            access_duration_days=15,
        )

        self.authenticate(self.student_user_a)
        response = self.client.post(
            "/api/recorded-courses/student/recorded-class-purchases/",
            {
                "recording_public_id": str(free_recording.public_id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        purchase = RecordedClassPurchase.objects.get(
            id=response.data["purchase"]["id"]
        )
        self.assertEqual(
            purchase.status,
            RecordedClassPurchase.Status.PAID,
        )
        access = RecordedClassAccess.objects.get(purchase=purchase)
        self.assertTrue(access.has_access)
        self.assertEqual(access.recording, free_recording)

    def test_admin_verification_grants_recorded_class_access(self):
        purchase_response = self.create_student_purchase()
        purchase_id = purchase_response.data["purchase"]["id"]

        self.authenticate(self.admin_a)
        response = self.client.post(
            (
                "/api/recorded-courses/college-admin/"
                f"recorded-class-purchases/{purchase_id}/verify/"
            ),
            {
                "payment_method": "upi",
                "payment_reference": "UTR-RC-100",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        purchase = RecordedClassPurchase.objects.get(id=purchase_id)
        self.assertEqual(
            purchase.status,
            RecordedClassPurchase.Status.PAID,
        )
        access = RecordedClassAccess.objects.get(purchase=purchase)
        self.assertEqual(access.recording, self.recording_a)
        self.assertEqual(access.student, self.student_a)
        self.assertTrue(access.has_access)
        self.assertIsNotNone(access.expires_at)

    def test_cross_org_admin_cannot_verify_recorded_class_purchase(self):
        purchase_response = self.create_student_purchase()
        purchase_id = purchase_response.data["purchase"]["id"]

        self.authenticate(self.admin_b)
        response = self.client.post(
            (
                "/api/recorded-courses/college-admin/"
                f"recorded-class-purchases/{purchase_id}/verify/"
            ),
            {"payment_method": "cash"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        purchase = RecordedClassPurchase.objects.get(id=purchase_id)
        self.assertEqual(
            purchase.status,
            RecordedClassPurchase.Status.PENDING,
        )
        self.assertFalse(
            RecordedClassAccess.objects.filter(
                purchase=purchase
            ).exists()
        )

    def test_playback_requires_verified_recorded_class_access(self):
        playback_url = (
            "/api/live-classes/student/recordings/"
            f"{self.recording_a.public_id}/play/"
        )

        self.authenticate(self.student_user_a)
        blocked = self.client.get(playback_url)
        self.assertEqual(blocked.status_code, 403)
        self.assertIn(
            "Purchase this recorded class",
            str(blocked.data["detail"]),
        )

        purchase_response = self.create_student_purchase()
        purchase_id = purchase_response.data["purchase"]["id"]
        self.authenticate(self.admin_a)
        verify_response = self.client.post(
            (
                "/api/recorded-courses/college-admin/"
                f"recorded-class-purchases/{purchase_id}/verify/"
            ),
            {"payment_method": "cash"},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)

        self.authenticate(self.student_user_a)
        allowed = self.client.get(playback_url)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed["Content-Type"], "video/mp4")
        self.assertEqual(
            allowed["Cache-Control"],
            "private, no-store",
        )

    def test_expired_or_revoked_recorded_class_access_is_blocked(self):
        paid_purchase = RecordedClassPurchase.objects.create(
            organization=self.org_a,
            recording=self.recording_a,
            student=self.student_a,
            buyer_type=RecordedClassPurchase.BuyerType.STUDENT,
            purchased_by_student=self.student_a,
            amount=self.recording_a.price,
            status=RecordedClassPurchase.Status.PAID,
            payment_method="cash",
            paid_at=timezone.now(),
        )
        access = RecordedClassAccess.objects.create(
            organization=self.org_a,
            recording=self.recording_a,
            student=self.student_a,
            purchase=paid_purchase,
            starts_at=timezone.now() - timedelta(days=3),
            expires_at=timezone.now() - timedelta(days=1),
            is_active=True,
        )

        playback_url = (
            "/api/live-classes/student/recordings/"
            f"{self.recording_a.public_id}/play/"
        )
        self.authenticate(self.student_user_a)

        expired = self.client.get(playback_url)
        self.assertEqual(expired.status_code, 403)

        access.expires_at = timezone.now() + timedelta(days=1)
        access.revoked_at = timezone.now()
        access.save()

        revoked = self.client.get(playback_url)
        self.assertEqual(revoked.status_code, 403)
