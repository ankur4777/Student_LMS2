"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../../teacher/dashboard/dashboard.css";

interface CollegeAdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

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

export default function CollegeAdminCreateStudentPage() {
  const router = useRouter();

  const [admin] = useState<CollegeAdminUser>(getSavedAdmin);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/accounts/college-admin/students/`,
        {
          method: "POST",
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
            password,
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
        setError(result?.detail || "Unable to create student.");
        return;
      }

      router.replace("/college-admin/students");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
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
                Add Student
              </h2>

              <p className="text-muted mb-0">
                Create a student account for your institution.
              </p>
            </div>

            {error && (
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        First Name
                      </label>
                      <input
                        className="form-control"
                        value={firstName}
                        onChange={(event) =>
                          setFirstName(event.target.value)
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Last Name
                      </label>
                      <input
                        className="form-control"
                        value={lastName}
                        onChange={(event) =>
                          setLastName(event.target.value)
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Username
                      </label>
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
                      <label className="form-label">
                        Email
                      </label>
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
                      <label className="form-label">
                        Phone
                      </label>
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

                    <div className="col-md-6">
                      <label className="form-label">
                        Password
                      </label>
                      <input
                        className="form-control"
                        type="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Confirm Password
                      </label>
                      <input
                        className="form-control"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="col-12 d-flex gap-2">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                      >
                        {loading ? "Creating..." : "Create Student"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() =>
                          router.push("/college-admin/students")
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
