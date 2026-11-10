"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ModuleQuizBuilder from "@/components/learning/ModuleQuizBuilder";
import ModuleAssignmentBuilder from "@/components/learning/ModuleAssignmentBuilder";
import CourseFinalExamBuilder from "@/components/learning/CourseFinalExamBuilder";
import CourseEnrollmentManager from "@/components/learning/CourseEnrollmentManager";
import CourseReadinessPanel from "@/components/learning/CourseReadinessPanel";

const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const ROOT = `${API}/api/recorded-courses/learning/manage`;
type Role = "college_admin" | "teacher";
type Module = {
  id: number; course_id: number; title: string; description: string;
  position: number; is_published: boolean; lesson_count: number; resource_count: number;
};
type Resource = { id: number; title: string; kind: string; created_at: string };
type Lesson = { id: number; title: string; position: number; description: string; verified_duration_seconds: number | null; duration_verified_at: string | null };
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

  async function verifyDuration(lesson: Lesson) {
    if (!selected) return;
    await run(async () => {
      const result = await json(await request(
        `/lessons/${lesson.id}/verify-duration/`, { method: "POST" },
      ));
      setNotice(`Video duration verified: ${result.lesson.verified_duration_seconds.toFixed(1)} seconds.`);
      await loadModule(selected.id);
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
                <ul className="small">{(lessons[selected.id] || []).map(lesson => <li key={lesson.id} className="mb-2">
                  <strong>{lesson.title}</strong>{" "}
                  {lesson.verified_duration_seconds !== null
                    ? <span className="text-success">Verified: {lesson.verified_duration_seconds.toFixed(1)} sec</span>
                    : <span className="text-warning">Duration unverified</span>}
                  {lesson.verified_duration_seconds === null &&
                    <button type="button" className="btn btn-link btn-sm p-0 ms-2" disabled={busy}
                      onClick={() => void verifyDuration(lesson)}>Verify duration</button>}
                </li>)}</ul>
                <p className="small text-muted">New videos are checked on the backend. FFmpeg/ffprobe must be installed for upload verification.</p>
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
          <CourseFinalExamBuilder courseId={courseId} role={role} />
          <CourseReadinessPanel courseId={courseId} role={role} />
          <CourseProgressDashboard courseId={courseId} role={role} />
          {role === "college_admin" && <CourseEnrollmentManager courseId={courseId} />}
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


type StudentModuleReport = {
  id: number; position: number; title: string; completed: boolean;
  lectures_viewed: number; lectures_total: number; session_backed_lectures: number;
  quiz_status: string; quiz_best_percent: number | null;
  assignment_status: string; assignment_best_percent: number | null;
};
type StudentProgressReport = {
  student_id: number; student_name: string; admission_number: string;
  access_active: boolean; modules_completed: number; modules_total: number;
  lectures_viewed: number; lectures_total: number; session_backed_lectures: number; progress_percent: number;
  final_exam_best_percent: number | null; final_exam_passed: boolean;
  certificate_status: string; modules: StudentModuleReport[];
};
type CourseProgressResponse = {
  students_total: number; page: number; page_size: number;
  has_next: boolean; students: StudentProgressReport[];
};
function reportStatus(value: string) {
  const labels: Record<string, string> = {
    passed: "Passed", not_passed: "Not passed",
    awaiting_review: "Awaiting review", not_required: "Not required",
    issued: "Issued", revoked: "Revoked", not_issued: "Not issued",
  };
  return labels[value] || value;
}

type LearnerProgressFilter = "all" | "not_started" | "in_progress" | "completed" | "awaiting_grading" | "inactive_access";
type LearnerCertificateFilter = "all" | "issued" | "revoked" | "not_issued";
type LearnerSort = "default" | "name" | "progress_low" | "progress_high";
function needsGrading(student: StudentProgressReport) {
  return student.modules.some(module => module.assignment_status === "awaiting_review");
}
function learnerProgressLabel(student: StudentProgressReport) {
  if (!student.modules_total) return "No published modules";
  if (student.modules_completed === student.modules_total) return "Completed";
  if (!student.modules_completed) return student.lectures_viewed ? "In progress" : "Not started";
  return "In progress";
}

function CourseProgressDashboard({courseId,role}:{courseId:number;role:Role}) {
  const [data,setData] = useState<CourseProgressResponse|null>(null);
  const [page,setPage] = useState(1);
  const [draftSearch,setDraftSearch] = useState("");
  const [search,setSearch] = useState("");
  const [refreshCounter,setRefreshCounter] = useState(0);
  const [loading,setLoading] = useState(true);
  const [exporting,setExporting] = useState(false);
  const [error,setError] = useState("");
  const [progressFilter,setProgressFilter] = useState<LearnerProgressFilter>("all");
  const [certificateFilter,setCertificateFilter] = useState<LearnerCertificateFilter>("all");
  const [sort,setSort] = useState<LearnerSort>("default");

  // The API is paginated. These filters apply only to the current loaded page.
  // Server-side learner search and CSV export still span the full course.
  const visibleStudents = useMemo(() => {
    const matches = (data?.students || []).filter(student => {
      if (certificateFilter !== "all" && student.certificate_status !== certificateFilter) return false;
      if (progressFilter === "awaiting_grading") return needsGrading(student);
      if (progressFilter === "inactive_access") return !student.access_active;
      if (progressFilter === "completed") return student.modules_total > 0 &&
        student.modules_completed === student.modules_total;
      if (progressFilter === "not_started") return student.modules_total > 0 &&
        student.modules_completed === 0 && student.lectures_viewed === 0;
      if (progressFilter === "in_progress") return student.modules_total > 0 &&
        (student.modules_completed < student.modules_total) &&
        (student.modules_completed > 0 || student.lectures_viewed > 0);
      return true;
    });
    if (sort === "default") return matches;
    return [...matches].sort((a,b) => {
      if (sort === "name") return a.student_name.localeCompare(b.student_name);
      if (sort === "progress_low") return a.progress_percent - b.progress_percent;
      return b.progress_percent - a.progress_percent;
    });
  }, [data,progressFilter,certificateFilter,sort]);
  const hasPageFilters = progressFilter !== "all" || certificateFilter !== "all" || sort !== "default";
  function resetPageFilters() {
    setProgressFilter("all"); setCertificateFilter("all"); setSort("default");
  }

  useEffect(()=>{
    const controller = new AbortController();
    const token = localStorage.getItem(role === "teacher" ? "teacher_access_token" : "college_admin_access_token");
    setLoading(true); setError("");
    if (!token) {
      setError("Please sign in again to view learning progress.");
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({page:String(page)});
    if(search)params.set("search",search);
    void fetch(ROOT + "/courses/" + courseId + "/progress/?" + params.toString(),{
      headers:{Authorization:"Bearer "+token},cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.detail||"Unable to load course progress.");
      if (!body || !Array.isArray(body.students) || typeof body.students_total !== "number") {
        throw Error("Course progress response is incomplete. Refresh to try again.");
      }
      return body as CourseProgressResponse;
    }).then(body=>{if(!controller.signal.aborted)setData(body);})
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Unable to load progress.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[courseId,role,page,search,refreshCounter]);

  async function exportCSV() {
    const token=localStorage.getItem(role==="teacher"?"teacher_access_token":"college_admin_access_token");
    if(!token){setError("Please sign in again to export progress.");return;}
    setError("");setExporting(true);
    try{
      const params=new URLSearchParams();
      if(search)params.set("search",search);
      const url=ROOT+"/courses/"+courseId+"/progress/export.csv"+(params.size?"?"+params.toString():"");
      const response=await fetch(url,{
        headers:{Authorization:"Bearer "+token},cache:"no-store",
      });
      if(!response.ok){
        const body=await response.json().catch(()=>({}));
        throw Error(body.detail||"Course progress export failed.");
      }
      const csv=await response.blob();
      const objectUrl=URL.createObjectURL(csv);
      const anchor=document.createElement("a");
      anchor.href=objectUrl;
      anchor.download="mysls-course-"+courseId+"-progress.csv";
      document.body.appendChild(anchor);
      anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to export progress.");
    }finally{setExporting(false);}
  }

  return <section className="card border-0 shadow-sm my-4" aria-label="Student course progress dashboard">
    <div className="card-body p-4">
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-3">
        <div>
          <h3 className="h5 fw-bold mb-1">Student Learning Progress</h3>
          <p className="small text-muted mb-0">Module completion, quiz and assignment outcomes, final exams and certificates.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-success btn-sm"
            disabled={loading||exporting} onClick={()=>void exportCSV()}>
            {exporting?"Exporting...":"Export CSV"}
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading}
            onClick={()=>setRefreshCounter(value=>value+1)}>Refresh</button>
        </div>
      </div>
      <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={event=>{
        event.preventDefault();setPage(1);setSearch(draftSearch.trim());
      }}>
        <input aria-label="Search enrolled students" className="form-control"
          style={{maxWidth:340}} maxLength={80} placeholder="Search by name or admission number"
          value={draftSearch} onChange={event=>setDraftSearch(event.target.value)}/>
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
        {search&&<button type="button" className="btn btn-outline-secondary btn-sm"
          onClick={()=>{setDraftSearch("");setSearch("");setPage(1);}}>Clear</button>}
      </form>
      <p className="small text-muted mb-2">Search and CSV export include all matching learners across pages. Progress and certificate filters apply only to the current page.</p>
      {loading&&<p className="small text-muted" role="status">Loading learner progress…</p>}
      {error&&<p className="alert alert-danger py-2" role="alert">{error}</p>}
      {!loading&&!error&&data&&<>
        <p className="small text-muted">{data.students_total} enrolled students{search?" matching your search":""}</p>
        {data.students.length>0&&<>
          <div className="row g-2 align-items-end mb-3" aria-label="Current page learner filters">
            <div className="col-md-4">
              <label className="form-label small" htmlFor="learner-progress-filter">Filter learner progress (this page)</label>
              <select id="learner-progress-filter" className="form-select form-select-sm"
                value={progressFilter}
                onChange={event=>setProgressFilter(event.target.value as LearnerProgressFilter)}>
                <option value="all">All progress</option>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="completed">All modules completed</option>
                <option value="awaiting_grading">Awaiting assignment grading</option>
                <option value="inactive_access">Access inactive</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small" htmlFor="learner-certificate-filter">Filter certificates (this page)</label>
              <select id="learner-certificate-filter" className="form-select form-select-sm"
                value={certificateFilter}
                onChange={event=>setCertificateFilter(event.target.value as LearnerCertificateFilter)}>
                <option value="all">All certificates</option>
                <option value="issued">Issued</option>
                <option value="revoked">Revoked</option>
                <option value="not_issued">Not issued</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small" htmlFor="learner-progress-sort">Sort current page</label>
              <select id="learner-progress-sort" className="form-select form-select-sm"
                value={sort} onChange={event=>setSort(event.target.value as LearnerSort)}>
                <option value="default">Default order</option>
                <option value="name">Student name A–Z</option>
                <option value="progress_low">Progress: low to high</option>
                <option value="progress_high">Progress: high to low</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-outline-secondary btn-sm w-100"
                disabled={!hasPageFilters} onClick={resetPageFilters}>Clear page filters</button>
            </div>
          </div>
          <p className="small text-muted" role="status">
            Showing {visibleStudents.length} of {data.students.length} learners on this page
            {" · "}Awaiting grading: {data.students.filter(needsGrading).length}
            {" · "}Certificates issued: {data.students.filter(student=>student.certificate_status==="issued").length}
            {" · "}Revoked: {data.students.filter(student=>student.certificate_status==="revoked").length}
          </p>
        </>}
        {data.students.length===0?<p className="text-muted">No students found for this course.</p>:
        visibleStudents.length===0?
        <div className="py-3">
          <p className="text-muted">No learners match the current-page filters. Other pages may have matches.</p>
          <button type="button" className="btn btn-outline-primary btn-sm"
            onClick={resetPageFilters}>Clear current-page filters</button>
        </div>:
        <div className="table-responsive"><table className="table table-hover align-middle" aria-label="Student course progress">
          <thead><tr><th scope="col">Student</th><th scope="col">Modules</th>
          <th scope="col">Progress</th><th scope="col">Final Exam</th><th scope="col">Certificate</th></tr></thead>
          <tbody>{visibleStudents.map(student=><tr key={student.student_id}>
            <td>
              <strong>{student.student_name}</strong>
              <div className="small text-muted">{student.admission_number}</div>
              {!student.access_active&&<span className="small text-danger">Access inactive</span>}
              <div className="small text-muted">{learnerProgressLabel(student)}</div>
              {needsGrading(student)&&<span className="badge bg-warning text-dark">Awaiting grading</span>}
            </td>
            <td>{student.modules_completed}/{student.modules_total} completed
              <div className="small text-muted">{student.lectures_viewed}/{student.lectures_total} lectures viewed</div>
              <div className="small text-muted">{student.session_backed_lectures} session-backed</div>
            </td>
            <td style={{minWidth:180}}>
              <div className="progress" role="progressbar" aria-label={"Course progress for "+student.student_name}
                aria-valuenow={student.progress_percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar" style={{width:String(student.progress_percent)+"%"}}/>
              </div>
              <small>{student.progress_percent}%</small>
              <details className="mt-2">
                <summary className="small" style={{cursor:"pointer"}}>Module results</summary>
                <ol className="ps-3 mt-2">
                  {student.modules.map(module=><li key={module.id} className="small mb-2">
                    <strong>{module.position}. {module.title}</strong>
                    <div>{module.completed?"Completed":"Incomplete"} · {module.lectures_viewed}/{module.lectures_total} lectures · {module.session_backed_lectures} session-backed</div>
                    <div>Quiz: {reportStatus(module.quiz_status)}{module.quiz_best_percent!==null?" ("+module.quiz_best_percent+"%)":""}</div>
                    <div>Assignment: {reportStatus(module.assignment_status)}{module.assignment_best_percent!==null?" ("+module.assignment_best_percent+"%)":""}</div>
                  </li>)}
                </ol>
              </details>
            </td>
            <td>{student.final_exam_passed?"Passed":student.final_exam_best_percent!==null?"Not passed":"Not attempted"}
              {student.final_exam_best_percent!==null&&<div className="small text-muted">Best: {student.final_exam_best_percent}%</div>}
            </td>
            <td>
              <span className={`badge ${student.certificate_status==="issued"
                ?"bg-success":student.certificate_status==="revoked"?"bg-danger":"bg-secondary"}`}>
                {reportStatus(student.certificate_status)}
              </span>
            </td>
          </tr>)}</tbody>
        </table></div>}
        <div className="d-flex align-items-center justify-content-between mt-3">
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={page<=1}
            onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous</button>
          <span className="small text-muted">Page {page}</span>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={!data.has_next}
            onClick={()=>setPage(v=>v+1)}>Next</button>
        </div>
      </>}
    </div>
  </section>;
}
