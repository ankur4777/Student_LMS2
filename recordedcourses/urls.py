from django.urls import path

from .student_learning import (
    StudentLearningCoursesAPIView,
    StudentLearningCourseDetailAPIView,
    StudentLearningResourceDownloadAPIView,
    StudentLearningLessonCompleteAPIView,
    StudentLearningPlaybackSessionAPIView,
    StudentLearningPlaybackHeartbeatAPIView,
    StudentLearningLessonPlaybackAPIView,
)

from .learning_certificates import StudentCertificatePDFAPIView, StudentCertificatesAPIView
from .learning_finals import (
    ManagedCourseFinalExamAPIView, ManagedCourseFinalQuestionsAPIView,
    StudentCourseFinalExamAPIView, ManagedCertificateAPIView,
    PublicCourseCertificateVerificationAPIView,
)
from .learning_assignments import (
    ManagedModuleAssignmentAPIView,
    ManagedAssignmentSubmissionsAPIView,
    ManagedAssignmentGradeAPIView,
    ManagedSubmissionDownloadAPIView,
    StudentModuleAssignmentAPIView,
)

from .learning_quizzes import (
    ManagedModuleQuizAPIView, ManagedModuleQuizQuestionsAPIView,
    StudentModuleQuizAPIView,
)
from .learning_content import (
    ManagedCourseProgressAPIView,
    ManagedLearningCoursesAPIView,
    ManagedCourseModulesAPIView,
    ManagedModuleDetailAPIView,
    ManagedModuleResourcesAPIView,
    ManagedResourceDownloadAPIView,
    ManagedCourseTeachersAPIView,
    ManagedModuleLessonsAPIView,
    ManagedLessonModuleAPIView,
)

from .learning_enrollments import ManagedCourseEnrollmentsAPIView
from .learning_readiness import ManagedCourseReadinessAPIView
from .learning_access import (
    CurrentOrganizationLearningSettingsAPIView,
    PlatformAdminOrganizationLearningSettingsAPIView,
)


from .views import (
    CollegeAdminRecordedCourseDetailAPIView,
    CollegeAdminRecordedCourseLessonsAPIView,
    CollegeAdminRecordedCoursesAPIView,
    CollegeAdminRecordedLessonDetailAPIView,
    CollegeAdminRecordedClassPurchaseSettingsAPIView,
    CollegeAdminRecordedClassPurchasesAPIView,
    CollegeAdminRecordedCoursePurchasesAPIView,
    CollegeAdminVerifyRecordedClassPurchaseAPIView,
    CollegeAdminVerifyRecordedCoursePurchaseAPIView,
    ParentRecordedCourseCatalogAPIView,
    ParentRecordedCoursePurchasesAPIView,
    StudentRecordedClassPurchasesAPIView,
    StudentRecordedCourseCatalogAPIView,
    StudentRecordedCoursePurchasesAPIView,
    StudentPurchasedRecordedCoursesAPIView,
    StudentPurchasedRecordedCourseDetailAPIView,
    StudentRecordedLessonPlaybackAPIView,
)

urlpatterns = [
    # Certificate library/download are student-owned, even when course access expires.
    path("learning/student/certificates/", StudentCertificatesAPIView.as_view()),
    path("learning/student/certificates/<uuid:public_id>/pdf/", StudentCertificatePDFAPIView.as_view()),
    # Final course exam and certificate verification endpoints.
    path("learning/manage/courses/<int:course_id>/final-exam/", ManagedCourseFinalExamAPIView.as_view()),
    path("learning/manage/courses/<int:course_id>/final-exam/questions/", ManagedCourseFinalQuestionsAPIView.as_view()),
    path("learning/manage/courses/<int:course_id>/certificates/", ManagedCertificateAPIView.as_view()),
    path("learning/student/courses/<int:course_id>/final-exam/", StudentCourseFinalExamAPIView.as_view()),
    path("learning/certificates/verify/<uuid:public_id>/", PublicCourseCertificateVerificationAPIView.as_view()),
    # Module assignments and manually graded work.
    path("learning/manage/modules/<int:module_id>/assignment/", ManagedModuleAssignmentAPIView.as_view()),
    path("learning/manage/modules/<int:module_id>/assignment/submissions/", ManagedAssignmentSubmissionsAPIView.as_view()),
    path("learning/manage/submissions/<int:submission_id>/grade/", ManagedAssignmentGradeAPIView.as_view()),
    path("learning/manage/submissions/<int:submission_id>/download/", ManagedSubmissionDownloadAPIView.as_view()),
    path("learning/student/modules/<int:module_id>/assignment/", StudentModuleAssignmentAPIView.as_view()),

    # Module MCQ assessments; organization switch and course permissions enforced.
    path("learning/manage/modules/<int:module_id>/quiz/", ManagedModuleQuizAPIView.as_view()),
    path("learning/manage/modules/<int:module_id>/quiz/questions/", ManagedModuleQuizQuestionsAPIView.as_view()),
    path("learning/student/modules/<int:module_id>/quiz/", StudentModuleQuizAPIView.as_view()),

    # Student Learning Center (existing paid-course playback stays intact).
    path("learning/student/lessons/<int:lesson_id>/play/", StudentLearningLessonPlaybackAPIView.as_view()),
    path("learning/student/courses/", StudentLearningCoursesAPIView.as_view(), name="student-learning-courses"),
    path("learning/student/courses/<int:course_id>/", StudentLearningCourseDetailAPIView.as_view(), name="student-learning-course-detail"),
    path("learning/student/resources/<int:resource_id>/download/", StudentLearningResourceDownloadAPIView.as_view(), name="student-learning-resource-download"),
    path("learning/student/lessons/<int:lesson_id>/complete/", StudentLearningLessonCompleteAPIView.as_view(), name="student-learning-lesson-complete"),
    path("learning/student/lessons/<int:lesson_id>/viewing-session/", StudentLearningPlaybackSessionAPIView.as_view(), name="student-learning-viewing-session"),
    path("learning/student/lessons/<int:lesson_id>/heartbeat/", StudentLearningPlaybackHeartbeatAPIView.as_view(), name="student-learning-playback-heartbeat"),

    # Staff course readiness preflight, read-only and tenant-scoped.
    path("learning/manage/courses/<int:course_id>/readiness/", ManagedCourseReadinessAPIView.as_view()),

    # Manual enrollments are College Admin only; paid access is immutable here.
    path("learning/manage/courses/<int:course_id>/enrollments/", ManagedCourseEnrollmentsAPIView.as_view()),

    # Paginated learner progress, restricted to authorized course staff.
    path("learning/manage/courses/<int:course_id>/progress/", ManagedCourseProgressAPIView.as_view()),

    # Organization-entitled, tenant-scoped authoring APIs.
    path("learning/manage/courses/", ManagedLearningCoursesAPIView.as_view()),
    path("learning/manage/courses/<int:course_id>/modules/", ManagedCourseModulesAPIView.as_view()),
    path("learning/manage/courses/<int:course_id>/teachers/", ManagedCourseTeachersAPIView.as_view()),
    path("learning/manage/modules/<int:module_id>/", ManagedModuleDetailAPIView.as_view()),
    path("learning/manage/modules/<int:module_id>/lessons/", ManagedModuleLessonsAPIView.as_view()),
    path("learning/manage/modules/<int:module_id>/resources/", ManagedModuleResourcesAPIView.as_view()),
    path("learning/manage/resources/<int:resource_id>/download/", ManagedResourceDownloadAPIView.as_view()),
    path("learning/manage/lessons/<int:lesson_id>/module/", ManagedLessonModuleAPIView.as_view()),

    # Learning & Certification is distinct from existing recorded-course purchases.
    path("learning-access/", CurrentOrganizationLearningSettingsAPIView.as_view(), name="organization-learning-status"),
    path("platform-admin/organizations/<int:organization_id>/learning-access/", PlatformAdminOrganizationLearningSettingsAPIView.as_view(), name="platform-learning-access"),

    path("college-admin/courses/", CollegeAdminRecordedCoursesAPIView.as_view(), name="college-admin-recorded-courses"),
    path("college-admin/courses/<int:course_id>/", CollegeAdminRecordedCourseDetailAPIView.as_view(), name="college-admin-recorded-course-detail"),
    path("college-admin/courses/<int:course_id>/lessons/", CollegeAdminRecordedCourseLessonsAPIView.as_view(), name="college-admin-recorded-course-lessons"),
    path("college-admin/lessons/<int:lesson_id>/", CollegeAdminRecordedLessonDetailAPIView.as_view(), name="college-admin-recorded-lesson-detail"),
    path("college-admin/purchases/", CollegeAdminRecordedCoursePurchasesAPIView.as_view(), name="college-admin-recorded-purchases"),
    path(
        "college-admin/recorded-class-purchases/",
        CollegeAdminRecordedClassPurchasesAPIView.as_view(),
        name="college-admin-recorded-class-purchases",
    ),
    path(
        "college-admin/recorded-classes/<uuid:public_id>/purchase-settings/",
        CollegeAdminRecordedClassPurchaseSettingsAPIView.as_view(),
        name="college-admin-recorded-class-purchase-settings",
    ),
    path(
        "college-admin/recorded-class-purchases/<int:purchase_id>/verify/",
        CollegeAdminVerifyRecordedClassPurchaseAPIView.as_view(),
        name="college-admin-verify-recorded-class-purchase",
    ),
    path("college-admin/purchases/<int:purchase_id>/verify/", CollegeAdminVerifyRecordedCoursePurchaseAPIView.as_view(), name="college-admin-verify-recorded-purchase"),
    path("student/catalog/", StudentRecordedCourseCatalogAPIView.as_view(), name="student-recorded-course-catalog"),
    path("student/purchases/", StudentRecordedCoursePurchasesAPIView.as_view(), name="student-recorded-course-purchases"),
    path(
        "student/recorded-class-purchases/",
        StudentRecordedClassPurchasesAPIView.as_view(),
        name="student-recorded-class-purchases",
    ),
    path("student/my-courses/", StudentPurchasedRecordedCoursesAPIView.as_view(), name="student-purchased-recorded-courses"),
    path("student/my-courses/<int:course_id>/", StudentPurchasedRecordedCourseDetailAPIView.as_view(), name="student-purchased-recorded-course-detail"),
    path("student/lessons/<int:lesson_id>/play/", StudentRecordedLessonPlaybackAPIView.as_view(), name="student-recorded-lesson-playback"),
    path("parent/catalog/", ParentRecordedCourseCatalogAPIView.as_view(), name="parent-recorded-course-catalog"),
    path("parent/purchases/", ParentRecordedCoursePurchasesAPIView.as_view(), name="parent-recorded-course-purchases"),
]
