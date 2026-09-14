"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentProfile {
  admission_number: string;
  phone: string;
}

interface Student {
  id: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  profile: StudentProfile | null;
}

function getSavedAdmin() {
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

export default function CollegeAdminStudentsPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const fetchJson = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    const token = getToken();

    if (!token) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      clearSession();
      router.replace("/college-admin/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result?.detail || "Unable to load students."
      );
    }

    return result;
  }, [clearSession, getToken, router]);

  const loadStudents = useCallback(async (query = search) => {
    const url = new URL(
      `${API_BASE}/api/accounts/college-admin/students/`
    );

    if (query.trim()) {
      url.searchParams.set("search", query.trim());
    }

    const result = await fetchJson(url.toString());
    setStudents(result.students || []);
  }, [fetchJson, search]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        await loadStudents("");
      } catch (err) {
        if (
          isMounted &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [loadStudents]);

  const handleSearch = async () => {
    try {
      setError("");
      setLoading(true);
      await loadStudents(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (student: Student) => {
    try {
      setSaving(true);
      setError("");

      await fetchJson(
        `${API_BASE}/api/accounts/college-admin/students/${student.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !student.is_active,
          }),
        }
      );

      await loadStudents(search);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
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
                <h2 className="fw-bold mb-1">
                  Students
                </h2>

                <p className="text-muted mb-0">
                  Manage students in your institution.
                </p>
              </div>

              <Link
                className="btn btn-primary"
                href="/college-admin/students/create"
              >
                Add Student
              </Link>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <div className="row g-2">
                  <div className="col-md-10">
                    <input
                      className="form-control"
                      placeholder="Search by name, username, or email"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </div>

                  <div className="col-md-2 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleSearch}
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading students...
                </div>
              </div>
            ) : students.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">
                    No Students
                  </h5>

                  <p className="text-muted mb-0">
                    Students created for this college will appear here.
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
                        <th>Username</th>
                        <th>Email / Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div className="fw-semibold">
                              {student.name}
                            </div>
                            <div className="text-muted small">
                              {student.profile?.admission_number || "-"}
                            </div>
                          </td>
                          <td>{student.username}</td>
                          <td>
                            <div>{student.email || "-"}</div>
                            <div className="text-muted small">
                              {student.profile?.phone || "-"}
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                student.is_active
                                  ? "badge bg-success"
                                  : "badge bg-secondary"
                              }
                            >
                              {student.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <Link
                                className="btn btn-outline-primary btn-sm"
                                href={`/college-admin/students/${student.id}`}
                              >
                                View
                              </Link>
                              <Link
                                className="btn btn-outline-secondary btn-sm"
                                href={`/college-admin/students/${student.id}/edit`}
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={saving}
                                onClick={() => toggleStatus(student)}
                              >
                                {student.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
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
