"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

export type QuizSummary={id:number;title:string;passing_percent:number;max_attempts:number;attempts_used:number;attempts_remaining:number;passed:boolean;best_score_percent:number|null;unlocked:boolean};
type Question={id:number;prompt:string;choices:{index:number;text:string}[]};
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");

export default function StudentModuleQuiz({moduleId,summary,onUpdated}:{moduleId:number;summary:QuizSummary;onUpdated?:()=>void}) {
  const url=BASE+"/api/recorded-courses/learning/student/modules/"+moduleId+"/quiz/";
  const [status,setStatus]=useState<QuizSummary>(summary);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [result,setResult]=useState<{score_percent:number;passed:boolean}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const token=localStorage.getItem("student_access_token");
    if(!token)throw Error("Please sign in again.");
    const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(body.detail||"Unable to load quiz.");
    return body as {quiz:QuizSummary;questions?:Question[]};
  },[url]);
  useEffect(()=>{
    const controller=new AbortController();
    setStatus(summary);
    void refresh(controller.signal).then(body=>{
      if(!controller.signal.aborted){setStatus(body.quiz);setQuestions(body.questions||[]);}
    }).catch(err=>{if(!controller.signal.aborted)setError(String(err));});
    return ()=>controller.abort();
  },[refresh,summary.id,summary.unlocked,summary.passed,summary.attempts_used]);
  async function submit(event:FormEvent){
    event.preventDefault();
    if(questions.some(q=>answers[String(q.id)]===undefined))return;
    setBusy(true);setError("");
    try{
      const token=localStorage.getItem("student_access_token");
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({answers})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.detail||"Quiz submission failed.");
      setStatus(body.quiz);setResult(body.attempt);setAnswers({});onUpdated?.();
      const latest=await refresh();setQuestions(latest.questions||[]);
    }catch(err){setError(err instanceof Error?err.message:"Quiz submission failed.");}
    finally{setBusy(false);}
  }
  return <section className="p-3 border rounded-3 mt-3" aria-label="Module quiz">
    <h3 className="h6 fw-bold">{status.title}</h3>
    <p className="small text-muted">Pass mark: {status.passing_percent}% · Attempts: {status.attempts_used}/{status.max_attempts}</p>
    {error&&<div role="alert" className="alert alert-danger py-2">{error}</div>}
    {status.passed?<div className="alert alert-success py-2">Quiz passed! Best score: {status.best_score_percent}%</div>
    : !status.unlocked?<p className="small text-muted">Finish all active video lessons to unlock this quiz.</p>
    : status.attempts_remaining===0?<div className="alert alert-warning py-2">No attempts remaining. Contact your teacher.</div>
    : <>
      {result&&<div className={"alert py-2 "+(result.passed?"alert-success":"alert-warning")}>Score: {result.score_percent}%. {result.passed?"Passed.":"Review your notes and try again."}</div>}
      <form onSubmit={submit} className="d-grid gap-3">
        {questions.map((question,i)=><fieldset className="border-0 p-0 m-0" key={question.id}>
          <legend className="fs-6 fw-semibold">{i+1}. {question.prompt}</legend>
          {question.choices.map(choice=><label key={choice.index} className="d-flex align-items-start gap-2 small mb-2">
            <input type="radio" name={"quiz-"+moduleId+"-question-"+question.id} checked={answers[String(question.id)]===choice.index}
              onChange={()=>setAnswers(old=>({...old,[String(question.id)]:choice.index}))}/>
            <span>{choice.text}</span>
          </label>)}
        </fieldset>)}
        {questions.length>0&&<button className="btn btn-primary btn-sm" disabled={busy||questions.some(q=>answers[String(q.id)]===undefined)}>
          {busy?"Submitting...":"Submit answers"}
        </button>}
      </form>
    </>}
  </section>;
}
