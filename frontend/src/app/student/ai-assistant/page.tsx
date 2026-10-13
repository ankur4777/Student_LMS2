"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";

import "../dashboard/dashboard.css";

interface AIContext {
  student: { name: string; classroom: string; section: string };
  subjects: Array<{ id: number; name: string; code: string }>;
}

export default function StudentAIAssistantPage() {
  const router = useRouter();
  const [context, setContext] = useState<AIContext | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = localStorage.getItem("student_access_token");
      if (!token) {
        router.replace("/student/login");
        return;
      }
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/ai-assistant/context/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        if (response.status === 401) {
          router.replace("/student/login");
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "AI Assistant is unavailable.");
        }
        if (active) setContext(data);
      } catch (err) {
        if (active) setError(
          err instanceof Error ? err.message : "Unable to connect."
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="student-dashboard student-dashboard-polished">
      <StudentSidebar />
      <main className="dashboard-main">
        <StudentTopbar
          name={context?.student.name || "Student"}
          organization=""
        />
        <div className="dashboard-content">
          <div className="container-fluid">
            <h2 className="fw-bold mb-2">AI Assistant</h2>
            {loading && <p>Checking your learning access...</p>}
            {error && <div className="alert alert-warning">{error}</div>}
            {context && (
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <p className="mb-2">
                    Your assistant is enabled for Class {context.student.classroom},
                    Section {context.student.section}.
                  </p>
                  <h5>Your enrolled subjects</h5>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {context.subjects.length ? context.subjects.map((subject) => (
                      <span key={subject.id} className="badge bg-primary">
                        {subject.name}
                      </span>
                    )) : <p>No subjects are currently assigned to you.</p>}
                  </div>
                  <p className="text-muted mb-3">
                    Your identity and subject permissions are connected.
                    AI chat and study-material explanations will be added in the
                    next implementation phase.
                  </p>
                  <Link href="/student/dashboard">Back to dashboard</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
