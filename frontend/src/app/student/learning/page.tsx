"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import "../dashboard/dashboard.css";
import "./learning.css";

type Course = {
  id: number;
  title: string;
  description: string;
  module_count: number;
  completed_lessons: number;
  total_lessons: number;
  access_expires_at: string | null;
};
type Certificate={id:string;course_id:number;course_title:string;issued_at:string;score_percent:number;revoked:boolean};
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function StudentLearningCoursesPage() {
  const router = useRouter();
  const [student, setStudent] = useState<{name?:string;username?:string;organization?:string}>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [certificates,setCertificates] = useState<Certificate[]>([]);
  const [certificateBusy,setCertificateBusy] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try { setStudent(JSON.parse(localStorage.getItem("student_user") || "{}")); } catch { /* Ignore invalid stored profile. */ }
    const token = localStorage.getItem("student_access_token");
    if (!token) { router.replace("/student/login"); return; }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${BASE}/api/recorded-courses/learning/student/courses/`, {
          headers: {Authorization: `Bearer ${token}`}, cache: "no-store", signal: controller.signal,
        });
        if (response.status === 401) { router.replace("/student/login"); return; }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.detail || "Unable to load your learning courses.");
        setCourses(result.courses || []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load courses.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    // Certificates stay accessible even when the Learning feature is disabled.
    void fetch(`${BASE}/api/recorded-courses/learning/student/certificates/`, {
      headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:controller.signal,
    }).then(async response => response.ok ? response.json():null)
      .then(data=>{if(!controller.signal.aborted&&data)setCertificates(data.certificates||[]);})
      .catch(()=>{});
    return () => controller.abort();
  }, [router]);

  async function downloadCertificate(id:string){
    const token=localStorage.getItem("student_access_token");
    if(!token){setError("Please sign in again.");return;}
    setCertificateBusy(id);
    try{
      const response=await fetch(`${BASE}/api/recorded-courses/learning/student/certificates/${encodeURIComponent(id)}/pdf/`,{
        headers:{Authorization:`Bearer ${token}`},cache:"no-store",
      });
      if(!response.ok)throw Error("Unable to download this certificate.");
      const blob=await response.blob(),url=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=url;link.download="MySLS-Certificate-"+id+".pdf";
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError(e instanceof Error?e.message:"Certificate download failed.");}
    finally{setCertificateBusy(null);}
  }

  return <div className="student-dashboard">
    <StudentSidebar />
    <main className="student-dashboard-main">
      <StudentTopbar name={student.name || student.username || "Student"} organization={student.organization || ""} />
      <div className="student-dashboard-content"><div className="container-fluid student-learning">
        <header className="learning-heading">
          <div><span className="learning-kicker">MY LEARNING CENTER</span><h1>My Courses</h1>
            <p>Watch published lessons, find your course notes and keep track of the lectures you finish.</p></div>
          <Link className="btn btn-outline-primary" href="/student/recorded-courses">Explore courses</Link>
        </header>
        {error && <div className="alert alert-warning" role="alert">{error}</div>}
        {loading ? <div className="learning-empty">Loading your courses...</div> : courses.length === 0 && !error ?
          <div className="learning-empty"><h2>No enrolled courses yet</h2><p>Courses with approved, active access will appear here when your organization enables Recorded Learning.</p>
            <Link href="/student/recorded-courses" className="btn btn-primary">Browse recorded courses</Link></div> :
          <div className="learning-cards">{courses.map(course => {
            const percentage = course.total_lessons ? Math.round(course.completed_lessons / course.total_lessons * 100) : 0;
            return <article className="learning-card" key={course.id}>
              <div className="learning-card-icon" aria-hidden="true"><i className="bi bi-play-btn" /></div>
              <div className="learning-card-body">
                <span className="learning-card-label">RECORDED COURSE</span><h2>{course.title}</h2>
                <p>{course.description || "Work through the video lectures and study resources."}</p>
                <div className="learning-card-meta"><span>{course.module_count} published modules</span><span>{course.completed_lessons}/{course.total_lessons} lectures viewed</span></div>
                <div className="learning-meter" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Reported lesson progress for ${course.title}`}><span style={{width:`${percentage}%`}} /></div>
                <div className="learning-card-bottom"><span>{percentage}% viewed</span><Link className="btn btn-primary" href={`/student/learning/${course.id}`}>Continue learning <i className="bi bi-arrow-right" /></Link></div>
              </div>
            </article>;
          })}</div>}
        {certificates.length>0&&<section className="learning-empty" aria-label="Earned course certificates">
          <h2 className="h5 fw-bold">My Certificates</h2>
          <p>Download valid certificates or check their issuance status.</p>
          <div className="d-grid gap-3">{certificates.map(certificate=><article key={certificate.id}
            className="border rounded-3 p-3 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div><strong>{certificate.course_title}</strong>
              <p className="small text-muted mb-0">Issued {new Date(certificate.issued_at).toLocaleDateString()} · Final score {certificate.score_percent}%</p>
              <span className={certificate.revoked?"text-danger small":"text-success small"}>{certificate.revoked?"Revoked":"Issued"}</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link href={"/verify/certificate/"+certificate.id} className="btn btn-outline-secondary btn-sm">Verify</Link>
              {!certificate.revoked&&<button type="button" className="btn btn-primary btn-sm"
                disabled={certificateBusy===certificate.id} onClick={()=>void downloadCertificate(certificate.id)}>
                {certificateBusy===certificate.id?"Downloading...":"Download PDF"}
              </button>}
            </div>
          </article>)}</div>
        </section>}
        <p className="learning-disclaimer">Video progress is learner-reported; certification requires passing all published course requirements and the final exam.</p>
      </div></div>
    </main>
  </div>;
}
