"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";

type Role="teacher"|"college_admin";
type Question={id:number;prompt:string;position:number;choices:string[];correct_index:number};
type Exam={id:number;title:string;passing_percent:number;max_attempts:number;is_published:boolean;question_count:number;attempt_count:number;questions:Question[]};
type Certificate={id:string;student:string;admission_number:string;issued_at:string;score_percent:number;status:string;revoked_at:string|null};
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");

export default function CourseFinalExamBuilder({courseId,role}:{courseId:number;role:Role}){
 const base=BASE+"/api/recorded-courses/learning/manage/courses/"+courseId+"/",url=base+"final-exam/";
 const [exam,setExam]=useState<Exam|null>(null),[certificates,setCertificates]=useState<Certificate[]>([]);
 const [certPage,setCertPage]=useState(1),[certTotal,setCertTotal]=useState(0),[certHasNext,setCertHasNext]=useState(false);
 const [certSearchDraft,setCertSearchDraft]=useState(""),[certSearch,setCertSearch]=useState("");
 const [certStatus,setCertStatus]=useState("all"),[certExporting,setCertExporting]=useState(false);
 const [title,setTitle]=useState("Final Course Examination"),[passing,setPassing]=useState(70),[maxAttempts,setMaxAttempts]=useState(3);
 const [prompt,setPrompt]=useState(""),[choices,setChoices]=useState(["","","",""]),[correct,setCorrect]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const call=useCallback(async(path:string,init:RequestInit={})=>{
  const key=role==="teacher"?"teacher_access_token":"college_admin_access_token";
  const token=localStorage.getItem(key);
  if(!token)throw Error("Please sign in again.");
  const res=await fetch(path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+token,...(init.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.detail||"Final exam request failed.");
  return data;
 },[role]);
 const reload=useCallback(async()=>{
  const data=await call(url),next:Exam|null=data.exam||null;
  setExam(next);
  if(next){setTitle(next.title);setPassing(next.passing_percent);setMaxAttempts(next.max_attempts);}
  if(role==="college_admin"){
   const params=new URLSearchParams({page:String(certPage),status:certStatus});
   if(certSearch)params.set("search",certSearch);
   const results=await call(base+"certificates/?"+params.toString());
   setCertificates(results.certificates||[]);
   setCertTotal(results.total??0);setCertHasNext(!!results.has_next);
  }
 },[call,url,base,role,certPage,certStatus,certSearch]);
 useEffect(()=>{void reload().catch(e=>setError(String(e)));},[reload]);
 async function run(fn:()=>Promise<void>){setBusy(true);setError("");setNotice("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Unable to save.");}finally{setBusy(false);}
 }
 async function save(e:FormEvent){e.preventDefault();await run(async()=>{
  await call(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   title,passing_percent:passing,max_attempts:maxAttempts,
  })});
  await reload();setNotice("Final exam draft saved.");
 });}
 async function addQuestion(e:FormEvent){e.preventDefault();await run(async()=>{
  await call(url+"questions/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   prompt,choices,correct_index:correct,
  })});
  setPrompt("");setChoices(["","","",""]);setCorrect(0);await reload();setNotice("Exam question added.");
 });}
 async function toggle(){if(!exam)return;await run(async()=>{
  await call(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_published:!exam.is_published})});
  await reload();setNotice("Exam publication updated.");
 });}
 async function revoke(cert:Certificate){
  const reason=window.prompt("Enter the reason for revoking this certificate:");
  if(!reason?.trim())return;
  await run(async()=>{
   await call(base+"certificates/",{method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({certificate_id:cert.id,reason:reason.trim()})});
   await reload();setNotice("Certificate revoked.");
  });
 }
 async function exportCertificateRegistry(){
  const token=localStorage.getItem("college_admin_access_token");
  if(!token){setError("Please sign in again to export certificates.");return;}
  setError("");setCertExporting(true);
  try{
   const params=new URLSearchParams({status:certStatus});
   if(certSearch)params.set("search",certSearch);
   const response=await fetch(base+"certificates/export.csv?"+params.toString(),{
    headers:{Authorization:"Bearer "+token},cache:"no-store"
   });
   if(!response.ok){
    const result=await response.json().catch(()=>({}));
    throw Error(result.detail||"Certificate export failed.");
   }
   const blob=await response.blob(),objectUrl=URL.createObjectURL(blob);
   const anchor=document.createElement("a");
   anchor.href=objectUrl;anchor.download="mysls-course-"+courseId+"-certificates.csv";
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }catch(e){setError(e instanceof Error?e.message:"Could not export certificates.");}
  finally{setCertExporting(false);}
 }
 const locked=!!exam&&(exam.is_published||exam.attempt_count>0);
 return <section className="card border-0 shadow-sm my-4" aria-label="Final course examination">
  <div className="card-body p-4">
   <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div><h3 className="h5 fw-bold mb-1">Final Course Exam & Certificates</h3>
     <p className="small text-muted mb-0">Released after students complete all published modules and required assessments.</p></div>
    {exam&&<span className={"badge "+(exam.is_published?"bg-success":"bg-secondary")}>{exam.is_published?"Published":"Draft"} · {exam.question_count} questions</span>}
   </div>
   {error&&<p className="alert alert-danger" role="alert">{error}</p>}
   {notice&&<p className="alert alert-success" role="status">{notice}</p>}
   <form onSubmit={save} className="row g-2 mb-3">
    <label className="col-lg-6">Exam title<input className="form-control" maxLength={180} required disabled={busy||locked} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="col-lg-3">Passing (%)<input className="form-control" type="number" min={1} max={100} required disabled={busy||locked} value={passing} onChange={e=>setPassing(Number(e.target.value))}/></label>
    <label className="col-lg-3">Maximum attempts<input className="form-control" type="number" min={1} max={10} required disabled={busy||locked} value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value))}/></label>
    <div className="col-12 d-flex gap-2 flex-wrap">
     <button className="btn btn-outline-primary btn-sm" disabled={busy||locked}>Save exam draft</button>
     {role==="college_admin"&&exam&&<button className="btn btn-primary btn-sm" type="button" disabled={busy||exam.attempt_count>0} onClick={()=>void toggle()}>{exam.is_published?"Unpublish exam":"Publish exam"}</button>}
    </div>
   </form>
   {exam&&<>
    <ol className="ps-4">{exam.questions.map(q=><li className="mb-2" key={q.id}><strong>{q.prompt}</strong>
     <ul>{q.choices.map((choice,i)=><li className={"small "+(i===q.correct_index?"text-success fw-semibold":"")} key={i}>{choice}{i===q.correct_index?" (correct)":""}</li>)}</ul>
    </li>)}</ol>
    {!locked?<form onSubmit={addQuestion} className="border-top pt-3">
     <label className="form-label w-100">New question<input maxLength={1000} className="form-control" value={prompt} required onChange={e=>setPrompt(e.target.value)}/></label>
     <div className="row g-2">{choices.map((choice,i)=><label className="col-md-6" key={i}>Option {i+1}
      <span className="d-flex align-items-center gap-2"><input type="radio" name={"final-correct-"+courseId} checked={correct===i} onChange={()=>setCorrect(i)} aria-label={"Option "+(i+1)+" correct"}/>
       <input className="form-control" maxLength={400} required value={choice} onChange={e=>setChoices(old=>old.map((v,j)=>i===j?e.target.value:v))}/></span>
     </label>)}</div>
     <button className="btn btn-outline-primary btn-sm mt-2" disabled={busy}>Add question</button>
    </form>:<p className="small text-muted">This examination is locked against edits after publication.</p>}
   </>}
   {role==="college_admin"&&<section className="border-top mt-4 pt-3" aria-label="Issued course certificates">
    <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
     <h4 className="h6 fw-bold mb-0">Certificate Registry ({certTotal})</h4>
     <button type="button" className="btn btn-outline-success btn-sm"
       disabled={busy||certExporting} onClick={()=>void exportCertificateRegistry()}>
       {certExporting?"Exporting...":"Export CSV"}
     </button>
    </div>
    <form className="d-flex flex-wrap gap-2 my-3" onSubmit={e=>{
     e.preventDefault();setCertPage(1);setCertSearch(certSearchDraft.trim());
    }}>
     <input className="form-control" aria-label="Search certificates by student"
       style={{maxWidth:320}} maxLength={80} placeholder="Student name or admission number"
       value={certSearchDraft} onChange={e=>setCertSearchDraft(e.target.value)}/>
     <select className="form-select" aria-label="Certificate status" style={{maxWidth:170}}
       value={certStatus} onChange={e=>{setCertStatus(e.target.value);setCertPage(1);}}>
      <option value="all">All statuses</option><option value="issued">Issued</option>
      <option value="revoked">Revoked</option>
     </select>
     <button type="submit" className="btn btn-primary btn-sm">Search</button>
     {certSearch&&<button type="button" className="btn btn-outline-secondary btn-sm" onClick={()=>{
      setCertSearchDraft("");setCertSearch("");setCertPage(1);
     }}>Clear</button>}
    </form>
    {certificates.length===0?<p className="small text-muted">No certificates match these filters.</p>:
     <div className="table-responsive"><table className="table table-sm align-middle">
      <thead><tr><th>Student</th><th>Issued</th><th>Exam score</th><th>Status</th><th>Certificate</th></tr></thead>
      <tbody>{certificates.map(c=><tr key={c.id}>
       <td>{c.student}<div className="small text-muted">{c.admission_number}</div></td>
       <td>{new Date(c.issued_at).toLocaleDateString()}</td><td>{c.score_percent}%</td>
       <td>{c.status}{c.revoked_at&&<div className="small text-muted">Revoked {new Date(c.revoked_at).toLocaleDateString()}</div>}</td>
       <td><a href={"/verify/certificate/"+c.id} target="_blank" rel="noopener noreferrer">Verify</a>
        {c.status!=="revoked"&&<button type="button" disabled={busy} className="btn btn-link text-danger btn-sm"
          onClick={()=>void revoke(c)}>Revoke</button>}</td>
      </tr>)}</tbody>
     </table></div>}
    <div className="d-flex align-items-center justify-content-between mt-3">
     <button type="button" className="btn btn-outline-secondary btn-sm" disabled={certPage<=1}
       onClick={()=>setCertPage(p=>Math.max(1,p-1))}>Previous</button>
     <span className="small text-muted">Page {certPage}</span>
     <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!certHasNext}
       onClick={()=>setCertPage(p=>p+1)}>Next</button>
    </div>
   </section>}
  </div>
 </section>;
}
