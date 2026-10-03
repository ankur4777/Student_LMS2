"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";

import "../dashboard/dashboard.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

interface TeacherUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface TeacherStudent {
  student_profile_id: number;
  student_user_id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  admission_number: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
  academic_session: string;
  subjects: string[];
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

export default function TeacherStudentsPage() {
  const router = useRouter();
  const [teacher] = useState<TeacherUser>(getSavedTeacher);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("teacher_access_token");
    localStorage.removeItem("teacher_refresh_token");
    localStorage.removeItem("teacher_user");
  }, []);

  const loadStudents = useCallback(
    async (query = "") => {
      const token = localStorage.getItem("teacher_access_token");

      if (!token) {
        router.replace("/teacher/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (query.trim()) {
          params.set("search", query.trim());
        }

        const url = `${API_BASE}/api/accounts/teacher/students/${
          params.toString() ? `?${params.toString()}` : ""
        }`;

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (response.status === 401) {
          clearSession();
          router.replace("/teacher/login");
          return;
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "Student data is temporarily unavailable. Please refresh the page."
          );
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load students.");
        }

        setStudents(Array.isArray(result.students) ? result.students : []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load students."
        );
      } finally {
        setLoading(false);
      }
    },
    [clearSession, router]
  );

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    void loadStudents(search);
  };

  const clearSearch = () => {
    setSearch("");
    setSubmittedSearch("");
    void loadStudents("");
  };

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
                <h2 className="fw-bold mb-1">My Students</h2>
                <p className="text-muted mb-0">
                  Students you currently teach, based on your subject and section assignments.
                </p>
              </div>

              <span className="badge bg-primary fs-6">
                {students.length} Students
              </span>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <form
                  className="d-flex gap-2 flex-wrap"
                  onSubmit={handleSearch}
                >
                  <input
                    className="form-control flex-grow-1"
                    style={{ minWidth: "240px" }}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by student, username, address, admission no., roll no., class or subject"
                  />
                  <button className="btn btn-primary" type="submit">
                    Search
                  </button>
                  {submittedSearch && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={clearSearch}
                    >
                      Clear
                    </button>
                  )}
                </form>
              </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading students...
                </div>
              </div>
            ) : students.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold mb-2">No Students Found</h5>
                  <p className="text-muted mb-0">
                    Students will appear here when you have an active subject
                    assignment and eligible students are enrolled in that section.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Admission / Roll</th>
                        <th>Class & Section</th>
                        <th>Subjects I Teach</th>
                        <th>Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.student_profile_id}>
                          <td>
                            <div className="fw-semibold">{student.name}</div>
                            <small className="text-muted">
                              @{student.username}
                            </small>
                          </td>
                          <td>
                            <div>{student.admission_number || "-"}</div>
                            <small className="text-muted">
                              Roll: {student.roll_number || "-"}
                            </small>
                          </td>
                          <td>
                            <div className="fw-semibold">
                              {student.classroom_name || "-"}
                            </div>
                            <small className="text-muted">
                              Section {student.section_name || "-"}
                              {student.academic_session
                                ? ` · ${student.academic_session}`
                                : ""}
                            </small>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {student.subjects.length > 0
                                ? student.subjects.map((subject) => (
                                    <span
                                      className="badge bg-light text-dark border"
                                      key={subject}
                                    >
                                      {subject}
                                    </span>
                                  ))
                                : "-"}
                            </div>
                          </td>
                          <td>
                            <div>{student.email || "-"}</div>
                            <small className="text-muted d-block">
                              {student.phone || ""}
                            </small>
                            <small className="text-muted d-block">
                              {student.address || "-"}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
