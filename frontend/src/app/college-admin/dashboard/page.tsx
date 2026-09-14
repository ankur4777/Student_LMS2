"use client";

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
  active_student_enrollments: number;
  active_teacher_assignments: number;
}

interface DashboardData {
  organization: OrganizationInfo;
  summary: Summary;
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
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
