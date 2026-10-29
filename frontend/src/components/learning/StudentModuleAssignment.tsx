"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
export type AssignmentSummary={id:number;title:string;instructions:string;passing_percent:number;max_attempts:number;attempts_used:number;attempts_remaining:number;passed:boolean;unlocked:boolean;pending_review:boolean;latest_submission:{score_percent:number|null;feedback:string;graded_at:string|null}|null};
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");
export default function StudentModuleAssignment({moduleId,summary,onUpdated}:{moduleId:number;summary:AssignmentSummary;onUpdated?:()=>void}){
 const url=BASE+"/api/recorded-courses/learning/student/modules/"+moduleId+"/assignment/";
 const [status,setStatus]=useState(summary),[answer,setAnswer]=useState(""),[file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async(signal?:AbortSignal)=>{
  const token=localStorage.getItem("student_access_token");if(!token)throw Error("Please sign in again.");
  const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.detail||"Assignment unavailable.");
  return data.assignment as AssignmentSummary;
 },[url]);
 useEffect(()=>{const controller=new AbortController();setStatus(summary);
  void load(controller.signal).then(s=>{if(!controller.signal.aborted)setStatus(s);}).catch(e=>{if(!controller.signal.aborted)setError(String(e));});
  return ()=>controller.abort();
 },[load,summary.id,summary.unlocked,summary.attempts_used,summary.passed]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  try{const token=localStorage.getItem("student_access_token"),form=new FormData();
   if(answer.trim())form.append("answer_text",answer.trim());if(file)form.append("file",file);
   const response=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.detail||"Submission failed.");
   setAnswer("");setFile(null);setStatus(await load());setNotice("Submitted for teacher review.");onUpdated?.();
  }catch(e){setError(e instanceof Error?e.message:"Submission failed.");}finally{setBusy(false);}
 }
 const latest=status.latest_submission;
 return <section className="border rounded-3 p-3 mt-3" aria-label="Module assignment">
  <h3 className="h6 fw-bold">{status.title}</h3>
  <p className="small" style={{whiteSpace:"pre-wrap"}}>{status.instructions}</p>
  <p className="small text-muted">Pass mark {status.passing_percent}% · {status.attempts_used}/{status.max_attempts} attempts</p>
  {error&&<div className="alert alert-danger" role="alert">{error}</div>}
  {notice&&<div className="alert alert-success" role="status">{notice}</div>}
  {latest?.graded_at&&<p className="small">Grade: {latest.score_percent}% · {latest.feedback}</p>}
  {status.passed?<p className="text-success small">Assignment passed.</p>
   :!status.unlocked?<p className="small text-muted">Watch every active lecture first.</p>
   :status.pending_review?<p className="small text-muted">Your submission is awaiting grading.</p>
   :!status.attempts_remaining?<p className="alert alert-warning">No attempts remaining. Contact your teacher.</p>
   :<form onSubmit={submit} className="d-grid gap-2">
    <label>Written answer<textarea className="form-control" rows={3} maxLength={20000} value={answer} onChange={e=>setAnswer(e.target.value)}/></label>
    <label>Attachment (optional, max 25 MB)<input type="file" className="form-control" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button className="btn btn-primary btn-sm" disabled={busy||(!answer.trim()&&!file)}>{busy?"Submitting...":"Submit assignment"}</button>
   </form>}
 </section>;
}
