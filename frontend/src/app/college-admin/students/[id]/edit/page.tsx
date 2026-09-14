"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../../teacher/dashboard/dashboard.css";

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
  first_name: string;
  last_name: string;
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

export default function CollegeAdminEditStudentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [isActive, setIsActive] = useState(true);

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

  useEffect(() => {
    let isMounted = true;

    const loadStudent = async () => {
      const token = getToken();

      if (!token) {
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

        const student = result.student as Student;

        if (isMounted) {
          setFirstName(student.first_name || "");
          setLastName(student.last_name || "");
          setUsername(student.username || "");
          setEmail(student.email || "");
          setPhone(student.profile?.phone || "");
          setAdmissionNumber(
            student.profile?.admission_number || ""
          );
          setDateOfBirth(student.profile?.date_of_birth || "");
          setAdmissionDate(student.profile?.admission_date || "");
          setIsActive(student.is_active);
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
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/students/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            username,
            email,
            phone,
            admission_number: admissionNumber,
            date_of_birth: dateOfBirth || null,
            admission_date: admissionDate || null,
            is_active: isActive,
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
        setError(result?.detail || "Unable to update student.");
        return;
      }

      router.replace(`/college-admin/students/${params.id}`);
    } catch {
      setError("Unable to connect to the server.");
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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">
                Edit Student
              </h2>
              <p className="text-muted mb-0">
                Update safe student account and profile fields.
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
                  Loading student...
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">First Name</label>
                        <input
                          className="form-control"
                          value={firstName}
                          onChange={(event) =>
                            setFirstName(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Last Name</label>
                        <input
                          className="form-control"
                          value={lastName}
                          onChange={(event) =>
                            setLastName(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Username</label>
                        <input
                          className="form-control"
                          value={username}
                          onChange={(event) =>
                            setUsername(event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Email</label>
                        <input
                          className="form-control"
                          type="email"
                          value={email}
                          onChange={(event) =>
                            setEmail(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Admission Number
                        </label>
                        <input
                          className="form-control"
                          value={admissionNumber}
                          onChange={(event) =>
                            setAdmissionNumber(event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Phone</label>
                        <input
                          className="form-control"
                          value={phone}
                          onChange={(event) =>
                            setPhone(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Date of Birth
                        </label>
                        <input
                          className="form-control"
                          type="date"
                          value={dateOfBirth}
                          onChange={(event) =>
                            setDateOfBirth(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Admission Date
                        </label>
                        <input
                          className="form-control"
                          type="date"
                          value={admissionDate}
                          onChange={(event) =>
                            setAdmissionDate(event.target.value)
                          }
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            id="is-active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) =>
                              setIsActive(event.target.checked)
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="is-active"
                          >
                            Active student account
                          </label>
                        </div>
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            router.push(
                              `/college-admin/students/${params.id}`
                            )
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
