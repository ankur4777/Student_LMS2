"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ParentFeatureRestricted, {
  isParentClassFeatureRestricted,
} from "@/components/parent/ParentFeatureRestricted";
import ParentSidebar from "@/components/parent/ParentSidebar";
import ParentTopbar from "@/components/parent/ParentTopbar";
import { useCurrency } from "@/hooks/useCurrency";

import "../../student/dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type Child = {
  student_profile_id: number;
  name: string;
  username: string;
  roll_number: string;
  classroom_name: string;
  section_name: string;
};

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

export default function ParentFeesPage() {
  const router = useRouter();
  const [parent, setParent] = useState<any>({});
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState("");
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [payFee, setPayFee] = useState<Fee | null>(null);
  const [proofAmount, setProofAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const { formatCurrency: money } = useCurrency();

  const clearSession = () => {
    localStorage.removeItem("parent_access_token");
    localStorage.removeItem("parent_refresh_token");
    localStorage.removeItem("parent_user");
  };

  const label = (value: string) =>
    value
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  const downloadPdf = async (path: string, filename: string) => {
    const token = localStorage.getItem("parent_access_token");
    if (!token) {
      router.replace("/parent/login");
      return;
    }

    setError("");

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to download document.");
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
        err instanceof Error ? err.message : "Unable to download document."
      );
    }
  };

  const loadFees = async (token: string, studentId: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/fees/parent/student/${studentId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/parent/login");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to load fees.");
      }

      setFees(data.student_fees || []);
    } catch (err) {
      setFees([]);
      setError(err instanceof Error ? err.message : "Unable to load fees.");
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

    try {
      setParent(JSON.parse(localStorage.getItem("parent_user") || "{}"));
    } catch {
      setParent({});
    }

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/accounts/parent/children/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.status === 401) {
          clearSession();
          router.replace("/parent/login");
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Unable to load children.");
        }

        const list = data.children || [];
        setChildren(list);

        if (list.length) {
          const id = String(list[0].student_profile_id);
          setSelected(id);
          await loadFees(token, id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load children."
        );
        setLoading(false);
      }
    })();
  }, [router]);

  const totals = useMemo(
    () =>
      fees.reduce(
        (summary, fee) => ({
          payable: summary.payable + Number(fee.payable_amount || 0),
          paid: summary.paid + Number(fee.paid_amount || 0),
          pending: summary.pending + Number(fee.outstanding_amount || 0),
        }),
        { payable: 0, paid: 0, pending: 0 }
      ),
    [fees]
  );

  const selectedChild = children.find(
    (child) => String(child.student_profile_id) === selected
  );
  const featureRestricted = isParentClassFeatureRestricted(error);

  const changeChild = async (id: string) => {
    setSelected(id);
    setFees([]);
    setPayFee(null);
    setProofFile(null);
    setProofAmount("");
    setProofMessage("");

    const token = localStorage.getItem("parent_access_token");
    if (token && id) {
      await loadFees(token, id);
    }
  };

  const submitPaymentProof = async () => {
    if (!payFee || !selected || !proofAmount || !proofFile) {
      setError("Enter the amount and select a payment proof document.");
      return;
    }

    if (proofFile.size > 5 * 1024 * 1024) {
      setError("Payment proof must be 5 MB or smaller.");
      return;
    }

    const token = localStorage.getItem("parent_access_token");
    if (!token) {
      router.replace("/parent/login");
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
        `${API_BASE}/api/fees/parent/student/${selected}/fee/${payFee.id}/payment-proof/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.status === 401) {
        clearSession();
        router.replace("/parent/login");
        return;
      }

      if (response.status === 413) {
        throw new Error(
          "The server rejected the upload because the file is too large. Please upload a file up to 5 MB."
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Unable to submit payment proof (server returned ${response.status}).`
        );
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.detail || "Unable to submit payment proof."
        );
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
            <div className="dashboard-panel mb-4">
              <div className="panel-heading">
                <h5>Child Fees</h5>
              </div>

              <div className="row g-3 align-items-end">
                <div className="col-md-5">
                  <label className="form-label">Select Child</label>
                  <select
                    className="form-select"
                    value={selected}
                    onChange={(event) =>
                      void changeChild(event.target.value)
                    }
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
                <div className="alert alert-danger mt-3">{error}</div>
              )}

              {proofMessage && (
                <div className="alert alert-success mt-3">
                  {proofMessage}
                </div>
              )}

              {loading && (
                <div className="empty-state">Loading fees...</div>
              )}

              {!loading && !error && selected && (
                <div className="row g-3 mt-2">
                  {(
                    [
                      ["Total Payable", totals.payable],
                      ["Total Paid", totals.paid],
                      ["Total Pending", totals.pending],
                    ] as const
                  ).map(([key, value]) => (
                    <div className="col-md-4" key={key}>
                      <div className="border rounded p-3 h-100">
                        <div className="text-muted small">{key}</div>
                        <div className="fs-4 fw-bold">{money(value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {featureRestricted && (
              <ParentFeatureRestricted
                featureName="Fees"
                childName={selectedChild?.name}
              />
            )}

            {!loading &&
              !error &&
              selected &&
              fees.length === 0 && (
                <div className="dashboard-panel">
                  <div className="empty-state">
                    No fees assigned to this child.
                  </div>
                </div>
              )}

            {fees.map((fee) => (
              <div className="dashboard-panel mb-4" key={fee.id}>
                <div className="panel-heading">
                  <h5>{fee.fee_structure?.name || "Fee"}</h5>

                  <div className="d-flex gap-2 align-items-center flex-wrap">
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
                          setProofMessage("");
                        }}
                      >
                        Pay Fee
                      </button>
                    )}

                    <span className="badge bg-light text-dark border">
                      {label(fee.status)}
                    </span>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <strong>Session</strong>
                    <div>{fee.academic_session?.name || "-"}</div>
                  </div>
                  <div className="col-md-3">
                    <strong>Due Date</strong>
                    <div>{fee.due_date}</div>
                  </div>
                  <div className="col-md-2">
                    <strong>Payable</strong>
                    <div>{money(fee.payable_amount)}</div>
                  </div>
                  <div className="col-md-2">
                    <strong>Paid</strong>
                    <div>{money(fee.paid_amount)}</div>
                  </div>
                  <div className="col-md-2">
                    <strong>Pending</strong>
                    <div>{money(fee.outstanding_amount)}</div>
                  </div>
                </div>

                <h6>Installments</h6>
                <div className="table-responsive mb-4">
                  <table className="table align-middle">
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
                        fee.installments.map((installment) => (
                          <tr key={installment.id}>
                            <td>{installment.name}</td>
                            <td>{money(installment.amount)}</td>
                            <td>{money(installment.paid_amount)}</td>
                            <td>
                              {money(installment.outstanding_amount)}
                            </td>
                            <td>{installment.due_date}</td>
                            <td>{label(installment.status)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-muted">
                            No installments.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <h6>Payment History</h6>
                <div className="table-responsive">
                  <table className="table align-middle">
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
                        fee.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{payment.payment_date}</td>
                            <td>{money(payment.amount)}</td>
                            <td>{label(payment.payment_method)}</td>
                            <td>
                              {payment.installment?.name || "General"}
                            </td>
                            <td>{payment.reference_number || "-"}</td>
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-muted">
                            No payments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

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
                          <h5 className="modal-title">
                            Submit Fee Payment Proof
                          </h5>
                          <small className="text-muted">
                            {selectedChild?.name || "Child"} ·{" "}
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
                          <label className="form-label">
                            Amount Paid
                          </label>
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
                            Pending balance:{" "}
                            {money(payFee.outstanding_amount)}
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
