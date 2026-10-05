"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import StudentIcon from "@/components/student/StudentIcon";
import StudentFeatureRestricted, { isClassFeatureRestricted } from "@/components/student/StudentFeatureRestricted";

import "../dashboard/dashboard.css";
import "./attendance.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface AttendanceSummary {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_percentage: number;
}

interface AttendanceRecord {
  id: number;
  date: string;
  subject_name: string;
  section_name: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  status: string;
  remarks: string;
}

function attendanceStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "present") return "is-present";
  if (normalized === "late") return "is-late";
  if (normalized === "absent") return "is-absent";
  if (normalized === "excused") return "is-excused";

  return "";
}

function formatAttendanceDate(value: string) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSavedStudent() {
  if (typeof window === "undefined") {
    return {};
  }

  const savedStudent = localStorage.getItem("student_user");

  if (!savedStudent) {
    return {};
  }

  try {
    return JSON.parse(savedStudent);
  } catch {
    return {};
  }
}

export default function StudentAttendancePage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    async function loadAttendance() {
      try {
        setLoading(true);
        setError("");

        const [summaryResponse, recordsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/attendance/student/summary/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/api/attendance/student/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (
          summaryResponse.status === 401 ||
          recordsResponse.status === 401
        ) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return;
        }

        const summaryResult = await summaryResponse.json();
        const recordsResult = await recordsResponse.json();

        if (!summaryResponse.ok) {
          throw new Error(
            summaryResult.detail || "Unable to load attendance summary."
          );
        }

        if (!recordsResponse.ok) {
          throw new Error(
            recordsResult.detail || "Unable to load attendance records."
          );
        }

        setSummary(summaryResult);
        setRecords(recordsResult);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load attendance."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAttendance();
  }, [router]);

  const featureRestricted = isClassFeatureRestricted(error);

  return (
    <div className="student-dashboard">
      <StudentSidebar />

      <main className="student-dashboard-main">
        <StudentTopbar
          name={student.name || student.username || "Student"}
          organization={student.organization || ""}
        />

        <div className="student-dashboard-content">
          <div className="container-fluid">
            {featureRestricted ? (
              <StudentFeatureRestricted featureName="Attendance" />
            ) : (
              <div className="student-attendance-page">
                <section className="student-attendance-header">
                  <div>
                    <div className="student-attendance-kicker">
                      STUDENT PORTAL
                    </div>
                    <h1>Attendance</h1>
                    <p>
                      Review your attendance summary and class-by-class records.
                    </p>
                  </div>

                  <span className="student-attendance-header-icon">
                    <StudentIcon name="attendance" size={22} />
                  </span>
                </section>

                {loading && (
                  <section className="student-attendance-card">
                    <div className="student-attendance-loading">
                      Loading attendance...
                    </div>
                  </section>
                )}

                {error && (
                  <div className="alert alert-danger">{error}</div>
                )}

                {!loading && !error && summary && (
                  <section className="student-attendance-summary">
                    <article className="student-attendance-overall-card">
                      <div className="student-attendance-overall-copy">
                        <span>Overall Attendance</span>
                        <strong>{summary.attendance_percentage}%</strong>
                        <small>
                          Present and late classes count toward attendance.
                        </small>
                      </div>

                      <div
                        className="student-attendance-progress"
                        aria-label={`Overall attendance ${summary.attendance_percentage}%`}
                      >
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, summary.attendance_percentage)
                            )}%`,
                          }}
                        />
                      </div>
                    </article>

                    <div className="student-attendance-metrics">
                      {[
                        ["Total Classes", summary.total_classes, "total"],
                        ["Present", summary.present, "present"],
                        ["Late", summary.late, "late"],
                        ["Absent", summary.absent, "absent"],
                        ["Excused", summary.excused, "excused"],
                      ].map(([label, value, tone]) => (
                        <article
                          className={`student-attendance-metric is-${tone}`}
                          key={label}
                        >
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <section className="student-attendance-card">
                  <div className="student-attendance-card-header">
                    <div>
                      <h2>Attendance Records</h2>
                      <p>
                        Your recorded attendance for each class session.
                      </p>
                    </div>

                    <span className="student-attendance-count">
                      {records.length} {records.length === 1 ? "record" : "records"}
                    </span>
                  </div>

                  {!loading && !error && records.length === 0 && (
                    <div className="student-attendance-empty">
                      <span className="student-attendance-empty-icon">
                        <StudentIcon name="calendar" size={22} />
                      </span>
                      <strong>No attendance records yet</strong>
                      <p>Your attendance will appear here once classes are marked.</p>
                    </div>
                  )}

                  {!loading && !error && records.length > 0 && (
                    <div className="table-responsive student-attendance-table-wrap">
                      <table className="table align-middle student-attendance-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Subject</th>
                            <th>Section</th>
                            <th>Teacher</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((record) => (
                            <tr key={record.id}>
                              <td className="student-attendance-date">
                                {formatAttendanceDate(record.date)}
                              </td>
                              <td>
                                <strong>{record.subject_name}</strong>
                              </td>
                              <td>{record.section_name}</td>
                              <td>{record.teacher_name || "-"}</td>
                              <td className="student-attendance-time">
                                {record.start_time} - {record.end_time}
                              </td>
                              <td>
                                <span
                                  className={`student-attendance-status ${attendanceStatusClass(
                                    record.status
                                  )}`}
                                >
                                  {record.status}
                                </span>
                              </td>
                              <td>{record.remarks || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
