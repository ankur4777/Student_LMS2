"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ParentFeatureRestricted, {
  isParentClassFeatureRestricted,
} from "@/components/parent/ParentFeatureRestricted";
import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type ParentUser = {
  username?: string;
  name?: string;
  organization?: string;
};

type Child = {
  student_profile_id: number;
  name: string;
  classroom_name: string;
  section_name: string;
  roll_number: string;
};

type DocumentItem = {
  id: number;
  title: string;
  description: string;
  document_type: string;
  created_at: string;
  subject_name: string;
  teacher_name: string;
  classroom_name: string;
  section_name: string;
  filename: string;
};

function getSavedParent(): ParentUser {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem("parent_user") || "{}");
  } catch {
    return {};
  }
}

function formatType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export default function ParentDocumentsPage() {
  const router = useRouter();
  const [parent] = useState<ParentUser>(getSavedParent);
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const clearSession = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
  };

  const fetchJson = async (url: string) => {
    const token = localStorage.getItem("parent_access_token");

    if (!token) {
      router.replace("/parent/login");
      throw new Error("Unauthorized");
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      clearSession();
      router.replace("/parent/login");
      throw new Error("Unauthorized");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.detail || "Unable to load documents.");
    }

    return result;
  };

  const loadDocuments = async (studentId: string) => {
    if (!studentId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await fetchJson(
        `${API_BASE}/api/documents/parent/student/${studentId}/`
      );
      setDocuments(result.documents || []);
    } catch (err) {
      setDocuments([]);
      if (err instanceof Error && err.message !== "Unauthorized") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/parent/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.detail || "Unable to load children.");
        }

        if (!active) {
          return;
        }

        const childList = (result.children || []) as Child[];
        setChildren(childList);

        if (childList.length) {
          const studentId = String(childList[0].student_profile_id);
          setSelected(studentId);
          await loadDocuments(studentId);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (
          active &&
          err instanceof Error &&
          err.message !== "Unauthorized"
        ) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const downloadDocument = async (document: DocumentItem) => {
    const token = localStorage.getItem("parent_access_token");

    if (!token || !selected) {
      router.replace("/parent/login");
      return;
    }

    setDownloadingId(document.id);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/documents/parent/student/${selected}/${document.id}/download/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/parent/login");
        return;
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const result = await response.json().catch(() => ({}));
          throw new Error(
            result?.detail || "Unable to download document."
          );
        }
        throw new Error("Unable to download document.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.filename || document.title;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const selectedChild = children.find(
    (child) => String(child.student_profile_id) === selected
  );
  const featureRestricted = isParentClassFeatureRestricted(error);

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
            <div className="mb-4">
              <h2 className="fw-bold mb-1">Documents</h2>
              <p className="text-muted mb-0">
                View published class documents for your linked child.
              </p>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <label className="form-label fw-semibold">
                  Select Child
                </label>

                <select
                  className="form-select"
                  value={selected}
                  onChange={(event) => {
                    const studentId = event.target.value;
                    setSelected(studentId);
                    void loadDocuments(studentId);
                  }}
                  disabled={!children.length}
                >
                  {!children.length && (
                    <option value="">No linked children</option>
                  )}
                  {children.map((child) => (
                    <option
                      key={child.student_profile_id}
                      value={child.student_profile_id}
                    >
                      {child.name} - {child.classroom_name} /{" "}
                      {child.section_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && !featureRestricted && (
              <div className="alert alert-danger">{error}</div>
            )}

            {featureRestricted ? (
              <ParentFeatureRestricted
                featureName="Documents"
                childName={selectedChild?.name}
              />
            ) : loading ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center text-muted">
                  Loading documents...
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-5 text-center">
                  <h5 className="fw-bold">No Documents</h5>
                  <p className="text-muted mb-0">
                    No published documents are available for this child.
                  </p>
                </div>
              </div>
            ) : (
              <div className="row g-3">
                {documents.map((document) => (
                  <div className="col-lg-6" key={document.id}>
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <h5 className="fw-bold mb-1">
                              {document.title}
                            </h5>
                            <div className="text-muted small">
                              {formatType(document.document_type)} ·{" "}
                              {document.subject_name}
                            </div>
                          </div>
                        </div>

                        <div className="small mb-2">
                          Teacher: {document.teacher_name || "-"}
                        </div>
                        <div className="small mb-2">
                          Class / Section: {document.classroom_name} /{" "}
                          {document.section_name}
                        </div>
                        <div className="small mb-2">
                          File: {document.filename || "-"}
                        </div>
                        <div className="small text-muted mb-3">
                          Uploaded: {formatDate(document.created_at)}
                        </div>

                        {document.description && (
                          <p className="text-muted">
                            {document.description}
                          </p>
                        )}

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={downloadingId === document.id}
                          onClick={() => void downloadDocument(document)}
                        >
                          {downloadingId === document.id
                            ? "Downloading..."
                            : "View / Download"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
