"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  relationship: string;
}

interface Assignment {
  status?: string;
  submission?: {
    status?: string;
  } | null;
}

interface AttendanceSummary {
  attendance_percentage?: number;
}

interface ExamResult {
  name?: string;
  exam_date?: string;
  percentage?: number;
  total_obtained?: number;
  total_maximum?: number;
}

interface ChildDashboard extends Child {
  attendancePercentage: number | null;
  pendingAssignments: number;
  latestResult: string;
  latestExamDate: string;
}

function getSavedParent() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedParent = localStorage.getItem("parent_user");

  if (!savedParent) {
    return {};
  }

  try {
    return JSON.parse(savedParent);
  } catch {
    return {};
  }
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function getLatestResult(exams: ExamResult[]) {
  if (exams.length === 0) {
    return {
      latestResult: "-",
      latestExamDate: "",
    };
  }

  const latestExam = [...exams].sort((first, second) => {
    const firstDate = first.exam_date
      ? new Date(first.exam_date).getTime()
      : 0;
    const secondDate = second.exam_date
      ? new Date(second.exam_date).getTime()
      : 0;

    return secondDate - firstDate;
  })[0];

  if (typeof latestExam.percentage === "number") {
    return {
      latestResult: `${Math.round(latestExam.percentage)}%`,
      latestExamDate: latestExam.exam_date || "",
    };
  }

  if (
    typeof latestExam.total_obtained === "number" &&
    typeof latestExam.total_maximum === "number"
  ) {
    return {
      latestResult: `${latestExam.total_obtained}/${latestExam.total_maximum}`,
      latestExamDate: latestExam.exam_date || "",
    };
  }

  return {
    latestResult: latestExam.name || "-",
    latestExamDate: latestExam.exam_date || "",
  };
}

export default function ParentDashboardPage() {
  const router = useRouter();

  const [parent] = useState<ParentUser>(getSavedParent);
  const [children, setChildren] = useState<ChildDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const averageAttendance = useMemo(() => {
    const available = children
      .map((child) => child.attendancePercentage)
      .filter((value): value is number => value !== null);

    if (available.length === 0) {
      return null;
    }

    return (
      available.reduce((total, value) => total + value, 0) /
      available.length
    );
  }, [children]);

  const pendingAssignments = useMemo(
    () =>
      children.reduce(
        (total, child) => total + child.pendingAssignments,
        0
      ),
    [children]
  );

  const latestResult = useMemo(() => {
    const childrenWithResults = children.filter(
      (child) => child.latestResult !== "-"
    );

    if (childrenWithResults.length === 0) {
      return "-";
    }

    const sortedChildren = [...childrenWithResults].sort(
      (first, second) => {
        const firstDate = first.latestExamDate
          ? new Date(first.latestExamDate).getTime()
          : 0;
        const secondDate = second.latestExamDate
          ? new Date(second.latestExamDate).getTime()
          : 0;

        return secondDate - firstDate;
      }
    );

    return sortedChildren[0].latestResult;
  }, [children]);

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");
    let isMounted = true;

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    const clearParentSession = () => {
      localStorage.removeItem("parent_access_token");
      localStorage.removeItem("parent_refresh_token");
      localStorage.removeItem("parent_user");
    };

    const fetchJson = async (url: string) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        clearParentSession();
        router.replace("/parent/login");
        throw new Error("Unauthorized");
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to load dashboard data."
        );
      }

      return result;
    };

    const loadChildDetails = async (
      child: Child
    ): Promise<ChildDashboard> => {
      const childId = child.student_profile_id;

      const [attendance, assignments, results] =
        await Promise.allSettled([
          fetchJson(
            `${API_BASE}/api/attendance/parent/student/${childId}/`
          ),
          fetchJson(
            `${API_BASE}/api/assignments/parent/student/${childId}/`
          ),
          fetchJson(
            `${API_BASE}/api/results/parent/student/${childId}/`
          ),
        ]);

      const summary =
        attendance.status === "fulfilled"
          ? (attendance.value.summary as AttendanceSummary | null)
          : null;

      const assignmentList =
        assignments.status === "fulfilled"
          ? (assignments.value.assignments as Assignment[] | undefined) ||
            []
          : [];

      const examList =
        results.status === "fulfilled"
          ? (results.value.exams as ExamResult[] | undefined) || []
          : [];

      const latest = getLatestResult(examList);

      return {
        ...child,
        attendancePercentage:
          typeof summary?.attendance_percentage === "number"
            ? summary.attendance_percentage
            : null,
        pendingAssignments: assignmentList.filter(
          (assignment) =>
            (
              assignment.status ||
              assignment.submission?.status ||
              "pending"
            ).toLowerCase() === "pending"
        ).length,
        latestResult: latest.latestResult,
        latestExamDate: latest.latestExamDate,
      };
    };

    const loadDashboard = async () => {
      try {
        const childResult = await fetchJson(
          `${API_BASE}/api/accounts/parent/children/`
        );
        const childList = (childResult.children || []) as Child[];
        const childDetails = await Promise.all(
          childList.map((child) => loadChildDetails(child))
        );

        if (isMounted) {
          setChildren(childDetails);
        }
      } catch (err) {
        if (isMounted && err instanceof Error) {
          setError(
            err.message === "Unauthorized"
              ? ""
              : err.message
          );
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

  return (
    <div className="student-dashboard">
      <ParentSidebar />

      <main className="student-dashboard-main">
        <ParentTopbar
          name={parent.name || parent.username || "Parent"}
          organization={parent.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">

            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <h2 className="fw-bold mb-1">
                  Parent Dashboard
                </h2>

                <p className="text-muted mb-0">
                  Monitor your child&apos;s academic progress.
                </p>
              </div>

              <Link
                className="btn btn-outline-primary"
                href="/parent/children"
              >
                View All Children
              </Link>
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
            ) : (
              <>
                <div className="row g-4">

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Linked Children
                        </div>

                        <h3 className="fw-bold mb-0">
                          {children.length}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Attendance
                        </div>

                        <h3 className="fw-bold mb-0">
                          {formatPercent(averageAttendance)}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Pending Assignments
                        </div>

                        <h3 className="fw-bold mb-0">
                          {pendingAssignments}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="text-muted small mb-2">
                          Latest Result
                        </div>

                        <h3 className="fw-bold mb-0">
                          {latestResult}
                        </h3>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="card border-0 shadow-sm mt-4">
                  <div className="card-body p-4">

                    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                      <h5 className="fw-bold mb-0">
                        My Children
                      </h5>

                      <Link
                        className="btn btn-outline-primary btn-sm"
                        href="/parent/children"
                      >
                        View All Children
                      </Link>
                    </div>

                    {children.length === 0 ? (
                      <p className="text-muted mb-0">
                        No linked children found.
                      </p>
                    ) : (
                      <div className="row g-4">
                        {children.map((child) => (
                          <div
                            className="col-lg-6"
                            key={child.student_profile_id}
                          >
                            <div className="border rounded p-3 h-100">
                              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                                <div>
                                  <h6 className="fw-bold mb-1">
                                    {child.name}
                                  </h6>

                                  <div className="text-muted">
                                    Roll Number:{" "}
                                    {child.roll_number || "-"}
                                  </div>
                                </div>

                                <span className="badge bg-primary">
                                  {child.relationship || "-"}
                                </span>
                              </div>

                              <div className="row g-3 mb-3">
                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Class
                                  </div>

                                  <div className="fw-semibold">
                                    {child.classroom_name || "-"}
                                  </div>
                                </div>

                                <div className="col-sm-6">
                                  <div className="text-muted small">
                                    Section
                                  </div>

                                  <div className="fw-semibold">
                                    {child.section_name || "-"}
                                  </div>
                                </div>

                                <div className="col-sm-4">
                                  <div className="text-muted small">
                                    Attendance
                                  </div>

                                  <div className="fw-semibold">
                                    {formatPercent(
                                      child.attendancePercentage
                                    )}
                                  </div>
                                </div>

                                <div className="col-sm-4">
                                  <div className="text-muted small">
                                    Pending
                                  </div>

                                  <div className="fw-semibold">
                                    {child.pendingAssignments}
                                  </div>
                                </div>

                                <div className="col-sm-4">
                                  <div className="text-muted small">
                                    Latest Result
                                  </div>

                                  <div className="fw-semibold">
                                    {child.latestResult}
                                  </div>
                                </div>
                              </div>

                              <div className="d-flex flex-wrap gap-2">
                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/attendance"
                                >
                                  Attendance
                                </Link>

                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/assignments"
                                >
                                  Assignments
                                </Link>

                                <Link
                                  className="btn btn-outline-primary btn-sm"
                                  href="/parent/results"
                                >
                                  Results
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
