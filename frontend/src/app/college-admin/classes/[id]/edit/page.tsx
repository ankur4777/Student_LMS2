"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

interface ClassRoom {
  id: number;
  name: string;
  academic_session_id: number;
  academic_session: string;
  roll_number_prefix: string;
  roll_number_digits: number;
  roll_number_start: number;
}

interface AcademicSession {
  id: number;
  name: string;
  is_active: boolean;
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

export default function EditClassPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [classroom, setClassroom] = useState<ClassRoom | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [name, setName] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState("");
  const [rollNumberPrefix, setRollNumberPrefix] = useState("");
  const [rollNumberDigits, setRollNumberDigits] = useState("4");
  const [rollNumberStart, setRollNumberStart] = useState("1");
  const [prefixOptions, setPrefixOptions] = useState<string[]>([]);
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

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const token = getToken();
      if (!token) {
        return;
      }

      try {
        const [classResponse, sessionsResponse, classesResponse] =
          await Promise.all([
            fetch(
              `${API_BASE}/api/academics/college-admin/classes/${params.id}/`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            ),
            fetch(
              `${API_BASE}/api/academics/college-admin/academic-sessions/`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            ),
            fetch(
              `${API_BASE}/api/academics/college-admin/classes/`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            ),
          ]);

        if (classResponse.status === 401 || sessionsResponse.status === 401) {
          clearSession();
          router.replace("/college-admin/login");
          return;
        }

        const classResult = await classResponse.json();
        const sessionsResult = await sessionsResponse.json();
        const classesResult = await classesResponse.json();

        if (!classResponse.ok) {
          throw new Error(classResult?.detail || "Unable to load class.");
        }

        if (!sessionsResponse.ok) {
          throw new Error(
            sessionsResult?.detail || "Unable to load academic sessions."
          );
        }

        if (!classesResponse.ok) {
          throw new Error(
            classesResult?.detail || "Unable to load roll number settings."
          );
        }

        const current = classResult.class as ClassRoom;

        if (isMounted) {
          setClassroom(current);
          setName(current.name);
          setAcademicSessionId(String(current.academic_session_id));
          setRollNumberPrefix(current.roll_number_prefix || "");
          setRollNumberDigits(String(current.roll_number_digits || 4));
          setRollNumberStart(String(current.roll_number_start || 1));
          setPrefixOptions(classesResult.roll_number_prefixes || []);
          setSessions(sessionsResult.academic_sessions || []);
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

    void load();

    return () => {
      isMounted = false;
    };
  }, [clearSession, getToken, params.id, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const token = getToken();
    if (!token) {
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/academics/college-admin/classes/${params.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            academic_session_id: academicSessionId,
            roll_number_prefix: rollNumberPrefix,
            roll_number_digits: Number(rollNumberDigits),
            roll_number_start: Number(rollNumberStart),
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
        setError(result?.detail || "Unable to update class.");
        return;
      }

      router.replace("/college-admin/classes");
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
              <h2 className="fw-bold mb-1">Edit Class</h2>
              <p className="text-muted mb-0">
                Update class, academic session, and roll number settings.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading class...
                </div>
              </div>
            ) : classroom ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Class</label>
                        <input
                          className="form-control"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Academic Session</label>
                        <select
                          className="form-select"
                          value={academicSessionId}
                          onChange={(event) =>
                            setAcademicSessionId(event.target.value)
                          }
                          required
                        >
                          <option value="">Select academic session</option>
                          {sessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {session.name}
                              {session.is_active ? " (Active)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Roll Number Prefix
                        </label>
                        <input
                          className="form-control"
                          list="roll-prefix-options"
                          value={rollNumberPrefix}
                          onChange={(event) =>
                            setRollNumberPrefix(
                              event.target.value.toUpperCase()
                            )
                          }
                          maxLength={20}
                          required
                        />
                        <datalist id="roll-prefix-options">
                          {prefixOptions.map((prefix) => (
                            <option key={prefix} value={prefix} />
                          ))}
                        </datalist>
                        <div className="form-text">
                          Select an existing prefix or type a new one for this class.
                        </div>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Number Digits</label>
                        <input
                          className="form-control"
                          type="number"
                          min="1"
                          max="10"
                          value={rollNumberDigits}
                          onChange={(event) =>
                            setRollNumberDigits(event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Starting Number</label>
                        <input
                          className="form-control"
                          type="number"
                          min="1"
                          value={rollNumberStart}
                          onChange={(event) =>
                            setRollNumberStart(event.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="col-12">
                        <div className="alert alert-light border mb-0">
                          Roll number preview:{" "}
                          <strong>
                            {rollNumberPrefix || "ROLL"}-
                            {String(
                              Math.max(1, Number(rollNumberStart) || 1)
                            ).padStart(
                              Math.max(
                                1,
                                Math.min(
                                  10,
                                  Number(rollNumberDigits) || 4
                                )
                              ),
                              "0"
                            )}
                          </strong>
                        </div>
                      </div>
                      <div className="col-12 d-flex gap-2">
                        <button
                          className="btn btn-primary"
                          type="submit"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => router.push("/college-admin/classes")}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
