"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";

import "../dashboard/dashboard.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

interface StudentUser {
  username?: string;
  name?: string;
  organization?: string;
}

interface RecordedClass {
  id: number;
  title: string;
  class_date: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
  subject_name: string;
  section_name: string;
  recording_public_id: string | null;
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

export default function StudentRecordedClassesPage() {
  const router = useRouter();

  const [student] = useState<StudentUser>(getSavedStudent);
  const [classes, setClasses] = useState<RecordedClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("student_access_token");

    if (!token) {
      router.replace("/student/login");
      return;
    }

    async function loadRecordedClasses() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE}/api/live-classes/student/recorded/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("student_access_token");
          localStorage.removeItem("student_refresh_token");
          localStorage.removeItem("student_user");
          router.replace("/student/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail || "Unable to load recorded classes."
          );
        }

        setClasses(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load recorded classes."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRecordedClasses();
  }, [router]);

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
            <div className="dashboard-panel">
              <div className="panel-heading">
                <h5>Recorded Classes</h5>
                <span className="badge bg-primary">{classes.length}</span>
              </div>

              {loading && (
                <div className="empty-state">Loading recorded classes...</div>
              )}

              {error && <div className="alert alert-danger">{error}</div>}

              {!loading && !error && classes.length === 0 && (
                <div className="empty-state">No recorded classes found.</div>
              )}

              {!loading && !error && classes.length > 0 && (
                <div className="row g-3">
                  {classes.map((recording) => (
                    <div key={recording.id} className="col-lg-4 col-md-6">
                      <div className="border rounded p-3 h-100">
                        <h6 className="fw-bold">{recording.title}</h6>

                        <p className="text-muted small mb-2">
                          {recording.subject_name} • {recording.section_name}
                        </p>

                        <p className="small mb-1">
                          Teacher: {recording.teacher_name || "-"}
                        </p>

                        <p className="small mb-1">
                          Date: {recording.class_date}
                        </p>

                        <p className="small mb-3">
                          Time: {recording.start_time} - {recording.end_time}
                        </p>

                        {recording.recording_public_id && (
                          <Link
                            href={`/student/recordings/${recording.recording_public_id}`}
                            className="btn btn-primary btn-sm"
                          >
                            Watch Recording
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
