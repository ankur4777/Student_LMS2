"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";

import "../../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ParentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface Child {
  student_profile_id: number;
  student_user_id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  admission_number: string;
  roll_number: string;
  enrollment_id: number | null;
  class_id: number | null;
  section_id: number | null;
  academic_session_id: number | null;
  classroom_name: string;
  section_name: string;
  academic_session_name: string;
  relationship: string;
}

function savedParent(): ParentUser {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("parent_user") || "{}");
  } catch {
    return {};
  }
}

function value(value?: string | null) {
  return value || "-";
}

function relationshipLabel(value: string) {
  return (value || "guardian")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ParentChildDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [parent] = useState<ParentUser>(savedParent);
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("parent_access_token");

    if (!token) {
      router.replace("/parent/login");
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/parent/children/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("parent_access_token");
          localStorage.removeItem("parent_refresh_token");
          localStorage.removeItem("parent_user");
          router.replace("/parent/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load child details.");
        }

        const found = (result.children || []).find(
          (item: Child) =>
            String(item.student_profile_id) === String(params.id)
        );

        if (!found) {
          throw new Error("This student is not linked to your account.");
        }

        if (active) setChild(found);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load child details."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [params.id, router]);

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
                <div className="text-uppercase text-danger fw-bold small mb-1">
                  Linked Student
                </div>
                <h2 className="fw-bold mb-1">Student Details</h2>
                <p className="text-muted mb-0">
                  Review your child&apos;s profile and academic information.
                </p>
              </div>

              <Link className="btn btn-outline-secondary" href="/parent/children">
                Back
              </Link>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading student details...
                </div>
              </div>
            ) : child ? (
              <>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                      <div>
                        <h3 className="fw-bold mb-1">{child.name}</h3>
                        <div className="text-muted">@{child.username}</div>
                      </div>
                      <span className="badge bg-primary">
                        {relationshipLabel(child.relationship)}
                      </span>
                    </div>

                    <div className="row g-4">
                      <div className="col-md-4">
                        <div className="text-muted small">Admission Number</div>
                        <div className="fw-semibold">{value(child.admission_number)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Roll Number</div>
                        <div className="fw-semibold">{value(child.roll_number)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Academic Session</div>
                        <div className="fw-semibold">{value(child.academic_session_name)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Class</div>
                        <div className="fw-semibold">{value(child.classroom_name)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Section</div>
                        <div className="fw-semibold">{value(child.section_name)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Relationship</div>
                        <div className="fw-semibold">{relationshipLabel(child.relationship)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Email</div>
                        <div className="fw-semibold text-break">{value(child.email)}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="text-muted small">Phone</div>
                        <div className="fw-semibold">{value(child.phone)}</div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted small">Address</div>
                        <div className="fw-semibold">{value(child.address)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">
                    <h5 className="fw-bold mb-3">Open Student Records</h5>
                    <div className="d-flex flex-wrap gap-2">
                      <Link className="btn btn-outline-primary" href="/parent/attendance">
                        Attendance
                      </Link>
                      <Link className="btn btn-outline-primary" href="/parent/assignments">
                        Assignments
                      </Link>
                      <Link className="btn btn-outline-primary" href="/parent/results">
                        Results
                      </Link>
                      <Link className="btn btn-outline-primary" href="/parent/fees">
                        Fees
                      </Link>
                      <Link className="btn btn-outline-primary" href="/parent/documents">
                        Documents
                      </Link>
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
