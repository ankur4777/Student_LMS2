"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  academic_sessions: number;
  classrooms: number;
  sections: number;
  subjects: number;
  live_classes: number;
  assignments: number;
  exams: number;
  documents: number;
  active_student_enrollments: number;
  active_teacher_assignments: number;
}

interface AttendanceAnalytics {
  period_label: string;
  session_count: number;
  record_count: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
}

interface AssignmentAnalytics {
  total: number;
  published: number;
  eligible_submissions: number;
  submitted: number;
  pending: number;
  graded: number;
}

interface ResultAnalytics {
  total_exams: number;
  published_exams: number;
  unpublished_exams: number;
  results_entered: number;
}

interface LiveClassAnalytics {
  today: number;
  upcoming: number;
  completed: number;
  recorded: number;
}

interface ActivityItem {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  related_url: string | null;
  notification_type: string;
}

interface DashboardData {
  organization: OrganizationInfo;
  summary: Summary;
  attendance: AttendanceAnalytics;
  assignments: AssignmentAnalytics;
  results: ResultAnalytics;
  live_classes: LiveClassAnalytics;
  recent_activity: ActivityItem[];
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

  const cards = data
    ? [
        ["Students", data.summary.total_students],
        ["Teachers", data.summary.total_teachers],
        ["Parents", data.summary.total_parents],
        ["Academic Sessions", data.summary.academic_sessions],
        ["Classes", data.summary.classrooms],
        ["Sections", data.summary.sections],
        ["Subjects", data.summary.subjects],
        ["Live Classes", data.summary.live_classes],
        ["Assignments", data.summary.assignments],
        ["Exams / Results", data.summary.exams],
        ["Documents", data.summary.documents],
        [
          "Active Enrollments",
          data.summary.active_student_enrollments,
        ],
        [
          "Teacher Assignments",
          data.summary.active_teacher_assignments,
        ],
      ]
    : [];

  const quickActions = [
    ["Add Student", "/college-admin/students/create"],
    ["Add Teacher", "/college-admin/teachers/create"],
    ["Create Enrollment", "/college-admin/enrollments/create"],
    ["Create Teacher Assignment", "/college-admin/teacher-assignments/create"],
    ["View Attendance", "/college-admin/attendance"],
    ["View Assignments", "/college-admin/assignments"],
    ["View Results", "/college-admin/results"],
    ["View Documents", "/college-admin/documents"],
    ["View Notifications", "/college-admin/notifications"],
  ];

  const metricCards = (items: [string, string | number][]) => (
    <div className="row g-3">
      {items.map(([label, value]) => (
        <div key={label} className="col-6 col-lg-4">
          <div className="border rounded p-3 h-100">
            <div className="text-muted small">{label}</div>
            <div className="fs-4 fw-bold">{value}</div>
          </div>
        </div>
      ))}
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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                College Admin Dashboard
              </h2>

              <p className="text-muted mb-0">
                Manage your institution&apos;s users and academic structure.
              </p>
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
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-3">
                      College Overview
                    </h5>

                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">
                          Organization
                        </div>

                        <div className="fw-semibold">
                          {data.organization.name}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="text-muted small">
                          Code
                        </div>

                        <div className="fw-semibold">
                          {data.organization.code || "-"}
                        </div>
                      </div>

                      <div className="col-md-4">
                        <div className="text-muted small">
                          Status
                        </div>

                        <div className="fw-semibold">
                          {data.organization.is_active
                            ? "Active"
                            : "Inactive"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-4">
                  {cards.map(([label, value]) => (
                    <div
                      className="col-md-6 col-xl-3"
                      key={label}
                    >
                      <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                          <div className="text-muted small mb-2">
                            {label}
                          </div>

                          <h3 className="fw-bold mb-0">
                            {value}
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card border-0 shadow-sm mt-4">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                      <div>
                        <h5 className="fw-bold mb-1">
                          Attendance Overview
                        </h5>
                        <p className="text-muted mb-0">
                          {data.attendance.period_label}
                        </p>
                      </div>
                      <div className="fs-4 fw-bold">
                        {data.attendance.attendance_percentage}%
                      </div>
                    </div>
                    {metricCards([
                      ["Sessions", data.attendance.session_count],
                      ["Records", data.attendance.record_count],
                      ["Present", data.attendance.present],
                      ["Absent", data.attendance.absent],
                      ["Late", data.attendance.late],
                      ["Excused", data.attendance.excused],
                    ])}
                  </div>
                </div>

                <div className="row g-4 mt-1">
                  <div className="col-xl-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Assignments</h5>
                        {metricCards([
                          ["Total", data.assignments.total],
                          ["Published", data.assignments.published],
                          [
                            "Eligible",
                            data.assignments.eligible_submissions,
                          ],
                          ["Submitted", data.assignments.submitted],
                          ["Pending", data.assignments.pending],
                          ["Graded", data.assignments.graded],
                        ])}
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Results</h5>
                        {metricCards([
                          ["Total Exams", data.results.total_exams],
                          [
                            "Published",
                            data.results.published_exams,
                          ],
                          [
                            "Unpublished",
                            data.results.unpublished_exams,
                          ],
                          [
                            "Results Entered",
                            data.results.results_entered,
                          ],
                        ])}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-4 mt-1">
                  <div className="col-xl-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Live Classes</h5>
                        {metricCards([
                          ["Today", data.live_classes.today],
                          ["Upcoming", data.live_classes.upcoming],
                          ["Completed", data.live_classes.completed],
                          ["Recorded", data.live_classes.recorded],
                        ])}
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Quick Actions</h5>
                        <div className="d-flex flex-wrap gap-2">
                          {quickActions.map(([label, href]) => (
                            <Link
                              key={href}
                              className="btn btn-outline-primary btn-sm"
                              href={href}
                            >
                              {label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mt-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-3">Recent Activity</h5>
                    {data.recent_activity.length === 0 ? (
                      <div className="text-muted py-4 text-center">
                        No recent activity found.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {data.recent_activity.map((activity) => (
                          <div
                            key={activity.id}
                            className="d-flex justify-content-between align-items-start gap-3 flex-wrap border-bottom pb-3"
                          >
                            <div>
                              <div className="fw-semibold">
                                {activity.title}
                              </div>
                              <div className="text-muted small">
                                {activity.description}
                              </div>
                              <div className="text-muted small mt-1">
                                {new Date(
                                  activity.timestamp
                                ).toLocaleString()}
                              </div>
                            </div>
                            {activity.related_url?.startsWith(
                              "/college-admin/"
                            ) && (
                              <Link
                                className="btn btn-outline-secondary btn-sm"
                                href={activity.related_url}
                              >
                                View
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
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
