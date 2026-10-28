from django.urls import path

from .learning_content import (
    ManagedLearningCoursesAPIView,
    ManagedCourseModulesAPIView,
    ManagedModuleDetailAPIView,
    ManagedModuleResourcesAPIView,
    ManagedResourceDownloadAPIView,
    ManagedCourseTeachersAPIView,
    ManagedModuleLessonsAPIView,
    ManagedLessonModuleAPIView,
)

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
