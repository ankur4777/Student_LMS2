"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import StudentSidebar from "@/components/student/studentsidebar";
import StudentTopbar from "@/components/student/studentTopbar";
import "../dashboard/dashboard.css";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL;
type StudentUser={username?:string;name?:string;organization?:string};
type RecordedClass={id:number;title:string;class_date:string;start_time:string;end_time:string;teacher_name:string;subject_name:string;section_name:string;recording_public_id:string|null};
type PurchasedCourse={id:number;title:string;description:string;access_expires_at:string|null;lessons:{id:number;title:string;description:string;position:number;is_active:boolean}[]};

function saved(){if(typeof window==="undefined")return {};try{return JSON.parse(localStorage.getItem("student_user")||"{}")}catch{return {}}}

export default function StudentRecordedClassesPage(){
 const router=useRouter();const [student]=useState<StudentUser>(saved);const [classes,setClasses]=useState<RecordedClass[]>([]);const [courses,setCourses]=useState<PurchasedCourse[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{const token=localStorage.getItem("student_access_token");if(!token){router.replace("/student/login");return}
 async function load(){try{setLoading(true);setError("");const h={Authorization:"Bearer "+token};const [lr,pr]=await Promise.all([fetch(API_BASE+"/api/live-classes/student/recorded/",{headers:h}),fetch(API_BASE+"/api/recorded-courses/student/my-courses/",{headers:h})]);if(lr.status===401||pr.status===401){localStorage.removeItem("student_access_token");localStorage.removeItem("student_refresh_token");localStorage.removeItem("student_user");router.replace("/student/login");return}const lj=await lr.json(),pj=await pr.json();if(!lr.ok)throw new Error(lj.detail||"Unable to load recorded classes.");if(!pr.ok)throw new Error(pj.detail||"Unable to load purchased courses.");setClasses(lj);setCourses(pj.courses||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load recordings.")}finally{setLoading(false)}}void load()},[router]);
 return <div className="student-dashboard"><StudentSidebar/><main className="student-dashboard-main"><StudentTopbar name={student.name||student.username||"Student"} organization={student.organization||""}/><div className="student-dashboard-content"><div className="container-fluid">
 <div className="dashboard-panel mb-4"><div className="panel-heading"><div><h5 className="mb-1">Purchased Recorded Courses</h5><small className="text-muted">Courses unlocked after payment verification.</small></div><span className="badge bg-success">{courses.length}</span></div>
 {loading&&<div className="empty-state">Loading recordings...</div>}{error&&<div className="alert alert-danger">{error}</div>}{!loading&&!error&&courses.length===0&&<div className="empty-state">No purchased recorded courses with active access.</div>}
 {!loading&&!error&&courses.length>0&&<div className="row g-3">{courses.map(c=><div className="col-lg-4 col-md-6" key={c.id}><div className="border rounded p-3 h-100 d-flex flex-column"><h5 className="fw-bold">{c.title}</h5><p className="text-muted flex-grow-1">{c.description||"Recorded course"}</p><p className="small mb-2">Lessons: <strong>{c.lessons.length}</strong></p>{c.access_expires_at&&<p className="small mb-3">Access until: <strong>{new Date(c.access_expires_at).toLocaleDateString()}</strong></p>}<Link href={"/student/recorded-courses/"+c.id} className="btn btn-success btn-sm align-self-start">Open Course</Link></div></div>)}</div>}</div>
 <div className="dashboard-panel"><div className="panel-heading"><div><h5 className="mb-1">Class Recordings</h5><small className="text-muted">Recordings from your regular live classes.</small></div><span className="badge bg-primary">{classes.length}</span></div>
 {!loading&&!error&&classes.length===0&&<div className="empty-state">No class recordings found.</div>}{!loading&&!error&&classes.length>0&&<div className="row g-3">{classes.map(r=><div key={r.id} className="col-lg-4 col-md-6"><div className="border rounded p-3 h-100"><h6 className="fw-bold">{r.title}</h6><p className="text-muted small mb-2">{r.subject_name} • {r.section_name}</p><p className="small mb-1">Teacher: {r.teacher_name||"-"}</p><p className="small mb-1">Date: {r.class_date}</p><p className="small mb-3">Time: {r.start_time} - {r.end_time}</p>{r.recording_public_id&&<Link href={"/student/recordings/"+r.recording_public_id} className="btn btn-primary btn-sm">Watch Recording</Link>}</div></div>)}</div>}</div>
 </div></div></main></div>
}