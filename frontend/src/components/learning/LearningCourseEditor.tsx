"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import ModuleQuizBuilder from "@/components/learning/ModuleQuizBuilder";
import ModuleAssignmentBuilder from "@/components/learning/ModuleAssignmentBuilder";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const ROOT = `${API}/api/recorded-courses/learning/manage`;
type Role = "college_admin" | "teacher";
type Module = {
  id: number; course_id: number; title: string; description: string;
  position: number; is_published: boolean; lesson_count: number; resource_count: number;
};
type Resource = { id: number; title: string; kind: string; created_at: string };
type Lesson = { id: number; title: string; position: number; description: string };
type Teacher = { teacher_id: number; teacher_name: string; is_active?: boolean };

async function json(response: Response): Promise<Record<string, any>> {
  return response.json().catch(() => ({}));
}

export default function LearningCourseEditor({ courseId, role }: { courseId: number; role: Role }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [resources, setResources] = useState<Record<number, Resource[]>>({});
  const [lessons, setLessons] = useState<Record<number, Lesson[]>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [draft, setDraft] = useState({ title: "", description: "", position: "1" });
  const [fileTitle, setFileTitle] = useState("");
  const [kind, setKind] = useState("notes");
  const [file, setFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storageKey = role === "teacher" ? "teacher_access_token" : "college_admin_access_token";

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem(storageKey);
    if (!token) throw new Error("Your login session has expired. Please log in again.");
    const response = await fetch(`${ROOT}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await json(response);
      throw new Error(data.detail || `Request failed (HTTP ${response.status}).`);
    }
    return response;
  }, [storageKey]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const token = localStorage.getItem(storageKey);
      if (!token) throw new Error("Please log in again to manage courses.");
      const response = await fetch(`${API}/api/recorded-courses/learning-access/`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const status = await json(response);
      if (!response.ok) throw new Error(status.detail || "Unable to check learning access.");
      setEnabled(status.can_use_learning_center === true);
      if (!status.can_use_learning_center) return;
      const result = await json(await request(`/courses/${courseId}/modules/`));
      setModules(result.modules || []);
      setCourseTitle(result.course?.title || "");
      if (role === "college_admin") {
        const people = await json(await request(`/courses/${courseId}/teachers/`));
        setTeachers(people.teachers || []);
        setAvailableTeachers(people.available_teachers || []);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load course modules."); }
  }, [courseId, request, role, storageKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = modules.find(module => module.id === selectedId) || null;

  const loadModule = useCallback(async (moduleId: number) => {
    setError("");
    setSelectedId(moduleId);
    try {
      const [noteResult, lessonResult] = await Promise.all([
        request(`/modules/${moduleId}/resources/`).then(json),
        request(`/modules/${moduleId}/lessons/`).then(json),
      ]);
      setResources(prev => ({ ...prev, [moduleId]: noteResult.resources || [] }));
      setLessons(prev => ({ ...prev, [moduleId]: lessonResult.lessons || [] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load module materials."); }
  }, [request]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally { setBusy(false); }
  }

  async function createModule(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await request(`/courses/${courseId}/modules/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, position: Number(draft.position) }),
      });
      setDraft({ title: "", description: "", position: String(modules.length + 2) });
      setNotice("Module draft created.");
      await refresh();
    });
  }

  async function changePublication(module: Module) {
    await run(async () => {
      await request(`/modules/${module.id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !module.is_published }),
      });
      setNotice(module.is_published ? "Module set to draft." : "Module published.");
      await refresh();
    });
  }

  async function uploadResource(event: FormEvent) {
    event.preventDefault(); if (!file || !selected) return;
    await run(async () => {
      const data = new FormData();
      data.append("title", fileTitle); data.append("kind", kind); data.append("file", file);
      await request(`/modules/${selected.id}/resources/`, { method: "POST", body: data });
      setNotice("Learning resource uploaded."); setFile(null); setFileTitle("");
      const input = document.getElementById("learning-resource-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadModule(selected.id);
      await refresh();
    });
  }

  async function uploadVideo(event: FormEvent) {
    event.preventDefault(); if (!video || !selected) return;
    await run(async () => {
      const data = new FormData();
      data.append("title", videoTitle); data.append("video", video);
      await request(`/modules/${selected.id}/lessons/`, { method: "POST", body: data });
      setNotice("Recorded lesson uploaded to the module.");
      setVideoTitle(""); setVideo(null);
      const input = document.getElementById("learning-lesson-video") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadModule(selected.id);
      await refresh();
    });
  }

  async function assignTeacher(event: FormEvent) {
    event.preventDefault(); if (!teacherId) return;
    await run(async () => {
      await request(`/courses/${courseId}/teachers/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: Number(teacherId), is_active: true }),
      });
      setTeacherId(""); setNotice("Teacher assigned to this course.");
      await refresh();
    });
  }

  async function downloadResource(resource: Resource) {
    await run(async () => {
      const response = await request(`/resources/${resource.id}/download/`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = resource.title.replace(/[\\/<>:"|?*]/g, "_") || "resource";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    });
  }

  return (
    <section className="card border-0 shadow-sm my-4" aria-label="Course modules and learning resources">
      <div className="card-body p-4">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
          <div><h3 className="h5 fw-bold mb-1">Course Modules & Learning Resources</h3>
            <p className="text-muted mb-0">{courseTitle || "Learning Center"} · Videos, notes and teacher resources</p></div>
          <span className="badge bg-light text-dark border">Learning & Certification</span>
        </div>
        {enabled === null && !error && <p className="text-muted">Checking organization access...</p>}
        {enabled === false && <div className="alert alert-secondary">This organization has not enabled Learning & Certification. Existing recorded-course purchases and playback remain available.</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {enabled === true && <>
          <form className="row g-2 mb-4" onSubmit={createModule}>
            <div className="col-md-5"><label className="form-label">New module name</label><input className="form-control" required maxLength={180} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Position</label><input className="form-control" type="number" min="1" required value={draft.position} onChange={e => setDraft({ ...draft, position: e.target.value })} /></div>
            <div className="col-md-5"><label className="form-label">Description (optional)</label><input className="form-control" maxLength={12000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="col-12"><button className="btn btn-primary" disabled={busy}>Add module draft</button></div>
          </form>
          <div className="list-group mb-4">
            {modules.length === 0 && <p className="text-muted">No modules yet. Add the first module above.</p>}
            {modules.map(module => <div key={module.id} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div><strong>{module.position}. {module.title}</strong><div className="small text-muted">{module.lesson_count} videos · {module.resource_count} resources · {module.is_published ? "Published" : "Draft"}</div></div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void loadModule(module.id)} disabled={busy}>Manage content</button>
                {role === "college_admin" && <button type="button" className={`btn btn-sm ${module.is_published ? "btn-outline-secondary" : "btn-outline-success"}`} onClick={() => void changePublication(module)} disabled={busy}>{module.is_published ? "Unpublish" : "Publish"}</button>}
              </div>
            </div>)}
          </div>
          {selected && <div className="border rounded-3 p-3 mb-4">
            <h4 className="h6 fw-bold">Module {selected.position}: {selected.title}</h4>
            <div className="row g-4">
              <div className="col-lg-6">
                <h5 className="h6 fw-semibold">Recorded video lessons</h5>
                <ul className="small">{(lessons[selected.id] || []).map(lesson => <li key={lesson.id}>{lesson.title}</li>)}</ul>
                <form onSubmit={uploadVideo} className="d-grid gap-2">
                  <label>Lesson title<input className="form-control" required maxLength={180} value={videoTitle} onChange={e => setVideoTitle(e.target.value)} /></label>
                  <label>Video file (MP4, WebM, MOV)<input id="learning-lesson-video" className="form-control" required type="file" accept=".mp4,.webm,.mov" onChange={e => setVideo(e.target.files?.[0] || null)} /></label>
                  <button className="btn btn-outline-primary" disabled={busy || !video}>Upload video to module</button>
                </form>
              </div>
              <div className="col-lg-6">
                <h5 className="h6 fw-semibold">Notes & other resources</h5>
                <ul className="small">{(resources[selected.id] || []).map(resource => <li key={resource.id}><button type="button" className="btn btn-link btn-sm p-0" disabled={busy} onClick={() => void downloadResource(resource)}>{resource.title} ({resource.kind})</button></li>)}</ul>
                <form className="d-grid gap-2" onSubmit={uploadResource}>
                  <label>Resource title<input className="form-control" required maxLength={180} value={fileTitle} onChange={e => setFileTitle(e.target.value)} /></label>
                  <label>Resource type<select className="form-select" value={kind} onChange={e => setKind(e.target.value)}><option value="notes">Notes</option><option value="worksheet">Worksheet</option><option value="reference">Reference</option></select></label>
                  <label>Upload PDF, DOCX, PPTX, TXT or image<input id="learning-resource-file" className="form-control" type="file" required accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
                  <button className="btn btn-outline-primary" disabled={busy || !file}>Upload resource</button>
                </form>
              </div>
            </div>
          </div>}
          {selected && <>
            <ModuleQuizBuilder key={"quiz-"+selected.id} moduleId={selected.id} role={role} />
            <ModuleAssignmentBuilder key={"assignment-"+selected.id} moduleId={selected.id} role={role} />
          </>}
          {role === "college_admin" && <div className="border-top pt-4">
            <h4 className="h6 fw-bold">Course teachers</h4>
            <p className="text-muted small">Only teachers assigned here can edit modules or upload learning content.</p>
            <div className="d-flex flex-wrap gap-2 mb-3">{teachers.map(t => <span key={t.teacher_id} className="badge bg-light text-dark border">{t.teacher_name}{!t.is_active && " (inactive)"}</span>)}</div>
            <form className="d-flex flex-wrap gap-2" onSubmit={assignTeacher}>
              <select aria-label="Choose teacher" className="form-select" style={{ maxWidth: 300 }} value={teacherId} onChange={e => setTeacherId(e.target.value)} required><option value="">Select a teacher</option>{availableTeachers.map(t => <option value={t.teacher_id} key={t.teacher_id}>{t.teacher_name}</option>)}</select>
              <button className="btn btn-primary" disabled={busy || !teacherId}>Assign teacher</button>
            </form>
          </div>}
        </>}
      </div>
    </section>
  );
}
