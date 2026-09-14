"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface StudentProfile {
  admission_number: string;
  phone: string;
  date_of_birth: string | null;
  admission_date: string | null;
}

interface Student {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  is_active: boolean;
  date_joined: string;
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

function formatValue(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value;
}

export default function CollegeAdminStudentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadStudent = async () => {
      const token = localStorage.getItem("college_admin_access_token");

      if (!token) {
        router.replace("/college-admin/login");
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/college-admin/students/${params.id}/`,
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
            result?.detail || "Unable to load student."
          );
        }

        if (isMounted) {
          setStudent(result.student || null);
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

    void loadStudent();

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
                <h2 className="fw-bold mb-1">
                  Student Details
                </h2>
                <p className="text-muted mb-0">
                  View student account and profile information.
                </p>
              </div>

              {student && (
                <Link
                  className="btn btn-primary"
                  href={`/college-admin/students/${student.id}/edit`}
                >
                  Edit
                </Link>
              )}
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading student...
                </div>
              </div>
            ) : student ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Account Information
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Name</div>
                        <div className="fw-semibold">{student.name}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Username</div>
                        <div className="fw-semibold">{student.username}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Email</div>
                        <div className="fw-semibold">
                          {formatValue(student.email)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Status</div>
                        <span
                          className={
                            student.is_active
                              ? "badge bg-success"
                              : "badge bg-secondary"
                          }
                        >
                          {student.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-4">
                      Student Profile
                    </h5>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">
                          Admission Number
                        </div>
                        <div className="fw-semibold">
                          {formatValue(student.profile?.admission_number)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Phone</div>
                        <div className="fw-semibold">
                          {formatValue(student.profile?.phone)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">
                          Date of Birth
                        </div>
                        <div className="fw-semibold">
                          {formatValue(student.profile?.date_of_birth)}
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">
                          Admission Date
                        </div>
                        <div className="fw-semibold">
                          {formatValue(student.profile?.admission_date)}
                        </div>
                      </div>
                    </div>
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
