"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";

type Metrics={
 enrolled_students:number;active_enrollments:number;manual_active:number;purchased_active:number;
 expired_enrollments:number;revoked_enrollments:number;final_attempts:number;
 students_attempted_final:number;students_passed_final:number;
 pending_assignment_grading:number;graduated_students:number;
 valid_certificates:number;revoked_certificates:number;graduation_percent:number;
};
type Course=Metrics&{
 course_id:number;title:string;active:boolean;published_modules:number;
 average_attempt_score:number|null;
};
type Totals=Metrics&{courses:number;active_courses:number};
type Analytics={totals:Totals;courses:Course[];definitions:Record<string,string>};
const API=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");

export default function OrganizationLearningAnalytics(){
 const [data,setData]=useState<Analytics|null>(null);
 const [enabled,setEnabled]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [exporting,setExporting]=useState(false);
 useEffect(()=>{
  const abort=new AbortController();
  const token=localStorage.getItem("college_admin_access_token");
  if(!token){setLoading(false);return;}
  setLoading(true);setError("");
  void fetch(API+"/api/recorded-courses/learning/manage/analytics/",{
   headers:{Authorization:"Bearer "+token},cache:"no-store",signal:abort.signal,
  }).then(async response=>{
   if(response.status===403){
    if(!abort.signal.aborted){setEnabled(false);setData(null);}
    return null;
   }
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.detail||"Unable to load learning analytics.");
   return body as Analytics;
  }).then(body=>{
   if(body&&!abort.signal.aborted){setData(body);setEnabled(true);}
  }).catch(err=>{
   if(!abort.signal.aborted){setEnabled(true);setError(err instanceof Error?err.message:"Unable to load analytics.");}
  }).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return ()=>abort.abort();
 },[refresh]);
 const courses=useMemo(()=>data?.courses.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()))||[],[data,search]);
 async function exportCSV(){
  const token=localStorage.getItem("college_admin_access_token");
  if(!token){setError("Please sign in again to export analytics.");return;}
  setError("");setExporting(true);
  try{
   const params=new URLSearchParams();
   if(search.trim())params.set("search",search.trim());
   const url=API+"/api/recorded-courses/learning/manage/analytics/export.csv"+
    (params.size?"?"+params.toString():"");
   const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(!response.ok){
    const result=await response.json().catch(()=>({}));
    throw Error(result.detail||"Analytics download failed.");
   }
   const blob=await response.blob();
   const objectUrl=URL.createObjectURL(blob);
   const anchor=document.createElement("a");
   anchor.href=objectUrl;
   anchor.download="mysls-learning-analytics.csv";
   document.body.appendChild(anchor);
   anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }catch(e){setError(e instanceof Error?e.message:"Unable to export analytics.");}
  finally{setExporting(false);}
 }
 // An organization with Learning & Certification switched OFF sees none of
 // this optional dashboard, keeping its existing paid course list unchanged.
 if(!enabled)return null;
 const t=data?.totals;
 return <section className="card border-0 shadow-sm mb-4" aria-label="Organization learning analytics">
  <div className="card-body p-4">
   <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
    <div><h3 className="h5 fw-bold mb-1">Learning & Certification Analytics</h3>
     <p className="text-muted small mb-0">Organization-wide totals across recorded-learning courses. No individual student details.</p>
    </div>
    <div className="d-flex flex-wrap gap-2">
     <button className="btn btn-outline-success btn-sm" disabled={loading||exporting}
      type="button" onClick={()=>void exportCSV()}>
      {exporting?"Exporting...":"Export CSV"}
     </button>
     <button className="btn btn-outline-primary btn-sm" disabled={loading}
      type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh analytics</button>
    </div>
   </div>
   {loading&&<p role="status" className="small text-muted">Loading analytics…</p>}
   {error&&<div className="alert alert-danger" role="alert">{error}</div>}
   {!loading&&t&&<>
    <div className="row g-3 mb-4">{([
     ["Recorded courses",t.courses],
     ["Course enrollments",t.enrolled_students],
     ["Active access",t.active_enrollments],
     ["Passed final",t.students_passed_final],
     ["Graduated course enrollments",t.graduated_students],
     ["Valid certificates",t.valid_certificates],
     ["Awaiting grading",t.pending_assignment_grading],
     ["Revoked certificates",t.revoked_certificates],
    ] as [string,number][]).map(([name,value])=><div className="col-6 col-lg-3" key={name}>
     <div className="border rounded-3 p-3 h-100">
      <div className="text-muted small">{name}</div><div className="h4 fw-bold mb-0">{value}</div>
     </div></div>)}</div>
    <div className="d-flex justify-content-between gap-3 flex-wrap align-items-center mb-2">
     <h4 className="h6 fw-bold mb-0">Performance by course</h4>
     <input className="form-control" aria-label="Filter courses by title"
      style={{maxWidth:290}} value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Filter courses by title"/>
    </div>
    {courses.length===0?<p className="text-muted small">No matching courses.</p>:
     <div className="table-responsive"><table className="table table-hover align-middle">
      <thead><tr><th>Course</th><th>Enrolled</th><th>Active</th>
       <th>Passed final</th><th>Graduated</th><th>Avg. exam attempt</th>
       <th>Pending grading</th><th>Certificates</th></tr></thead>
      <tbody>{courses.map(c=><tr key={c.course_id}>
       <td><Link href={"/college-admin/recorded-courses/"+c.course_id}
        className="fw-semibold">{c.title}</Link>
        <div className="small text-muted">{c.published_modules} published modules · {c.active?"Active":"Inactive"}</div></td>
       <td>{c.enrolled_students}</td><td>{c.active_enrollments}</td>
       <td>{c.students_passed_final}</td>
       <td style={{minWidth:135}}>{c.graduated_students} / {c.enrolled_students}
        <div className="progress mt-1" style={{height:6}} role="progressbar"
         aria-label={"Graduation rate for "+c.title} aria-valuenow={c.graduation_percent}
         aria-valuemin={0} aria-valuemax={100}>
         <div className="progress-bar" style={{width:c.graduation_percent+"%"}}/>
        </div><small>{c.graduation_percent}%</small>
       </td>
       <td>{c.average_attempt_score===null?"—":c.average_attempt_score+"%"}</td>
       <td>{c.pending_assignment_grading}</td>
       <td>{c.valid_certificates} valid{c.revoked_certificates>0&&
        <div className="small text-muted">{c.revoked_certificates} revoked</div>}</td>
      </tr>)}</tbody></table></div>}
    <p className="small text-muted mb-0">
     Enrollment counts are per course (a learner in two courses counts twice).
     “Graduated” means a certificate was issued, including later-revoked certificates.
     Exam averages include all attempts, not only best attempts.
    </p>
   </>}
  </div>
 </section>;
}
