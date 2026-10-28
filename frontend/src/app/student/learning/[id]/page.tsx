"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import "../../../dashboard/dashboard.css";
import "../../learning.css";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
type Resource = {id:number;title:string;kind:string;extension:string};
type Lesson = {id:number;title:string;description:string;position:number;completed:boolean};
type Module = {id:number;title:string;description:string;position:number;lessons:Lesson[];resources:Resource[];completed_lessons:number;total_lessons:number};
type Course = {id:number;title:string;description:string;modules:Module[];completed_lessons:number;total_lessons:number};

export default function StudentLearningCourseDetailPage() {
  const {id} = useParams<{id:string}>();
  const router = useRouter();
  const [student, setStudent] = useState<{name?:string;username?:string;organization?:string}>({});
  const [course, setCourse] = useState<Course|null>(null);
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [busyResource, setBusyResource] = useState<number|null>(null);
  const [error, setError] = useState("");
  const activeVideoUrl = useRef("");
  const currentToken = () => localStorage.getItem("student_access_token");

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); } catch { /* Ignore invalid profile data */ }
    const token = currentToken();
    if (!token) { router.replace("/student/login"); return; }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${BASE}/api/recorded-courses/learning/student/courses/${id}/`, {
          headers: {Authorization:`Bearer ${token}`}, cache:"no-store", signal: controller.signal,
        });
        if (response.status === 401) { router.replace("/student/login"); return; }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Cannot open this course.");
        const next: Course = data.course;
        setCourse(next);
        setSelectedId(current => current && next.modules.some(m => m.lessons.some(l => l.id === current))
          ? current : next.modules.flatMap(m => m.lessons)[0]?.id ?? null);
      } catch(e) {if(!controller.signal.aborted) setError(e instanceof Error?e.message:"Cannot open this course.");}
      finally {if(!controller.signal.aborted)setLoading(false);}
    };
    void load();
    return () => controller.abort();
  }, [id,router]);

  useEffect(() => {
    const token = currentToken();
    if (!selectedId || !token) {setVideoUrl("");return;}
    const controller = new AbortController();
    const loadVideo = async () => {
      setVideoLoading(true);
      try {
        const response = await fetch(`${BASE}/api/recorded-courses/student/lessons/${selectedId}/play/`, {
          headers:{Authorization:`Bearer ${token}`}, signal:controller.signal, cache:"no-store",
        });
        if (!response.ok) { const errorJson = await response.json().catch(() => ({}));throw new Error(errorJson.detail || "Cannot play this lecture."); }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        if (activeVideoUrl.current) URL.revokeObjectURL(activeVideoUrl.current);
        activeVideoUrl.current = url;
        setVideoUrl(url);
      } catch(e) {if(!controller.signal.aborted) setError(e instanceof Error?e.message:"Video unavailable.");}
      finally {if(!controller.signal.aborted)setVideoLoading(false);}
    };
    setError("");setVideoUrl("");
    void loadVideo();
    return () => {
      controller.abort();
      if (activeVideoUrl.current) {URL.revokeObjectURL(activeVideoUrl.current);activeVideoUrl.current="";}
    };
  }, [selectedId]);

  const lessons = course?.modules.flatMap(module => module.lessons) || [];
  const selected = lessons.find(lesson => lesson.id === selectedId);
  const selectedIndex = lessons.findIndex(lesson => lesson.id === selectedId);
  const percent = course?.total_lessons ? Math.round(course.completed_lessons/course.total_lessons*100):0;

  async function finishedLesson() {
    const token = currentToken();
    if (!token || !selectedId || selected?.completed) return;
    const lessonId=selectedId;
    try {
      const result = await fetch(`${BASE}/api/recorded-courses/learning/student/lessons/${lessonId}/complete/`,{
        method:"POST",headers:{Authorization:`Bearer ${token}`},
      });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(body.detail || "Unable to save lecture progress.");
      setCourse(previous => previous ? ({...previous,
        completed_lessons:previous.completed_lessons+1,
        modules:previous.modules.map(module => module.lessons.some(l=>l.id===lessonId) ? ({...module,
          completed_lessons: module.completed_lessons+1,
          lessons:module.lessons.map(l=>l.id===lessonId?{...l,completed:true}:l),
        }):module),
      }):previous);
    }catch(e){setError(e instanceof Error?e.message:"Unable to save progress.");}
  }

  async function download(resource:Resource) {
    const token = currentToken();if(!token)return;
    setBusyResource(resource.id);setError("");
    try {
      const response = await fetch(`${BASE}/api/recorded-courses/learning/student/resources/${resource.id}/download/`, {
        headers:{Authorization:`Bearer ${token}`},cache:"no-store",
      });
      if (!response.ok) {const data=await response.json().catch(()=>({}));throw new Error(data.detail || "Cannot download resource.");}
      const blob=await response.blob(),url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`${resource.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "course-notes"}.${resource.extension}`;
      document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError(e instanceof Error?e.message:"Download failed.");}
    finally{setBusyResource(null);}
  }

  return <div className="student-dashboard"><StudentSidebar/><main className="student-dashboard-main">
    <StudentTopbar name={student.name||student.username||"Student"} organization={student.organization||""} />
    <div className="student-dashboard-content"><div className="container-fluid student-learning">
      <header className="learning-heading"><div><span className="learning-kicker">LEARNING CENTER</span><h1>{course?.title || "Course modules"}</h1>
        <p>{course?.description || "Your recorded lectures and study resources"}</p></div>
        <Link className="btn btn-outline-primary" href="/student/learning">← All courses</Link></header>
      {error && <div className="alert alert-warning" role="alert">{error}</div>}
      {loading ? <div className="learning-empty">Loading your learning materials...</div> : !course ?
        <div className="learning-empty">This course is unavailable or your course access has expired.</div> : <>
        <section className="learning-summary">
          <div><strong>{course.modules.length}</strong><span>Published modules</span></div>
          <div><strong>{course.completed_lessons}/{course.total_lessons}</strong><span>Lectures viewed</span></div>
          <div className="learning-summary-progress"><strong>{percent}%</strong><span>Reported video progress</span>
            <div className="learning-meter"><span style={{width:`${percent}%`}} /></div></div>
        </section>
        <div className="learning-workspace">
          <section className="learning-viewer" aria-label="Course lecture player">
            <div className="learning-viewer-header"><small>NOW PLAYING</small><h2>{selected?.title || "Choose a lecture"}</h2></div>
            <div className="learning-video-wrap">
              {videoLoading ? <span>Loading secure lecture...</span> : videoUrl ?
                <video key={videoUrl} controls controlsList="nodownload" disablePictureInPicture
                  src={videoUrl} onContextMenu={event=>event.preventDefault()} onEnded={()=>void finishedLesson()} /> :
                <span>{selected ? "Video is unavailable." : "Select a lecture from a module."}</span>}
            </div>
            <div className="learning-viewer-info"><p>{selected?.description || "Play a lecture to learn at your own pace."}</p>
              {selected?.completed && <span className="learning-done"><i className="bi bi-check-circle-fill" /> Viewed</span>}
              <div className="learning-prev-next"><button className="btn btn-outline-secondary" disabled={selectedIndex<=0} onClick={()=>setSelectedId(lessons[selectedIndex-1].id)}>Previous</button>
              <button className="btn btn-primary" disabled={selectedIndex<0||selectedIndex>=lessons.length-1} onClick={()=>setSelectedId(lessons[selectedIndex+1].id)}>Next lecture</button></div>
              <p className="learning-fineprint">A video reaching its end is recorded as learner-reported viewing. Module quizzes and final certification requirements will be added separately.</p>
            </div>
          </section>
          <aside className="learning-modules" aria-label="Published course modules">
            <h2>Course content</h2>
            {course.modules.length === 0 ? <p>No published modules yet. Please check back later.</p> :
              course.modules.map(module=><details key={module.id} className="learning-module" defaultOpen={module.lessons.some(l=>l.id===selectedId)}>
                <summary><span className="learning-module-index">{String(module.position).padStart(2,"0")}</span><span><strong>{module.title}</strong><small>{module.completed_lessons}/{module.total_lessons} viewed</small></span><i className="bi bi-chevron-down" /></summary>
                {module.description && <p className="learning-module-description">{module.description}</p>}
                <div className="learning-lesson-items">{module.lessons.map(lesson=><button type="button" key={lesson.id} className={"learning-lesson-button"+(selectedId===lesson.id?" is-selected":"")}
                  onClick={()=>setSelectedId(lesson.id)} aria-current={selectedId===lesson.id?"true":undefined}>
                  <i className={`bi ${lesson.completed?"bi-check-circle-fill":"bi-play-circle"}`} aria-hidden="true" /><span>{lesson.title}</span></button>)}</div>
                {module.resources.length>0 && <div className="learning-resource-list"><h3>Notes & resources</h3>
                  {module.resources.map(resource=><button key={resource.id} type="button" disabled={busyResource===resource.id} onClick={()=>void download(resource)}>
                    <i className="bi bi-file-earmark-arrow-down" /><span>{resource.title} <small>({resource.extension.toUpperCase()})</small></span><i className="bi bi-download" /></button>)}</div>}
              </details>)}
          </aside>
        </div>
      </>}
    </div></div>
  </main></div>;
}
