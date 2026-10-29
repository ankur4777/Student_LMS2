"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
export type FinalExamSummary={
 id:number;title:string;passing_percent:number;max_attempts:number;attempts_used:number;
 attempts_remaining:number;passed:boolean;unlocked:boolean;required_modules:number;
 best_score_percent:number|null;certificate_id:string|null;
};
type Question={id:number;prompt:string;choices:{index:number;text:string}[]};
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");
export default function StudentFinalExam({courseId,summary,onUpdated}:{
 courseId:number;summary:FinalExamSummary;onUpdated?:()=>void;
}){
 const url=BASE+"/api/recorded-courses/learning/student/courses/"+courseId+"/final-exam/";
 const [status,setStatus]=useState(summary),[questions,setQuestions]=useState<Question[]>([]);
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [result,setResult]=useState<{score_percent:number;passed:boolean}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const load=useCallback(async(signal?:AbortSignal)=>{
  const token=localStorage.getItem("student_access_token");if(!token)throw Error("Please log in again.");
  const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.detail||"Final exam unavailable.");
  return data as {exam:FinalExamSummary;questions?:Question[]};
 },[url]);
 useEffect(()=>{
  const controller=new AbortController();setStatus(summary);
  void load(controller.signal).then(v=>{if(!controller.signal.aborted){setStatus(v.exam);setQuestions(v.questions||[]);}})
    .catch(e=>{if(!controller.signal.aborted)setError(String(e));});
  return ()=>controller.abort();
 },[load,summary.id,summary.unlocked,summary.attempts_used,summary.passed]);
 async function submit(e:FormEvent){
  e.preventDefault();setError("");setBusy(true);
  try{
   const token=localStorage.getItem("student_access_token");
   const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({answers})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.detail||"Could not submit exam.");
   setStatus(data.exam);setResult(data.attempt);setAnswers({});const next=await load();setQuestions(next.questions||[]);
   onUpdated?.();
  }catch(e){setError(e instanceof Error?e.message:"Exam submission failed.");}finally{setBusy(false);}
 }
 async function download(){
  if(!status.certificate_id)return;setBusy(true);setError("");
  try{
   const token=localStorage.getItem("student_access_token");
   const response=await fetch(BASE+"/api/recorded-courses/learning/student/certificates/"+status.certificate_id+"/pdf/",{
    headers:{Authorization:"Bearer "+token},cache:"no-store",
   });
   if(!response.ok)throw Error("Unable to download your certificate.");
   const data=await response.blob(),src=URL.createObjectURL(data);
   const a=document.createElement("a");a.href=src;a.download="MySLS-Course-Certificate.pdf";document.body.appendChild(a);a.click();a.remove();
   window.setTimeout(()=>URL.revokeObjectURL(src),30000);
  }catch(e){setError(e instanceof Error?e.message:"Download failed.");}finally{setBusy(false);}
 }
 return <section className="card border-0 shadow-sm mt-4" aria-label="Final course examination"><div className="card-body p-4">
  <div className="d-flex gap-3 align-items-center"><i className="bi bi-award fs-2 text-danger" aria-hidden="true"/>
   <div><h2 className="h5 fw-bold mb-1">{status.title}</h2>
    <p className="small text-muted mb-0">Pass mark {status.passing_percent}% · {status.attempts_used}/{status.max_attempts} attempts · {status.required_modules} modules</p>
   </div></div>
  {error&&<p className="alert alert-danger mt-3" role="alert">{error}</p>}
  {status.passed?<div className="alert alert-success mt-3">
   <strong>Final examination passed!</strong> Best score: {status.best_score_percent}%.
   {status.certificate_id&&<div className="d-flex gap-2 flex-wrap mt-3">
    <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={()=>void download()}>Download PDF certificate</button>
    <a href={"/verify/certificate/"+status.certificate_id} className="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener noreferrer">Verify certificate</a>
   </div>}
  </div>:!status.unlocked?<p className="small mt-3 text-muted">Complete all published modules, including required quizzes and graded assignments, to unlock this examination.</p>
  :status.attempts_remaining===0?<p className="alert alert-warning mt-3">No exam attempts remaining. Please contact your College Admin.</p>
  :<>
   {result&&<p className={"alert mt-3 "+(result.passed?"alert-success":"alert-warning")}>Latest score: {result.score_percent}%.</p>}
   <form onSubmit={submit} className="d-grid gap-3 mt-3">
    {questions.map((q,i)=><fieldset className="border-0 p-0 m-0" key={q.id}>
     <legend className="h6 fw-semibold">{i+1}. {q.prompt}</legend>
     {q.choices.map(choice=><label className="d-flex align-items-start gap-2 mb-2 small" key={choice.index}>
      <input type="radio" name={"final-"+courseId+"-q-"+q.id} checked={answers[String(q.id)]===choice.index}
       onChange={()=>setAnswers(old=>({...old,[String(q.id)]:choice.index}))}/>
      <span>{choice.text}</span>
     </label>)}
    </fieldset>)}
    {questions.length>0&&<button className="btn btn-primary" disabled={busy||questions.some(q=>answers[String(q.id)]===undefined)}>{busy?"Submitting...":"Submit Final Exam"}</button>}
   </form>
  </>}
 </div></section>;
}
