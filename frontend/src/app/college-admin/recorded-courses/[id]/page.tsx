"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import LearningCourseEditor from "@/components/learning/LearningCourseEditor";
import "../../../teacher/dashboard/dashboard.css";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
type AdminUser = { name?: string; username?: string; organization?: string };
type Lesson = {
  id: number; title: string; description: string; position: number; is_active: boolean;
};
type Course = {
  id: number; title: string; description: string; price: string;
  access_duration_days: number; is_active: boolean; lessons: Lesson[];
};
type LessonDraft = { title: string; description: string; position: string; video: File | null };
const freshLesson = (position: number): LessonDraft => ({
  title: "", description: "", position: String(position), video: null,
});

function apiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as Record<string, unknown>;
  if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  const messages = Object.values(body)
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return messages.join("; ") || fallback;
}

export default function RecordedCourseManagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = Number(params.id);
  const validCourseId = Number.isSafeInteger(courseId) && courseId > 0;
  const detailUrl = `${API}/api/recorded-courses/college-admin/courses/${courseId}/`;

  const [admin, setAdmin] = useState<AdminUser>({});
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [lesson, setLesson] = useState<LessonDraft>(freshLesson(1));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const videoInput = useRef<HTMLInputElement | null>(null);

  // Saved profile data is browser-only: restore it after hydration.
  useEffect(() => {
    try {
      setAdmin(JSON.parse(localStorage.getItem("college_admin_user") || "{}"));
    } catch {
      setAdmin({});
    }
  }, []);

  useEffect(() => {
    if (!validCourseId) {
      setLoadError("Invalid recorded course ID.");
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) {
      router.replace("/college-admin/login");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    const fetchCourse = async () => {
      try {
        const response = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/college-admin/login");
          return;
        }
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiError(body, "Unable to load this course."));
        const result = body as { course?: Course };
        if (!result.course) throw new Error("The course response did not contain course details.");
        if (!controller.signal.aborted) {
          const next = { ...result.course, lessons: result.course.lessons || [] };
          setCourse(next);
          setLesson(previous => previous.video || previous.title
            ? previous
            : freshLesson(Math.max(0, ...next.lessons.map(item => item.position)) + 1));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : "Unable to load this course.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchCourse();
    return () => controller.abort();
  }, [detailUrl, router, reloadIndex, validCourseId]);

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course || saving) return;
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) { router.replace("/college-admin/login"); return; }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      const response = await fetch(detailUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: course.title, description: course.description, price: course.price,
          access_duration_days: Number(course.access_duration_days),
          is_active: course.is_active,
        }),
      });
      if (response.status === 401) { router.replace("/college-admin/login"); return; }
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to save course changes."));
      const updated = body as { course?: Partial<Course> };
      setCourse(current => current ? { ...current, ...(updated.course || {}) } : current);
      setSaveSuccess("Course details saved successfully.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Unable to save course changes.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course || !lesson.video || uploading) return;
    const token = localStorage.getItem("college_admin_access_token");
    if (!token) { router.replace("/college-admin/login"); return; }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const data = new FormData();
      data.append("title", lesson.title);
      data.append("description", lesson.description);
      data.append("position", lesson.position);
      data.append("video", lesson.video);
      const response = await fetch(`${detailUrl}lessons/`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data,
      });
      if (response.status === 401) { router.replace("/college-admin/login"); return; }
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Unable to upload the recorded lesson."));

      const nextPosition = Math.max(
        Number(lesson.position),
        ...course.lessons.map(item => item.position),
        0,
      ) + 1;
      setLesson(freshLesson(nextPosition));
      if (videoInput.current) videoInput.current.value = "";
      setUploadSuccess("Recorded lesson uploaded successfully.");
      setReloadIndex(index => index + 1);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Unable to upload the recorded lesson.");
    } finally {
      setUploading(false);
    }
  }

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
              <Link className="btn btn-link px-0" href="/college-admin/recorded-courses">
                ← Back to Recorded Courses
              </Link>
              <h1 className="h3 fw-bold mb-1">Manage Recorded Course</h1>
            </div>

            {loading && <div className="card p-4 text-muted" role="status">Loading recorded course...</div>}
            {!loading && (loadError || !course) && (
              <div className="alert alert-danger d-flex align-items-center justify-content-between flex-wrap gap-2" role="alert">
                <span>{loadError || "Recorded course not found."}</span>
                {validCourseId && (
                  <button type="button" className="btn btn-outline-danger btn-sm"
                    onClick={() => setReloadIndex(index => index + 1)}>Retry loading course</button>
                )}
              </div>
            )}

            {!loading && !loadError && course && (
              <>
                <section className="card border-0 shadow-sm mb-4" aria-label="Recorded course details">
                  <div className="card-body">
                    <h2 className="h5 fw-bold mb-3">Course Details</h2>
                    {saveError && <div role="alert" className="alert alert-danger">{saveError}</div>}
                    {saveSuccess && <div role="status" className="alert alert-success">{saveSuccess}</div>}
                    <form onSubmit={event => void saveCourse(event)}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label htmlFor="course-detail-title" className="form-label">Title</label>
                          <input id="course-detail-title" required className="form-control" value={course.title}
                            onChange={event => setCourse(previous => previous ? { ...previous, title: event.target.value } : previous)} />
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="course-detail-price" className="form-label">Price (₹)</label>
                          <input id="course-detail-price" type="number" min="0" step="0.01" required className="form-control"
                            value={course.price}
                            onChange={event => setCourse(previous => previous ? { ...previous, price: event.target.value } : previous)} />
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="course-detail-days" className="form-label">Access Days</label>
                          <input id="course-detail-days" type="number" min="1" step="1" required className="form-control"
                            value={course.access_duration_days}
                            onChange={event => setCourse(previous => previous ? { ...previous, access_duration_days: Number(event.target.value) } : previous)} />
                        </div>
                        <div className="col-12">
                          <label htmlFor="course-detail-description" className="form-label">Description</label>
                          <textarea id="course-detail-description" rows={3} className="form-control" value={course.description || ""}
                            onChange={event => setCourse(previous => previous ? { ...previous, description: event.target.value } : previous)} />
                        </div>
                        <div className="col-12 d-flex justify-content-between align-items-center">
                          <div className="form-check">
                            <input id="course-detail-active" type="checkbox" className="form-check-input" checked={course.is_active}
                              onChange={event => setCourse(previous => previous ? { ...previous, is_active: event.target.checked } : previous)} />
                            <label htmlFor="course-detail-active" className="form-check-label">Active</label>
                          </div>
                          <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </section>

                <section className="card border-0 shadow-sm mb-4" aria-label="Upload recorded lesson">
                  <div className="card-body">
                    <h2 className="h5 fw-bold mb-3">Upload Lesson</h2>
                    {uploadError && <div role="alert" className="alert alert-danger">{uploadError}</div>}
                    {uploadSuccess && <div role="status" className="alert alert-success">{uploadSuccess}</div>}
                    <form onSubmit={event => void uploadLesson(event)}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label htmlFor="course-lesson-title" className="form-label">Lesson Title</label>
                          <input id="course-lesson-title" required className="form-control" value={lesson.title}
                            onChange={event => setLesson(previous => ({ ...previous, title: event.target.value }))} />
                        </div>
                        <div className="col-md-2">
                          <label htmlFor="course-lesson-position" className="form-label">Position</label>
                          <input id="course-lesson-position" required min="1" step="1" type="number" className="form-control"
                            value={lesson.position}
                            onChange={event => setLesson(previous => ({ ...previous, position: event.target.value }))} />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor="course-lesson-video" className="form-label">Video</label>
                          <input id="course-lesson-video" ref={videoInput} required accept=".mp4,.webm,.mov,video/*" type="file"
                            className="form-control"
                            onChange={event => setLesson(previous => ({ ...previous, video: event.target.files?.[0] || null }))} />
                        </div>
                        <div className="col-12">
                          <label htmlFor="course-lesson-description" className="form-label">Description</label>
                          <textarea id="course-lesson-description" className="form-control" value={lesson.description}
                            onChange={event => setLesson(previous => ({ ...previous, description: event.target.value }))} />
                        </div>
                        <div className="col-12 text-end">
                          <button type="submit" className="btn btn-success" disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload Lesson"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </section>

                <section className="card border-0 shadow-sm" aria-label="Recorded course lessons">
                  <div className="card-body border-bottom">
                    <h2 className="h5 fw-bold mb-0">Lessons</h2>
                  </div>
                  {course.lessons.length === 0 ? (
                    <div className="p-4 text-muted">No lessons uploaded yet.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table align-middle mb-0" aria-label="Course lessons">
                        <thead><tr><th>Position</th><th>Lesson</th><th>Status</th></tr></thead>
                        <tbody>
                          {course.lessons.map(item => (
                            <tr key={item.id}>
                              <td>{item.position}</td>
                              <td>
                                <div className="fw-semibold">{item.title}</div>
                                <small className="text-muted">{item.description || "-"}</small>
                              </td>
                              <td>
                                <span className={`badge ${item.is_active ? "bg-success" : "bg-secondary"}`}>
                                  {item.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                <LearningCourseEditor courseId={courseId} role="college_admin" />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
