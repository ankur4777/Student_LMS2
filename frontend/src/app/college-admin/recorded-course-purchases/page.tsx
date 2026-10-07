"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import { useCurrency } from "@/hooks/useCurrency";

import "../../teacher/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type StudentSummary = {
  id: number;
  name: string;
  admission_number: string;
};

type CoursePurchase = {
  id: number;
  course: {
    id: number;
    title: string;
  };
  student: StudentSummary;
  buyer_type: string;
  amount: string;
  status: string;
  payment_method: string;
  payment_reference: string;
  paid_at: string | null;
  created_at: string;
};

type ClassPurchase = {
  id: number;
  recording: {
    id: number;
    public_id: string;
    title: string;
    live_class_title: string;
    class_date: string;
    subject_name: string;
  };
  student: StudentSummary;
  buyer_type: string;
  amount: string;
  status: string;
  payment_method: string;
  payment_reference: string;
  paid_at: string | null;
  created_at: string;
};

type VerifyTarget =
  | {
      type: "course";
      id: number;
      title: string;
    }
  | {
      type: "class";
      id: number;
      title: string;
    };

function purchaseBadge(status: string) {
  if (status === "paid") {
    return "badge bg-success";
  }
  if (status === "pending") {
    return "badge bg-warning text-dark";
  }
  return "badge bg-secondary";
}

export default function RecordedContentPurchasesPage() {
  const router = useRouter();
  const [admin] = useState<any>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("college_admin_user") || "{}"
      );
    } catch {
      return {};
    }
  });

  const [coursePurchases, setCoursePurchases] = useState<CoursePurchase[]>([]);
  const [classPurchases, setClassPurchases] = useState<ClassPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const { formatCurrency: money } = useCurrency();

  const load = useCallback(async () => {
    const token = localStorage.getItem("college_admin_access_token");

    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [courseResponse, classResponse] = await Promise.all([
        fetch(
          `${API_BASE}/api/recorded-courses/college-admin/purchases/`,
          { headers, cache: "no-store" }
        ),
        fetch(
          `${API_BASE}/api/recorded-courses/college-admin/recorded-class-purchases/`,
          { headers, cache: "no-store" }
        ),
      ]);

      if (courseResponse.status === 401 || classResponse.status === 401) {
        router.replace("/college-admin/login");
        return;
      }

      const [courseResult, classResult] = await Promise.all([
        courseResponse.json().catch(() => ({})),
        classResponse.json().catch(() => ({})),
      ]);

      if (!courseResponse.ok) {
        throw new Error(
          courseResult?.detail || "Unable to load recorded course purchases."
        );
      }

      if (!classResponse.ok) {
        throw new Error(
          classResult?.detail || "Unable to load recorded class purchases."
        );
      }

      setCoursePurchases(courseResult.purchases || []);
      setClassPurchases(classResult.purchases || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load purchases."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(event: FormEvent) {
    event.preventDefault();

    if (!verifyTarget) {
      return;
    }

    const token = localStorage.getItem("college_admin_access_token");

    if (!token) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const endpoint =
        verifyTarget.type === "course"
          ? `${API_BASE}/api/recorded-courses/college-admin/purchases/${verifyTarget.id}/verify/`
          : `${API_BASE}/api/recorded-courses/college-admin/recorded-class-purchases/${verifyTarget.id}/verify/`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_method: method,
          payment_reference: reference,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            result?.payment_method ||
            "Unable to verify payment."
        );
      }

      setVerifyTarget(null);
      setReference("");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to verify payment."
      );
    } finally {
      setBusy(false);
    }
  }

  const pending =
    coursePurchases.filter((item) => item.status === "pending").length +
    classPurchases.filter((item) => item.status === "pending").length;

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
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
              <div>
                <h2 className="fw-bold mb-1">Recorded Content Purchases</h2>
                <p className="text-muted mb-0">
                  Verify payments before students receive access to recorded
                  courses or individual class recordings.
                </p>
              </div>
              <span className="badge bg-warning text-dark fs-6">
                {pending} Pending
              </span>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body border-bottom">
                <h5 className="fw-bold mb-1">Recorded Course Purchases</h5>
                <div className="text-muted small">
                  Purchases for complete recorded courses.
                </div>
              </div>

              <div className="table-responsive">
                {loading ? (
                  <div className="p-5 text-center text-muted">
                    Loading purchases...
                  </div>
                ) : coursePurchases.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    No recorded course purchases yet.
                  </div>
                ) : (
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Course</th>
                        <th>Buyer</th>
                        <th>Amount</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coursePurchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>
                            <div className="fw-semibold">
                              {purchase.student.name}
                            </div>
                            <small className="text-muted">
                              {purchase.student.admission_number || "-"}
                            </small>
                          </td>
                          <td>{purchase.course.title}</td>
                          <td className="text-capitalize">
                            {purchase.buyer_type}
                          </td>
                          <td>{money(purchase.amount)}</td>
                          <td>
                            {new Date(
                              purchase.created_at
                            ).toLocaleDateString()}
                          </td>
                          <td>
                            <span className={purchaseBadge(purchase.status)}>
                              {purchase.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {purchase.status === "pending" ? (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  setVerifyTarget({
                                    type: "course",
                                    id: purchase.id,
                                    title: purchase.course.title,
                                  });
                                  setMethod("cash");
                                  setReference("");
                                }}
                              >
                                Verify Payment
                              </button>
                            ) : (
                              <div>
                                <small>
                                  {purchase.payment_method || "Verified"}
                                </small>
                                {purchase.payment_reference && (
                                  <div className="text-muted small">
                                    {purchase.payment_reference}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body border-bottom">
                <h5 className="fw-bold mb-1">Recorded Class Purchases</h5>
                <div className="text-muted small">
                  Purchases for individual recordings uploaded after live
                  classes.
                </div>
              </div>

              <div className="table-responsive">
                {loading ? (
                  <div className="p-5 text-center text-muted">
                    Loading purchases...
                  </div>
                ) : classPurchases.length === 0 ? (
                  <div className="p-5 text-center text-muted">
                    No recorded class purchases yet.
                  </div>
                ) : (
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Recorded Class</th>
                        <th>Subject / Date</th>
                        <th>Amount</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classPurchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>
                            <div className="fw-semibold">
                              {purchase.student.name}
                            </div>
                            <small className="text-muted">
                              {purchase.student.admission_number || "-"}
                            </small>
                          </td>
                          <td>{purchase.recording.title}</td>
                          <td>
                            <div>{purchase.recording.subject_name}</div>
                            <small className="text-muted">
                              {purchase.recording.class_date}
                            </small>
                          </td>
                          <td>{money(purchase.amount)}</td>
                          <td>
                            {new Date(
                              purchase.created_at
                            ).toLocaleDateString()}
                          </td>
                          <td>
                            <span className={purchaseBadge(purchase.status)}>
                              {purchase.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {purchase.status === "pending" ? (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  setVerifyTarget({
                                    type: "class",
                                    id: purchase.id,
                                    title: purchase.recording.title,
                                  });
                                  setMethod("cash");
                                  setReference("");
                                }}
                              >
                                Verify Payment
                              </button>
                            ) : (
                              <div>
                                <small>
                                  {purchase.payment_method || "Verified"}
                                </small>
                                {purchase.payment_reference && (
                                  <div className="text-muted small">
                                    {purchase.payment_reference}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {verifyTarget && (
              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">
                    Verify Payment — {verifyTarget.title}
                  </h5>

                  <div className="alert alert-warning">
                    Confirm that payment has actually been received before
                    verifying. Verification immediately grants the student
                    access.
                  </div>

                  <form onSubmit={verify}>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label">Payment Method</label>
                        <select
                          className="form-select"
                          value={method}
                          onChange={(event) =>
                            setMethod(event.target.value)
                          }
                          required
                        >
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">
                            Bank Transfer
                          </option>
                          <option value="upi">UPI</option>
                          <option value="card">Card</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div className="col-md-5">
                        <label className="form-label">
                          Payment Reference
                        </label>
                        <input
                          className="form-control"
                          value={reference}
                          onChange={(event) =>
                            setReference(event.target.value)
                          }
                          placeholder="Receipt / UTR / transaction reference"
                        />
                      </div>

                      <div className="col-md-3 d-flex align-items-end gap-2">
                        <button
                          className="btn btn-success"
                          disabled={busy}
                        >
                          {busy
                            ? "Verifying..."
                            : "Confirm & Grant Access"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          disabled={busy}
                          onClick={() => setVerifyTarget(null)}
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
