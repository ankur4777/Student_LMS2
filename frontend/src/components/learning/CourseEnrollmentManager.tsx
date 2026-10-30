"use client";

import {FormEvent, useCallback, useEffect, useState} from "react";

const API=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");

type CourseAccess = {
  status:"not_enrolled"|"active"|"revoked"|"expired"|"inactive";
  source:"purchase"|"manual"|null;
  starts_at?:string; expires_at:string|null; revoke_reason?:string;
};
type StudentEnrollment = {
  id:number;name:string;username:string;admission_number:string;
  access:CourseAccess;
};
type EnrollmentPage = {
  course_id:number;course_title:string;students_total:number;
  page:number;page_size:number;has_next:boolean;students:StudentEnrollment[];
};

export default function CourseEnrollmentManager({courseId}:{courseId:number}){
  const root=API+"/api/recorded-courses/learning/manage/courses/"+courseId+"/enrollments/";
  const [data,setData]=useState<EnrollmentPage|null>(null);
  const [page,setPage]=useState(1);
  const [searchDraft,setSearchDraft]=useState("");
  const [search,setSearch]=useState("");
  const [days,setDays]=useState("");
  const [busyId,setBusyId]=useState<number|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const authorizedFetch=useCallback(async(url:string,init:RequestInit={})=>{
    const token=localStorage.getItem("college_admin_access_token");
    if(!token)throw Error("Please sign in again as College Admin.");
    const response=await fetch(url,{
      ...init,cache:"no-store",
      headers:{Authorization:"Bearer "+token,...(init.headers||{})},
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.detail||"Request failed (HTTP "+response.status+").");
    return result;
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    setError("");
    const query=new URLSearchParams({page:String(page)});
    if(search)query.set("search",search);
    void authorizedFetch(root+"?"+query.toString(),{signal:controller.signal})
      .then(response=>{if(!controller.signal.aborted)setData(response as EnrollmentPage);})
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Could not load enrolled students.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[root,page,search,refresh,authorizedFetch]);

  async function changeEnrollment(student:StudentEnrollment,operation:"grant"|"revoke"){
    let reason="";
    if(operation==="revoke"){
      const supplied=window.prompt("Reason for revoking "+student.name+"'s manual course access:");
      if(!supplied?.trim())return;
      reason=supplied.trim();
      if(reason.length>255){setError("Revocation reason must be at most 255 characters.");return;}
    }
    if(operation==="grant"&&days!==""&&(!/^[0-9]+$/.test(days)||Number(days)<1||Number(days)>3650)){
      setError("Access duration must be 1–3650 days.");return;
    }
    setError("");setNotice("");setBusyId(student.id);
    try{
      const payload:Record<string,unknown>={student_id:student.id};
      if(operation==="grant"&&days!=="")payload.duration_days=Number(days);
      if(operation==="revoke")payload.reason=reason;
      const result=await authorizedFetch(root,{
        method:operation==="grant"?"POST":"PATCH",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
      });
      setNotice(result.message||"Course access updated.");
      setRefresh(value=>value+1);
    }catch(err){
      setError(err instanceof Error?err.message:"Could not update course access.");
    }finally{setBusyId(null);}
  }

  function doSearch(event:FormEvent){
    event.preventDefault();
    setPage(1);setSearch(searchDraft.trim());
    setRefresh(value=>value+1);
  }

  return <section className="card border-0 shadow-sm my-4" aria-label="Manual student course enrollment">
    <div className="card-body p-4">
      <div className="mb-3">
        <h3 className="h5 fw-bold mb-1">Enroll Students in Learning Course</h3>
        <p className="text-muted small mb-0">
          Assign a course directly to a student in your organization. Existing purchased access cannot be changed here.
        </p>
      </div>
      <form className="row g-2 align-items-end mb-3" onSubmit={doSearch}>
        <label className="col-md-6">Find student
          <input className="form-control" placeholder="Name, username or admission number"
            maxLength={80} value={searchDraft} onChange={event=>setSearchDraft(event.target.value)}/>
        </label>
        <label className="col-md-3">Access duration (days)
          <input className="form-control" type="number" min={1} max={3650} placeholder="Course default"
            value={days} onChange={event=>setDays(event.target.value)}/>
        </label>
        <div className="col-md-3 d-flex gap-2">
          <button className="btn btn-primary btn-sm" type="submit">Search</button>
          {search&&<button className="btn btn-outline-secondary btn-sm" type="button"
            onClick={()=>{setSearch("");setSearchDraft("");setPage(1);}}>Clear</button>}
        </div>
      </form>
      {error&&<div className="alert alert-danger py-2" role="alert">{error}</div>}
      {notice&&<div className="alert alert-success py-2" role="status">{notice}</div>}
      {loading&&<p className="small text-muted" role="status">Loading students…</p>}
      {!loading&&data&&<>
        <p className="text-muted small">{data.students_total} eligible students {search?"matching your search":""}</p>
        {data.students.length===0?<p className="text-muted">No matching students.</p>:
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead><tr><th scope="col">Student</th><th scope="col">Access</th>
                <th scope="col">Expiry</th><th scope="col">Action</th></tr></thead>
              <tbody>{data.students.map(student=>{
                const {access}=student;
                const paid=access.source==="purchase";
                const manualActive=access.source==="manual"&&access.status==="active";
                return <tr key={student.id}>
                  <td><strong>{student.name}</strong>
                    <div className="small text-muted">{student.admission_number}</div>
                  </td>
                  <td><span className={access.status==="active"?"text-success":"text-secondary"}>
                    {access.status.replace(/_/g," ")}
                  </span>{paid&&<div className="small text-muted">Purchased — protected</div>}
                  {access.source==="manual"&&<div className="small text-muted">Assigned by College Admin</div>}</td>
                  <td>{access.expires_at?new Date(access.expires_at).toLocaleDateString():"—"}</td>
                  <td>
                    {paid?<span className="small text-muted">Managed via purchases</span>:
                      manualActive?<button type="button" className="btn btn-outline-danger btn-sm"
                        disabled={busyId!==null} onClick={()=>void changeEnrollment(student,"revoke")}>Revoke</button>:
                      <button type="button" className="btn btn-outline-primary btn-sm"
                        disabled={busyId!==null} onClick={()=>void changeEnrollment(student,"grant")}>
                        {access.source==="manual"?"Renew access":"Assign course"}
                      </button>}
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        <div className="d-flex align-items-center justify-content-between mt-3">
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page<=1}
            onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
          <span className="small text-muted">Page {page}</span>
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={!data.has_next}
            onClick={()=>setPage(p=>p+1)}>Next</button>
        </div>
      </>}
    </div>
  </section>;
}
