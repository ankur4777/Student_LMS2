import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import ParentProfile, StudentProfile, User
from academics.models import ParentStudent
from institutions.models import Organization
from recordedcourses.models import RecordedCourse, RecordedCourseAccess, RecordedCoursePurchase, RecordedLesson


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
        self.assertEqual(purchase.amount, self.course_a.price)
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
        self.assertEqual(purchase.amount, self.course_a.price)
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
