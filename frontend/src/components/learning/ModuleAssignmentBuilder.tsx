"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
type Role="teacher"|"college_admin";
type Assignment={id:number;title:string;instructions:string;passing_percent:number;max_attempts:number;is_published:boolean;submission_count:number};
type Submission={id:number;student_name:string;answer_text:string;has_file:boolean;attempt_number:number;score_percent:number|null;feedback:string;graded_at:string|null};
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");
export default function ModuleAssignmentBuilder({moduleId,role}:{moduleId:number;role:Role}){
 const root=BASE+"/api/recorded-courses/learning/manage/",url=root+"modules/"+moduleId+"/assignment/";
 const [assignment,setAssignment]=useState<Assignment|null>(null),[submissions,setSubmissions]=useState<Submission[]>([]);
 const [title,setTitle]=useState("Module Assignment"),[instructions,setInstructions]=useState("");
 const [pass,setPass]=useState(60),[attempts,setAttempts]=useState(3);
 const [scores,setScores]=useState<Record<number,string>>({}),[feedback,setFeedback]=useState<Record<number,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const call=useCallback(async(path:string,init:RequestInit={})=>{
  const token=localStorage.getItem(role==="teacher"?"teacher_access_token":"college_admin_access_token");
  if(!token)throw Error("Please log in again.");
  const response=await fetch(path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+token,...(init.headers||{})}});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.detail||"Assignment request failed.");}
  return response;
 },[role]);
 const reload=useCallback(async()=>{
  const body=await (await call(url)).json(),a:Assignment|null=body.assignment||null;
  setAssignment(a);
  if(a){setTitle(a.title);setInstructions(a.instructions);setPass(a.passing_percent);setAttempts(a.max_attempts);
   const data=await (await call(url+"submissions/")).json();setSubmissions(data.submissions||[]);
  }else setSubmissions([]);
 },[call,url]);
 useEffect(()=>{void reload().catch(e=>setError(String(e)));},[reload]);
 async function run(fn:()=>Promise<void>){setBusy(true);setError("");setNotice("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Request failed.");}finally{setBusy(false);}
 }
 async function save(e:FormEvent){e.preventDefault();await run(async()=>{
  await call(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,instructions,passing_percent:pass,max_attempts:attempts})});
  await reload();setNotice("Assignment draft saved.");
 });}
 async function toggle(){if(!assignment)return;await run(async()=>{
  await call(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_published:!assignment.is_published})});
  await reload();setNotice("Assignment publication updated.");
 });}
 async function grade(s:Submission){
  if(scores[s.id]===undefined||scores[s.id].trim()===""||!Number.isInteger(Number(scores[s.id]))||Number(scores[s.id])<0||Number(scores[s.id])>100){
   setError("Enter an integer grade from 0–100.");return;
  }
  await run(async()=>{await call(root+"submissions/"+s.id+"/grade/",{method:"PATCH",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({score_percent:Number(scores[s.id]),feedback:feedback[s.id]||""})});
   await reload();setNotice("Grade saved.");
  });
 }
 async function download(id:number){await run(async()=>{
  const response=await call(root+"submissions/"+id+"/download/"),blob=await response.blob(),src=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=src;a.download="assignment-"+id;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(src),30000);
 });}
 const locked=!!assignment&&(assignment.is_published||assignment.submission_count>0);
 return <section className="border rounded-3 p-3 mt-4" aria-label="Module assignments">
  <h5 className="h6 fw-bold">Module Assignment {assignment?(assignment.is_published?"· Published":"· Draft"):""}</h5>
  <p className="small text-muted">Students submit written work or attachments after viewing lessons. Teachers grade submissions.</p>
  {error&&<div className="alert alert-danger" role="alert">{error}</div>}
  {notice&&<div className="alert alert-success" role="status">{notice}</div>}
  <form onSubmit={save} className="row g-2 mb-3">
   <label className="col-md-6">Title<input className="form-control" required maxLength={180} disabled={busy||locked} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="col-md-3">Pass mark (%)<input className="form-control" type="number" min={1} max={100} disabled={busy||locked} value={pass} onChange={e=>setPass(Number(e.target.value))}/></label>
   <label className="col-md-3">Max attempts<input className="form-control" type="number" min={1} max={10} disabled={busy||locked} value={attempts} onChange={e=>setAttempts(Number(e.target.value))}/></label>
   <label className="col-12">Instructions<textarea className="form-control" required rows={3} maxLength={12000} disabled={busy||locked} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
   <div className="col-12 d-flex gap-2 flex-wrap">
    <button className="btn btn-outline-primary btn-sm" disabled={busy||locked}>Save assignment</button>
    {assignment&&role==="college_admin"&&<button type="button" className="btn btn-primary btn-sm" disabled={busy||assignment.submission_count>0} onClick={()=>void toggle()}>{assignment.is_published?"Unpublish":"Publish"}</button>}
   </div>
  </form>
  {assignment&&<div className="border-top pt-3"><h6>Student submissions ({submissions.length})</h6>
   {submissions.map(s=><div className="border rounded-3 p-2 mb-2" key={s.id}>
    <strong>{s.student_name} · Attempt {s.attempt_number}</strong>
    <p className="small mb-2" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{s.answer_text||"File submission"}</p>
    {s.has_file&&<button type="button" className="btn btn-link btn-sm p-0" disabled={busy} onClick={()=>void download(s.id)}>Download attachment</button>}
    {s.graded_at?<p className="small mb-0">Grade: {s.score_percent}% · {s.feedback}</p>:<div className="row g-2">
     <label className="col-md-3">Grade 0–100<input type="number" min={0} max={100} className="form-control" value={scores[s.id]??""} onChange={e=>setScores(v=>({...v,[s.id]:e.target.value}))}/></label>
     <label className="col-md-6">Feedback<input maxLength={5000} className="form-control" value={feedback[s.id]??""} onChange={e=>setFeedback(v=>({...v,[s.id]:e.target.value}))}/></label>
     <div className="col-md-3 align-self-end"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={()=>void grade(s)}>Grade</button></div>
    </div>}
   </div>)}
  </div>}
 </section>;
}
