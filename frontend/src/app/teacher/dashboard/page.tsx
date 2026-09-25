"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import TeacherTopbar from "@/components/teacher/TeacherTopbar";
import NoticeFeed from "@/components/notices/NoticeFeed";
import "./dashboard.css";

interface TeacherInfo {
  username: string;
  name: string;
  organization: string;
}

interface Summary {
  assigned_classes: number;
  today_classes: number;
  upcoming_classes: number;
  recordings: number;
}

interface Assignment {
  id: number;
  subject_name: string;
  section_name: string;
}

interface TeacherClass {
  id: number;
  title: string;
  description: string;
  class_date: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
  status: string;
  subject_name: string;
  section_name: string;
}

interface Recording {
  public_id: string;
  title: string;
  class_title: string;
  class_date: string;
  subject_name: string;
  section_name: string;
  is_available: boolean;
  uploaded_at: string;
}

interface TeacherDashboardData {
  teacher: TeacherInfo;
  summary: Summary;
  assignments: Assignment[];
  today_classes: TeacherClass[];
  upcoming_classes: TeacherClass[];
  recordings: Recording[];
}

export default function TeacherDashboard() {
  const router = useRouter();

  const [data, setData] =
    useState<TeacherDashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadDashboard() {
      const token =
        localStorage.getItem("teacher_access_token");

      if (!token) {
        router.replace("/teacher/login");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/teacher/dashboard/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          localStorage.removeItem(
            "teacher_access_token"
          );

          localStorage.removeItem(
            "teacher_refresh_token"
          );

          localStorage.removeItem(
            "teacher_user"
          );

          router.replace("/teacher/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.detail ||
              "Unable to load teacher dashboard."
          );
          return;
        }

        setData(result);

      } catch {
        setError(
          "Unable to connect to the server."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div
          className="spinner-border text-primary"
          role="status"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
  <div className="teacher-dashboard">

    <TeacherSidebar />

    <main className="teacher-dashboard-main">

      <TeacherTopbar
        name={data.teacher.name}
        organization={data.teacher.organization}
      />

      <div className="teacher-dashboard-content">

        <div className="container-fluid">

          {/* SUMMARY CARDS */}
          <div className="row g-4">

            <div className="col-xl-3 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <small className="text-muted">
                    Teaching Assignments
                  </small>

                  <h2 className="mt-2 mb-0">
                    {data.summary.assigned_classes}
                  </h2>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <small className="text-muted">
                    Today&apos;s Classes
                  </small>

                  <h2 className="mt-2 mb-0">
                    {data.summary.today_classes}
                  </h2>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <small className="text-muted">
                    Upcoming Classes
                  </small>

                  <h2 className="mt-2 mb-0">
                    {data.summary.upcoming_classes}
                  </h2>
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <small className="text-muted">
                    Recordings
                  </small>

                  <h2 className="mt-2 mb-0">
                    {data.summary.recordings}
                  </h2>
                </div>
              </div>
            </div>

          </div>

          {/* ASSIGNMENTS */}
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">

              <h5 className="fw-bold mb-3">
                My Teaching Assignments
              </h5>

              {data.assignments.length === 0 ? (
                <p className="text-muted mb-0">
                  No teaching assignments found.
                </p>
              ) : (
                data.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border rounded p-3 mb-2"
                  >
                    <strong>
                      {assignment.subject_name}
                    </strong>

                    <div className="small text-muted">
                      {assignment.section_name}
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>

          <NoticeFeed
            tokenKey="teacher_access_token"
            loginPath="/teacher/login"
          />

          {/* TODAY CLASSES */}
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">

              <h5 className="fw-bold mb-3">
                Today&apos;s Classes
              </h5>

              {data.today_classes.length === 0 ? (
                <p className="text-muted mb-0">
                  No classes scheduled for today.
                </p>
              ) : (
                data.today_classes.map((liveClass) => (
                  <div
                    key={liveClass.id}
                    className="border rounded p-3 mb-3"
                  >
                    <h6 className="fw-bold">
                      {liveClass.title}
                    </h6>

                    <div className="small">
                      {liveClass.subject_name}
                    </div>

                    <div className="small text-muted">
                      {liveClass.section_name}
                    </div>

                    <div className="small mt-2">
                      {liveClass.start_time} - {liveClass.end_time}
                    </div>

                    {liveClass.meeting_link && (
                      <a
                        href={liveClass.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm mt-3"
                      >
                        Open Class
                      </a>
                    )}
                  </div>
                ))
              )}

            </div>
          </div>

          {/* RECORDINGS */}
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">

              <h5 className="fw-bold mb-3">
                My Recordings
              </h5>

              {data.recordings.length === 0 ? (
                <p className="text-muted mb-0">
                  No recordings uploaded.
                </p>
              ) : (
                data.recordings.map((recording) => (
                  <div
                    key={recording.public_id}
                    className="border rounded p-3 mb-3"
                  >
                    <strong>
                      {recording.title}
                    </strong>

                    <div className="small text-muted">
                      {recording.subject_name} • {recording.section_name}
                    </div>

                    <div className="small mt-1">
                      Class Date: {recording.class_date}
                    </div>

                    <div className="small mt-1">
                      Status:{" "}
                      {recording.is_available
                        ? "Available"
                        : "Hidden"}
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>

        </div>

      </div>

    </main>

  </div>
);
}