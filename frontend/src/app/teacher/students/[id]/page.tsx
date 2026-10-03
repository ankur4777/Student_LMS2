"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../../dashboard/dashboard.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentDetailResponse {
  student: {
    student_profile_id: number;
    student_user_id: number;
    name: string;
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    phone: string;
    address: string;
    date_of_birth: string | null;
    admission_date: string | null;
  };
  academic: {
    admission_number: string;
    roll_number: string;
    classroom_name: string;
    section_name: string;
    academic_session: string;
    subjects_i_teach: Array<{
      id: number;
      name: string;
      code: string;
    }>;
  };
  attendance: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number | null;
  };
  assignments: {
    published: number;
    submitted: number;
    pending: number;
  };
  results: Array<{
    id: number;
    exam_name: string;
    exam_date: string;
    subject_name: string;
    marks_obtained: string;
    maximum_marks: string;
    percentage: number;
    remarks: string;
  }>;
}

function getSavedTeacher() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("teacher_user") || "{}");
  } catch {
    return {};
  }
}

function displayDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export default function TeacherStudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [data, setData] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  }, []);

  const loadStudent = useCallback(async () => {
    const token = localStorage.getItem("teacher_access_token");

    if (!token) {
      router.replace("/teacher/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/accounts/teacher/students/${params.id}/`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/teacher/login");
        return;
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Student details are temporarily unavailable. Please refresh the page."
        );
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.detail || "Unable to load student details.");
      }

      setData(result as StudentDetailResponse);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load student details."
      );
    } finally {
      setLoading(false);
    }
  }, [clearSession, params.id, router]);

  useEffect(() => {
    void loadStudent();
  }, [loadStudent]);

  return (
    <div className="teacher-dashboard">
      <TeacherSidebar />

      <main className="teacher-dashboard-main">
        <TeacherTopbar
          name={teacher.name || teacher.username || "Teacher"}
          organization={teacher.organization || ""}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none mb-2"
                  onClick={() => router.push("/teacher/students")}
                >
                  ← Back to Students
                </button>

                <h2 className="fw-bold mb-1">
                  {data?.student.name || "Student Details"}
                </h2>

                <p className="text-muted mb-0">
                  Personal and academic information for a student you currently teach.
                </p>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading student details...
                </div>
              </div>
            ) : data ? (
              <>
                <div className="row g-4 mb-4">
                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Personal Details</h5>

                        <div className="row g-3">
                          <div className="col-md-6">
                            <div className="text-muted small">Full Name</div>
                            <div className="fw-semibold">{data.student.name}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Username</div>
                            <div className="fw-semibold">@{data.student.username}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Email</div>
                            <div>{data.student.email || "-"}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Phone</div>
                            <div>{data.student.phone || "-"}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Date of Birth</div>
                            <div>{displayDate(data.student.date_of_birth)}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Admission Date</div>
                            <div>{displayDate(data.student.admission_date)}</div>
                          </div>

                          <div className="col-12">
                            <div className="text-muted small">Address</div>
                            <div>{data.student.address || "-"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Academic Details</h5>

                        <div className="row g-3">
                          <div className="col-md-6">
                            <div className="text-muted small">Admission Number</div>
                            <div className="fw-semibold">
                              {data.academic.admission_number || "-"}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Roll Number</div>
                            <div className="fw-semibold">
                              {data.academic.roll_number || "-"}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Class</div>
                            <div>{data.academic.classroom_name || "-"}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Section</div>
                            <div>{data.academic.section_name || "-"}</div>
                          </div>

                          <div className="col-md-6">
                            <div className="text-muted small">Academic Session</div>
                            <div>{data.academic.academic_session || "-"}</div>
                          </div>

                          <div className="col-12">
                            <div className="text-muted small mb-2">
                              Subjects I Teach This Student
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                              {data.academic.subjects_i_teach.map((subject) => (
                                <span
                                  className="badge bg-light text-dark border"
                                  key={subject.id}
                                >
                                  {subject.name}
                                  {subject.code ? ` (${subject.code})` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="row g-4 mb-4">
                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Attendance Summary</h5>

                        <div className="row g-3">
                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Attendance</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.percentage === null
                                  ? "-"
                                  : `${data.attendance.percentage}%`}
                              </div>
                            </div>
                          </div>

                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Present</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.present}
                              </div>
                            </div>
                          </div>

                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Late</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.late}
                              </div>
                            </div>
                          </div>

                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Absent</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.absent}
                              </div>
                            </div>
                          </div>

                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Excused</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.excused}
                              </div>
                            </div>
                          </div>

                          <div className="col-6 col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Total Records</div>
                              <div className="fs-4 fw-bold">
                                {data.attendance.total}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="form-text mt-3">
                          Attendance shown here is limited to subjects you teach this student.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <h5 className="fw-bold mb-3">Assignment Summary</h5>

                        <div className="row g-3">
                          <div className="col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Published</div>
                              <div className="fs-4 fw-bold">
                                {data.assignments.published}
                              </div>
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Submitted</div>
                              <div className="fs-4 fw-bold">
                                {data.assignments.submitted}
                              </div>
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="border rounded p-3 h-100">
                              <div className="text-muted small">Pending</div>
                              <div className="fs-4 fw-bold">
                                {data.assignments.pending}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="form-text mt-3">
                          Assignment counts are limited to your published assignments for this student.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-0">
                    <div className="p-4 border-bottom">
                      <h5 className="fw-bold mb-1">Recent Results</h5>
                      <p className="text-muted mb-0">
                        Results for subjects you teach this student.
                      </p>
                    </div>

                    {data.results.length === 0 ? (
                      <div className="py-5 text-center text-muted">
                        No results are available yet.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Exam</th>
                              <th>Date</th>
                              <th>Subject</th>
                              <th>Marks</th>
                              <th>Percentage</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.results.map((result) => (
                              <tr key={result.id}>
                                <td className="fw-semibold">
                                  {result.exam_name}
                                </td>
                                <td>{displayDate(result.exam_date)}</td>
                                <td>{result.subject_name}</td>
                                <td>
                                  {result.marks_obtained} / {result.maximum_marks}
                                </td>
                                <td>{result.percentage}%</td>
                                <td>{result.remarks || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
