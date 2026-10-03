"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface SubjectData {
  id: number;
  name: string;
  code: string;
  class_name: string;
  academic_session: string;
  student_assignment_mode: "all" | "selected";
  eligible_student_count: number;
  class_student_count: number;
}

interface SubjectStudent {
  student_profile_id: number;
  student_user_id: number;
  name: string;
  username: string;
  email: string;
  roll_number: string;
  section_id: number;
  section_name: string;
  studies_subject: boolean;
}

function getSavedAdmin() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(
      localStorage.getItem("college_admin_user") || "{}"
    );
  } catch {
    return {};
  }
}

export default function SubjectStudentsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [subject, setSubject] = useState<SubjectData | null>(null);
  const [students, setStudents] = useState<SubjectStudent[]>([]);
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return "";
    }
    return token;
  }, [router]);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      setError("");
      const response = await fetch(
        `${API_BASE}/api/academics/college-admin/subjects/${params.id}/students/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
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
          result?.detail || "Unable to load subject students."
        );
      }

      setSubject(result.subject);
      setMode(result.subject.student_assignment_mode || "all");
      setStudents(result.students || []);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clearSession, getToken, params.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const values = new Set(
      students.map((student) => student.section_name)
    );
    return Array.from(values).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        [
          student.name,
          student.username,
          student.email,
          student.roll_number,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesSection =
        !sectionFilter || student.section_name === sectionFilter;

      return matchesSearch && matchesSection;
    });
  }, [search, sectionFilter, students]);

  const selectedCount = students.filter(
    (student) => student.studies_subject
  ).length;

  const toggleStudent = (studentProfileId: number) => {
    setStudents((current) =>
      current.map((student) =>
        student.student_profile_id === studentProfileId
          ? {
              ...student,
              studies_subject: !student.studies_subject,
            }
          : student
      )
    );
    setSuccess("");
  };

  const selectAll = () => {
    setStudents((current) =>
      current.map((student) => ({
        ...student,
        studies_subject: true,
      }))
    );
    setSuccess("");
  };

  const clearAll = () => {
    setStudents((current) =>
      current.map((student) => ({
        ...student,
        studies_subject: false,
      }))
    );
    setSuccess("");
  };

  const save = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE}/api/academics/college-admin/subjects/${params.id}/students/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            student_assignment_mode: mode,
            student_profile_ids: students
              .filter((student) => student.studies_subject)
              .map((student) => student.student_profile_id),
          }),
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
          result?.detail || "Unable to save subject students."
        );
      }

      setSuccess("Subject student assignment saved successfully.");
      await load();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teacher-dashboard">
      <CollegeAdminSidebar />

      <main className="teacher-dashboard-main">
        <CollegeAdminTopbar
          name={admin.name || admin.username || "College Admin"}
          organization={admin.organization || ""}
        />

        <div className="teacher-dashboard-content">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
              <div>
                <div className="text-danger fw-semibold small mb-2">
                  COLLEGE ADMIN
                </div>
                <h2 className="fw-bold mb-1">
                  Manage Subject Students
                </h2>
                <p className="text-muted mb-0">
                  {subject
                    ? `${subject.name} · ${subject.class_name} · ${subject.academic_session}`
                    : "Choose which students study this subject."}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  router.push("/college-admin/subjects")
                }
              >
                Back to Subjects
              </button>
            </div>

            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            {success && (
              <div className="alert alert-success">{success}</div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading students...
                </div>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="row g-3 align-items-end">
                      <div className="col-lg-5">
                        <label className="form-label">
                          Student Assignment Mode
                        </label>
                        <select
                          className="form-select"
                          value={mode}
                          onChange={(event) =>
                            setMode(
                              event.target.value as "all" | "selected"
                            )
                          }
                        >
                          <option value="all">
                            All Students — exclude exceptions
                          </option>
                          <option value="selected">
                            Selected Students Only
                          </option>
                        </select>
                        <div className="form-text">
                          All Students is best when only a few students do
                          not study the subject. Selected Students Only is
                          useful for optional or elective subjects.
                        </div>
                      </div>

                      <div className="col-lg-3">
                        <label className="form-label">Search</label>
                        <input
                          className="form-control"
                          value={search}
                          onChange={(event) =>
                            setSearch(event.target.value)
                          }
                          placeholder="Name, username, email or roll no."
                        />
                      </div>

                      <div className="col-lg-2">
                        <label className="form-label">Section</label>
                        <select
                          className="form-select"
                          value={sectionFilter}
                          onChange={(event) =>
                            setSectionFilter(event.target.value)
                          }
                        >
                          <option value="">All sections</option>
                          {sections.map((section) => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-lg-2">
                        <div className="small text-muted">
                          Studying subject
                        </div>
                        <div className="fs-5 fw-bold">
                          {selectedCount} / {students.length}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex gap-2 flex-wrap mt-3">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={selectAll}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={clearAll}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Study</th>
                          <th>Student</th>
                          <th>Username</th>
                          <th>Roll Number</th>
                          <th>Section</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-center py-5 text-muted"
                            >
                              No students found.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((student) => (
                            <tr key={student.student_profile_id}>
                              <td>
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={student.studies_subject}
                                  onChange={() =>
                                    toggleStudent(
                                      student.student_profile_id
                                    )
                                  }
                                />
                              </td>
                              <td className="fw-semibold">
                                {student.name}
                              </td>
                              <td>{student.username}</td>
                              <td>{student.roll_number || "-"}</td>
                              <td>{student.section_name}</td>
                              <td>{student.email || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="card-body border-top d-flex justify-content-between align-items-center gap-3 flex-wrap">
                    <div className="text-muted small">
                      Checked students will receive this subject's
                      assignments, exams, classes, documents and related
                      notifications.
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={save}
                    >
                      {saving ? "Saving..." : "Save Student Assignment"}
                    </button>
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
