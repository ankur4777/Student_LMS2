"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import StudentFeatureRestricted, {
  isClassFeatureRestricted,
} from "@/components/student/StudentFeatureRestricted";
import StudentIcon from "@/components/student/StudentIcon";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import { useCurrency } from "@/hooks/useCurrency";

import "../dashboard/dashboard.css";
import "./fees.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type FeeInstallment = {
  id: number;
  name: string;
  amount: string;
  paid_amount: string;
  outstanding_amount: string;
  due_date: string;
  status: string;
};

type FeePayment = {
  id: number;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  installment?: { name: string } | null;
};

type Fee = {
  id: number;
  payable_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  due_date: string;
  status: string;
  fee_structure: { name: string };
  academic_session: { name: string };
  installments?: FeeInstallment[];
  payments?: FeePayment[];
};

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

function getSavedStudent(): StudentUser {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(
      localStorage.getItem("student_user") || "{}"
    );
  } catch {
    return {};
  }
}

function statusLabel(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(value: string) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "paid") return "is-paid";
  if (normalized === "overdue") return "is-overdue";
  if (normalized === "partially_paid") return "is-partial";

  return "is-pending";
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StudentFeesPage() {
  const router = useRouter();
  const [student] = useState<StudentUser>(getSavedStudent);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payFee, setPayFee] = useState<Fee | null>(null);
  const [proofAmount, setProofAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const { formatCurrency: money } = useCurrency();

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    async function loadFees() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE}/api/fees/student/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return;
        }

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "Fees are temporarily unavailable. Please refresh the page."
          );
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.detail || "Unable to load fees."
          );
        }

        setFees(result.student_fees || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load fees."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadFees();
  }, [router]);

  const totals = useMemo(
    () =>
      fees.reduce(
        (summary, fee) => ({
          payable:
            summary.payable +
            Number(fee.payable_amount || 0),
          paid:
            summary.paid +
            Number(fee.paid_amount || 0),
          pending:
            summary.pending +
            Number(fee.outstanding_amount || 0),
        }),
        {
          payable: 0,
          paid: 0,
          pending: 0,
        }
      ),
    [fees]
  );

  const downloadPdf = async (
    path: string,
    filename: string
  ) => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API_BASE}${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          data.detail || "Unable to download document."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to download document."
      );
    }
  };

  const submitPaymentProof = async () => {
    if (!payFee || !proofFile || !proofAmount) {
      setError("Enter the amount and select a payment proof document.");
      return;
    }

    const token = localStorage.getItem("student_access_token");
    if (!token) {
      router.replace("/student/login");
      return;
    }

    setSubmittingProof(true);
    setError("");
    setProofMessage("");

    try {
      const formData = new FormData();
      formData.append("amount", proofAmount);
      formData.append("proof_document", proofFile);

      const response = await fetch(
        `${API_BASE}/api/fees/student/${payFee.id}/payment-proof/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unable to submit payment proof.");
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || "Unable to submit payment proof.");
      }

      setProofMessage(
        "Payment proof submitted successfully. Waiting for college verification."
      );
      setPayFee(null);
      setProofFile(null);
      setProofAmount("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit payment proof."
      );
    } finally {
      setSubmittingProof(false);
    }
  };

  const featureRestricted =
    isClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={
            student.name ||
            student.username ||
            "Student"
          }
          organization={student.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            {featureRestricted ? (
              <StudentFeatureRestricted featureName="Fees" />
            ) : (
              <div className="student-fees-page">
                <section className="student-fees-header">
                  <div>
                    <div className="student-fees-kicker">
                      STUDENT PORTAL
                    </div>
                    <h1>My Fees</h1>
                    <p>
                      Review your fee balance, installments,
                      payments and receipts.
                    </p>
                  </div>

                  <span className="student-fees-header-icon">
                    <StudentIcon name="fees" size={22} />
                  </span>
                </section>

                {error && (
                  <div className="alert alert-danger">
                    {error}
                  </div>
                )}

                {proofMessage && (
                  <div className="alert alert-success">
                    {proofMessage}
                  </div>
                )}

                {loading ? (
                  <section className="student-fees-card">
                    <div className="student-fees-loading">
                      Loading fee details...
                    </div>
                  </section>
                ) : !error ? (
                  <>
                    <section className="student-fees-summary">
                      <article className="student-fees-summary-card">
                        <span className="student-fees-summary-icon">
                          <StudentIcon name="fees" size={20} />
                        </span>
                        <div>
                          <span>Total Payable</span>
                          <strong>{money(totals.payable)}</strong>
                          <small>
                            Total fee assigned to you
                          </small>
                        </div>
                      </article>

                      <article className="student-fees-summary-card is-paid">
                        <span className="student-fees-summary-icon">
                          <StudentIcon name="fees" size={20} />
                        </span>
                        <div>
                          <span>Total Paid</span>
                          <strong>{money(totals.paid)}</strong>
                          <small>
                            Payments recorded so far
                          </small>
                        </div>
                      </article>

                      <article className="student-fees-summary-card is-pending">
                        <span className="student-fees-summary-icon">
                          <StudentIcon name="clock" size={20} />
                        </span>
                        <div>
                          <span>Total Pending</span>
                          <strong>{money(totals.pending)}</strong>
                          <small>
                            Remaining outstanding balance
                          </small>
                        </div>
                      </article>
                    </section>

                    {fees.length === 0 ? (
                      <section className="student-fees-card">
                        <div className="student-fees-empty">
                          <span className="student-fees-empty-icon">
                            <StudentIcon name="fees" size={24} />
                          </span>
                          <strong>No fees assigned yet</strong>
                          <p>
                            Fee details will appear here once
                            your college assigns them.
                          </p>
                        </div>
                      </section>
                    ) : (
                      <section className="student-fees-list">
                        {fees.map((fee) => (
                          <article
                            className="student-fees-card"
                            key={fee.id}
                          >
                            <header className="student-fee-card-header">
                              <div>
                                <span className="student-fee-session">
                                  {fee.academic_session?.name ||
                                    "Academic session"}
                                </span>
                                <h2>
                                  {fee.fee_structure?.name ||
                                    "Fee"}
                                </h2>
                              </div>

                              <div className="student-fee-header-actions">
                                <span
                                  className={`student-fee-status ${statusTone(
                                    fee.status
                                  )}`}
                                >
                                  {statusLabel(fee.status)}
                                </span>

                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() =>
                                    void downloadPdf(
                                      `/api/fees/documents/invoice/${fee.id}/`,
                                      `fee-invoice-${fee.id}.pdf`
                                    )
                                  }
                                >
                                  Download Invoice
                                </button>

                                {Number(fee.outstanding_amount) > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                      setPayFee(fee);
                                      setProofAmount(fee.outstanding_amount);
                                      setProofFile(null);
                                      setError("");
                                    }}
                                  >
                                    Pay Fee
                                  </button>
                                )}
                              </div>
                            </header>

                            <div className="student-fee-overview">
                              <div>
                                <span>Due Date</span>
                                <strong>
                                  {formatDate(fee.due_date)}
                                </strong>
                              </div>
                              <div>
                                <span>Payable</span>
                                <strong>
                                  {money(fee.payable_amount)}
                                </strong>
                              </div>
                              <div>
                                <span>Paid</span>
                                <strong>
                                  {money(fee.paid_amount)}
                                </strong>
                              </div>
                              <div>
                                <span>Pending</span>
                                <strong>
                                  {money(
                                    fee.outstanding_amount
                                  )}
                                </strong>
                              </div>
                            </div>

                            <div className="student-fees-section">
                              <div className="student-fees-section-heading">
                                <div>
                                  <h3>Installments</h3>
                                  <p>
                                    Scheduled fee payments and
                                    their current status.
                                  </p>
                                </div>
                                <span>
                                  {fee.installments?.length || 0}
                                </span>
                              </div>

                              <div className="table-responsive student-fees-table-wrap">
                                <table className="table align-middle student-fees-table">
                                  <thead>
                                    <tr>
                                      <th>Name</th>
                                      <th>Amount</th>
                                      <th>Paid</th>
                                      <th>Pending</th>
                                      <th>Due Date</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {fee.installments?.length ? (
                                      fee.installments.map(
                                        (installment) => (
                                          <tr
                                            key={
                                              installment.id
                                            }
                                          >
                                            <td>
                                              <strong>
                                                {
                                                  installment.name
                                                }
                                              </strong>
                                            </td>
                                            <td>
                                              {money(
                                                installment.amount
                                              )}
                                            </td>
                                            <td>
                                              {money(
                                                installment.paid_amount
                                              )}
                                            </td>
                                            <td>
                                              {money(
                                                installment.outstanding_amount
                                              )}
                                            </td>
                                            <td>
                                              {formatDate(
                                                installment.due_date
                                              )}
                                            </td>
                                            <td>
                                              <span
                                                className={`student-fee-status ${statusTone(
                                                  installment.status
                                                )}`}
                                              >
                                                {statusLabel(
                                                  installment.status
                                                )}
                                              </span>
                                            </td>
                                          </tr>
                                        )
                                      )
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="student-fees-table-empty"
                                        >
                                          No installments
                                          configured.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="student-fees-section">
                              <div className="student-fees-section-heading">
                                <div>
                                  <h3>Payment History</h3>
                                  <p>
                                    Payments recorded against
                                    this fee.
                                  </p>
                                </div>
                                <span>
                                  {fee.payments?.length || 0}
                                </span>
                              </div>

                              <div className="table-responsive student-fees-table-wrap">
                                <table className="table align-middle student-fees-table">
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Amount</th>
                                      <th>Method</th>
                                      <th>Installment</th>
                                      <th>Reference</th>
                                      <th>Receipt</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {fee.payments?.length ? (
                                      fee.payments.map(
                                        (payment) => (
                                          <tr key={payment.id}>
                                            <td>
                                              {formatDate(
                                                payment.payment_date
                                              )}
                                            </td>
                                            <td>
                                              <strong>
                                                {money(
                                                  payment.amount
                                                )}
                                              </strong>
                                            </td>
                                            <td>
                                              {statusLabel(
                                                payment.payment_method
                                              )}
                                            </td>
                                            <td>
                                              {payment.installment
                                                ?.name ||
                                                "General"}
                                            </td>
                                            <td>
                                              {payment.reference_number ||
                                                "-"}
                                            </td>
                                            <td>
                                              <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() =>
                                                  void downloadPdf(
                                                    `/api/fees/documents/receipt/${payment.id}/`,
                                                    `fee-receipt-${payment.id}.pdf`
                                                  )
                                                }
                                              >
                                                Download
                                              </button>
                                            </td>
                                          </tr>
                                        )
                                      )
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={6}
                                          className="student-fees-table-empty"
                                        >
                                          No payments recorded.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </article>
                        ))}
                      </section>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {payFee && (
              <>
                <div
                  className="modal fade show d-block"
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                      <div className="modal-header">
                        <div>
                          <h5 className="modal-title">Submit Fee Payment Proof</h5>
                          <small className="text-muted">
                            {payFee.fee_structure?.name || "Fee"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn-close"
                          aria-label="Close"
                          onClick={() => setPayFee(null)}
                        />
                      </div>
                      <div className="modal-body">
                        <div className="mb-3">
                          <label className="form-label">Amount Paid</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={payFee.outstanding_amount}
                            className="form-control"
                            value={proofAmount}
                            onChange={(event) =>
                              setProofAmount(event.target.value)
                            }
                          />
                          <div className="form-text">
                            Pending balance: {money(payFee.outstanding_amount)}
                          </div>
                        </div>
                        <div>
                          <label className="form-label">
                            Payment Proof
                          </label>
                          <input
                            type="file"
                            className="form-control"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                            onChange={(event) =>
                              setProofFile(
                                event.target.files?.[0] || null
                              )
                            }
                          />
                          <div className="form-text">
                            Upload PDF, JPG, PNG or WEBP. Maximum 5 MB.
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setPayFee(null)}
                          disabled={submittingProof}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => void submitPaymentProof()}
                          disabled={
                            submittingProof ||
                            !proofFile ||
                            !proofAmount
                          }
                        >
                          {submittingProof
                            ? "Submitting..."
                            : "Submit Proof"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-backdrop fade show" />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
