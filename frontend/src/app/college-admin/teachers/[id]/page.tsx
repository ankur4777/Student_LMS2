"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Assignment {
  id: number;
  subject_name: string;
  classroom_name: string;
  section_name: string;
}

interface TeacherProfile {
  employee_id: string;
  phone: string;
  qualification: string;
  joining_date: string | null;
}

interface Teacher {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  organization: string;
  profile: TeacherProfile | null;
  assignments: Assignment[];
}

function getSavedAdmin() {
  if (typeof window === "undefined") {
    return {};
  }
  const saved = localStorage.getItem("college_admin_user");
  if (!saved) {
    return {};
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function formatValue(value?: string | null) {
  return value || "-";
}

export default function CollegeAdminTeacherDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadTeacher = async () => {
      const token = localStorage.getItem("college_admin_access_token");
      if (!token) {
        router.replace("/college-admin/login");
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/teachers/${params.id}/`,
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
          throw new Error(result?.detail || "Unable to load teacher.");
        }
        if (isMounted) {
          setTeacher(result.teacher || null);
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
    void loadTeacher();
    return () => {
      isMounted = false;
    };
  }, [clearSession, params.id, router]);

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
                <h2 className="fw-bold mb-1">Teacher Details</h2>
                <p className="text-muted mb-0">
                  View teacher account and profile information.
                </p>
              </div>
              {teacher && (
                <Link
                  className="btn btn-primary"
                  href={`/college-admin/teachers/${teacher.id}/edit`}
                >
                  Edit Teacher
                </Link>
              )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading teacher...
                </div>
              </div>
            ) : teacher ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">Account Information</h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Name</div>
                        <div className="fw-semibold">{teacher.name}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Username</div>
                        <div className="fw-semibold">{teacher.username}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Email</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.email)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Phone</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.profile?.phone)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">College</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.organization)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Status</div>
                        <span
                          className={
                            teacher.is_active
                              ? "badge bg-success"
                              : "badge bg-secondary"
                          }
                        >
                          {teacher.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">Teacher Profile</h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Employee ID</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.profile?.employee_id)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Qualification</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.profile?.qualification)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Joining Date</div>
                        <div className="fw-semibold">
                          {formatValue(teacher.profile?.joining_date)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                      <h5 className="fw-bold mb-0">
                        Teaching Assignments
                      </h5>
                      <Link
                        className="btn btn-outline-primary btn-sm"
                        href="/college-admin/teacher-assignments"
                      >
                        Manage Assignments
                      </Link>
                    </div>
                    {teacher.assignments.length === 0 ? (
                      <div className="text-muted">
                        No active teaching assignments.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Class</th>
                              <th>Section</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacher.assignments.map((assignment) => (
                              <tr key={assignment.id}>
                                <td>{assignment.subject_name}</td>
                                <td>{assignment.classroom_name}</td>
                                <td>{assignment.section_name}</td>
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
