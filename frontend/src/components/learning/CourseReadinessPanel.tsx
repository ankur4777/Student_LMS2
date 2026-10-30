"use client";
import {useEffect,useState} from "react";
type Role="teacher"|"college_admin";
type Check={code:string;passed:boolean;message:string};
type Module={id:number;position:number;title:string;published:boolean;active_lessons:number;verified_lessons:number;quiz_status:string;quiz_questions:number;assignment_status:string};
type Metrics={active:number;manual_active:number;purchased_active:number;expired:number;revoked:number;pending_grading:number;issued_certificates:number};
type Report={ready_for_final_exam:boolean;checks:Check[];warnings:string[];modules:Module[];enrollments:Metrics};
const API=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");
export default function CourseReadinessPanel({courseId,role}:{courseId:number;role:Role}){
 const [data,setData]=useState<Report|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  const token=localStorage.getItem(role==="teacher"?"teacher_access_token":"college_admin_access_token");
  if(!token){setError("Sign in again.");setLoading(false);return;}
  setLoading(true);setError("");
  fetch(API+"/api/recorded-courses/learning/manage/courses/"+courseId+"/readiness/",{
   headers:{Authorization:"Bearer "+token},signal:controller.signal,cache:"no-store"
  }).then(async response=>{
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.detail||"Unable to load checklist.");
   return result as Report;
  }).then(result=>{if(!controller.signal.aborted)setData(result);})
    .catch(e=>{if(!controller.signal.aborted)setError(String(e));})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[courseId,role,version]);
 const metrics=data?.enrollments;
 return <section className="card border-0 shadow-sm my-4" aria-label="Course certification readiness">
  <div className="card-body p-4">
   <div className="d-flex justify-content-between align-items-center gap-2">
    <h3 className="h5 fw-bold">Course Readiness</h3>
    <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={()=>setVersion(x=>x+1)}>Refresh</button>
   </div>
   <p className="small text-muted">Course configuration checklist and enrollment activity. Student completion is checked separately.</p>
   {loading&&<p role="status">Checking course…</p>}
   {error&&<p role="alert" className="alert alert-danger">{error}</p>}
   {!loading&&data&&<>
    <p className={data.ready_for_final_exam?"text-success fw-semibold":"text-warning fw-semibold"}>
     {data.ready_for_final_exam?"Ready for final-exam testing":"Course setup needs attention"}
    </p>
    <ul>{data.checks.map(c=><li key={c.code}>{c.passed?"Ready":"Needs work"}: {c.message}</li>)}</ul>
    {metrics&&<div className="row g-2 mb-3">{([
     ["Active",metrics.active],["Assigned",metrics.manual_active],["Purchased",metrics.purchased_active],
     ["Expired",metrics.expired],["Revoked",metrics.revoked],
     ["Awaiting grading",metrics.pending_grading],["Valid certificates",metrics.issued_certificates]
    ] as [string,number][]).map(([label,value])=><div key={label} className="col-6 col-md-3">
      <div className="border rounded-3 p-3"><div className="small text-muted">{label}</div><strong>{value}</strong></div>
    </div>)}</div>}
    <div className="table-responsive"><table className="table table-sm">
     <thead><tr><th>Module</th><th>Published</th><th>Videos</th><th>Quiz</th><th>Assignment</th></tr></thead>
     <tbody>{data.modules.map(m=><tr key={m.id}><td>{m.position}. {m.title}</td><td>{m.published?"Yes":"No"}</td>
      <td>{m.verified_lessons}/{m.active_lessons} verified</td><td>{m.quiz_status} ({m.quiz_questions})</td><td>{m.assignment_status}</td></tr>)}</tbody>
    </table></div>
    {data.warnings.length>0&&<div className="mt-2"><strong>Drafts to review</strong><ul>{data.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
   </>}
  </div>
 </section>;
}
