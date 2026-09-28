"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface ClassRoom {
  id: number;
  name: string;
  academic_session: string;
}

interface FeatureAccess {
  key: string;
  label: string;
  enabled: boolean;
}

function getSavedAdmin(): AdminUser {
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

export default function CollegeAdminClassFeatureAccessPage() {
  const router = useRouter();
  const [admin] = useState<AdminUser>(getSavedAdmin);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [features, setFeatures] = useState<FeatureAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const clearSession = useCallback(() => {
    localStorage.removeItem("college_admin_access_token");
    localStorage.removeItem("college_admin_refresh_token");
    localStorage.removeItem("college_admin_user");
  }, []);

  const request = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = localStorage.getItem("college_admin_access_token");

      if (!token) {
        router.replace("/college-admin/login");
        throw new Error("Unauthorized");
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
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
          result?.detail || "Unable to manage class feature access."
        );
      }

      return result;
    },
    [clearSession, router]
  );

  const loadFeatureAccess = useCallback(
    async (classId: string) => {
      if (!classId) {
        setFeatures([]);
        return;
      }

      const url = new URL(
        `${API_BASE}/api/academics/college-admin/class-feature-access/`
      );
      url.searchParams.set("class_id", classId);

      const result = await request(url.toString());
      setFeatures(result.features || []);
    },
    [request]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError("");
        const result = await request(
          `${API_BASE}/api/academics/college-admin/classes/`
        );

        if (!active) {
          return;
        }

        const classList: ClassRoom[] = result.classes || [];
        setClasses(classList);

        if (classList.length > 0) {
          const firstClassId = String(classList[0].id);
          setSelectedClassId(firstClassId);
          await loadFeatureAccess(firstClassId);
        }
      } catch (err) {
        if (
          active &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadFeatureAccess, request]);

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId);
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await loadFeatureAccess(classId);
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (featureKey: string) => {
    setFeatures((current) =>
      current.map((feature) =>
        feature.key === featureKey
          ? { ...feature, enabled: !feature.enabled }
          : feature
      )
    );
    setMessage("");
  };

  const saveAccess = async () => {
    if (!selectedClassId) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const featureMap = Object.fromEntries(
        features.map((feature) => [feature.key, feature.enabled])
      );

      const result = await request(
        `${API_BASE}/api/academics/college-admin/class-feature-access/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            class_id: Number(selectedClassId),
            features: featureMap,
          }),
        }
      );

      setFeatures(result.features || []);
      setMessage(
        result.message || "Class feature access updated successfully."
      );
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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Class Feature Access</h2>
              <p className="text-muted mb-0">
                Allow or restrict student features for an entire class.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <label className="form-label fw-semibold">
                  Select Class
                </label>
                <select
                  className="form-select"
                  value={selectedClassId}
                  onChange={(event) =>
                    void handleClassChange(event.target.value)
                  }
                  disabled={classes.length === 0}
                >
                  {classes.length === 0 ? (
                    <option value="">No classes available</option>
                  ) : (
                    classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - {item.academic_session}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading feature access...
                </div>
              </div>
            ) : classes.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Classes</h5>
                  <p className="text-muted mb-0">
                    Create a class before configuring feature access.
                  </p>
                </div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
                    <div>
                      <h5 className="fw-bold mb-1">Student Features</h5>
                      <p className="text-muted mb-0">
                        Disabled features are hidden from students in this
                        class and blocked by the backend API.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void saveAccess()}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Access"}
                    </button>
                  </div>

                  <div className="row g-3">
                    {features.map((feature) => (
                      <div className="col-md-6 col-xl-4" key={feature.key}>
                        <div className="border rounded-3 p-3 h-100 d-flex justify-content-between align-items-center gap-3">
                          <div>
                            <div className="fw-semibold">{feature.label}</div>
                            <small className="text-muted">
                              {feature.enabled ? "Allowed" : "Restricted"}
                            </small>
                          </div>

                          <div className="form-check form-switch m-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              aria-label={`Toggle ${feature.label}`}
                              checked={feature.enabled}
                              onChange={() => toggleFeature(feature.key)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
