"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface OrganizationInfo {
  name: string;
  code: string;
  is_active: boolean;
}

interface Summary {
  total_students: number;
  total_teachers: number;
  total_parents: number;
  total_classes: number;
  total_sections: number;
  total_subjects: number;
  active_enrollments: number;
  total_teacher_assignments: number;
  total_live_classes: number;
  upcoming_live_classes: number;
  total_assignments: number;
  total_documents: number;
  total_exams: number;
  attendance_percentage: number;
}

interface RecentItemBase {
  teacher_name?: string;
  subject_name?: string;
  classroom_name?: string;
  section_name?: string;
  status?: string;
}

interface RecentLiveClass extends RecentItemBase {
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
}

interface RecentAssignment extends RecentItemBase {
  title: string;
  due_date: string;
  due_time: string | null;
  created_at: string;
}

interface RecentDocument extends RecentItemBase {
  title: string;
  document_type: string;
  created_at: string;
  published_at: string | null;
}

interface RecentExam extends RecentItemBase {
  name: string;
  exam_date: string;
  results_entered: number;
}

interface DashboardData {
  organization: OrganizationInfo;
  summary: Summary;
  recent_live_classes: RecentLiveClass[];
  recent_assignments: RecentAssignment[];
  recent_documents: RecentDocument[];
  recent_exams: RecentExam[];
}

function getSavedCollegeAdmin() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedUser = localStorage.getItem("college_admin_user");

  if (!savedUser) {
    return {};
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    return {};
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function statusBadge(status?: string) {
  const normalized = status || "";
  const className = ["published", "completed", "scheduled"].includes(
    normalized
  )
    ? "badge bg-success"
    : normalized === "draft"
      ? "badge bg-secondary"
      : "badge bg-primary";

  return (
    <span className={className}>
      {normalized || "active"}
    </span>
  );
}

function contextLine(item: RecentItemBase) {
  return [
    item.teacher_name,
    item.subject_name,
    item.classroom_name && item.section_name
      ? `${item.classroom_name} - ${item.section_name}`
      : item.classroom_name || item.section_name,
  ].filter(Boolean).join(" - ");
}

export default function CollegeAdminDashboardPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedCollegeAdmin);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(
      "college_admin_access_token"
    );
    let isMounted = true;

    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    const clearSession = () => {
      localStorage.removeItem("college_admin_access_token");
      localStorage.removeItem("college_admin_refresh_token");
      localStorage.removeItem("college_admin_user");
    };

    const loadDashboard = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/college-admin/dashboard/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail ||
              "Unable to load college admin dashboard."
          );
        }

        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const summaryCards = data
    ? [
        ["Students", data.summary.total_students, "/college-admin/students"],
        ["Teachers", data.summary.total_teachers, "/college-admin/teachers"],
        ["Parents", data.summary.total_parents, "/college-admin/parents"],
        ["Classes", data.summary.total_classes, "/college-admin/classes"],
        ["Sections", data.summary.total_sections, "/college-admin/sections"],
        ["Subjects", data.summary.total_subjects, "/college-admin/subjects"],
        [
          "Active Enrollments",
          data.summary.active_enrollments,
          "/college-admin/enrollments",
        ],
        [
          "Teacher Assignments",
          data.summary.total_teacher_assignments,
          "/college-admin/teacher-assignments",
        ],
      ]
    : [];

  const academicCards = data
    ? [
        [
          "Live Classes",
          data.summary.total_live_classes,
          "/college-admin/live-classes",
        ],
        [
          "Assignments",
          data.summary.total_assignments,
          "/college-admin/assignments",
        ],
        [
          "Documents",
          data.summary.total_documents,
          "/college-admin/documents",
        ],
        ["Exams", data.summary.total_exams, "/college-admin/results"],
        [
          "Attendance %",
          `${data.summary.attendance_percentage}%`,
          "/college-admin/attendance",
        ],
      ]
    : [];

  const quickActions = [
    ["Add Student", "/college-admin/students/create"],
    ["Add Teacher", "/college-admin/teachers/create"],
    ["Create Enrollment", "/college-admin/enrollments/create"],
    ["Assign Teacher", "/college-admin/teacher-assignments/create"],
  ];

  const renderMetricCards = (
    items: (string | number)[][]
  ) => (
    <div className="row g-3">
      {items.map(([label, value, href]) => (
        <div key={String(label)} className="col-6 col-xl-3">
          <Link
            href={String(href)}
            className="text-decoration-none text-reset"
          >
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-3 p-md-4">
                <div className="text-muted small mb-2">
                  {label}
                </div>
                <div className="fs-3 fw-bold">
                  {value}
                </div>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );

  const renderRecentSection = (
    title: string,
    href: string,
    items: ReactNode,
    isEmpty: boolean
  ) => (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
          <h5 className="fw-bold mb-0">{title}</h5>
          <Link className="btn btn-outline-primary btn-sm" href={href}>
            View All
          </Link>
        </div>

        {isEmpty ? (
          <div className="text-muted text-center py-4">
            No records found.
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {items}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={
            data?.organization.name ||
            admin.organization ||
            ""
          }
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">
                  College Admin Dashboard
                </h2>
                <p className="text-muted mb-0">
                  {data?.organization.name ||
                    admin.organization ||
                    "Institution overview"}
                </p>
              </div>

              <div className="d-flex flex-wrap gap-2">
                {quickActions.map(([label, href]) => (
                  <Link
                    key={href}
                    className="btn btn-primary btn-sm"
                    href={href}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading dashboard...
                </div>
              </div>
            ) : data ? (
              <>
                <div className="mb-4">
                  {renderMetricCards(summaryCards)}
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                      <div>
                        <h5 className="fw-bold mb-1">
                          Academic Overview
                        </h5>
                        <p className="text-muted mb-0">
                          {data.summary.upcoming_live_classes} upcoming live classes
                        </p>
                      </div>
                    </div>
                    {renderMetricCards(academicCards)}
                  </div>
                </div>

                <div className="row g-4">
                  <div className="col-xl-6">
                    {renderRecentSection(
                      "Recent Live Classes",
                      "/college-admin/live-classes",
                      data.recent_live_classes.map((item) => (
                        <div
                          key={`${item.title}-${item.class_date}-${item.start_time}`}
                          className="border-bottom pb-3"
                        >
                          <div className="d-flex justify-content-between gap-3">
                            <div>
                              <div className="fw-semibold">{item.title}</div>
                              <div className="text-muted small">
                                {contextLine(item)}
                              </div>
                              <div className="text-muted small mt-1">
                                {formatDate(item.class_date)}{" "}
                                {formatTime(item.start_time)}-
                                {formatTime(item.end_time)}
                              </div>
                            </div>
                            {statusBadge(item.status)}
                          </div>
                        </div>
                      )),
                      data.recent_live_classes.length === 0
                    )}
                  </div>

                  <div className="col-xl-6">
                    {renderRecentSection(
                      "Recent Assignments",
                      "/college-admin/assignments",
                      data.recent_assignments.map((item) => (
                        <div
                          key={`${item.title}-${item.created_at}`}
                          className="border-bottom pb-3"
                        >
                          <div className="d-flex justify-content-between gap-3">
                            <div>
                              <div className="fw-semibold">{item.title}</div>
                              <div className="text-muted small">
                                {contextLine(item)}
                              </div>
                              <div className="text-muted small mt-1">
                                Due {formatDate(item.due_date)}{" "}
                                {formatTime(item.due_time)}
                              </div>
                            </div>
                            {statusBadge(item.status)}
                          </div>
                        </div>
                      )),
                      data.recent_assignments.length === 0
                    )}
                  </div>

                  <div className="col-xl-6">
                    {renderRecentSection(
                      "Recent Documents",
                      "/college-admin/documents",
                      data.recent_documents.map((item) => (
                        <div
                          key={`${item.title}-${item.created_at}`}
                          className="border-bottom pb-3"
                        >
                          <div className="d-flex justify-content-between gap-3">
                            <div>
                              <div className="fw-semibold">{item.title}</div>
                              <div className="text-muted small">
                                {contextLine(item)}
                              </div>
                              <div className="text-muted small mt-1">
                                {item.document_type.replace("_", " ")} -{" "}
                                {formatDate(item.published_at || item.created_at)}
                              </div>
                            </div>
                            {statusBadge(item.status)}
                          </div>
                        </div>
                      )),
                      data.recent_documents.length === 0
                    )}
                  </div>

                  <div className="col-xl-6">
                    {renderRecentSection(
                      "Recent Exams / Results",
                      "/college-admin/results",
                      data.recent_exams.map((item) => (
                        <div
                          key={`${item.name}-${item.exam_date}`}
                          className="border-bottom pb-3"
                        >
                          <div className="d-flex justify-content-between gap-3">
                            <div>
                              <div className="fw-semibold">{item.name}</div>
                              <div className="text-muted small">
                                {item.classroom_name} - {item.section_name}
                              </div>
                              <div className="text-muted small mt-1">
                                {formatDate(item.exam_date)} -{" "}
                                {item.results_entered} results entered
                              </div>
                            </div>
                            {statusBadge(item.status)}
                          </div>
                        </div>
                      )),
                      data.recent_exams.length === 0
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
