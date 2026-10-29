"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Role = "college_admin" | "teacher";
type Question = {id:number;prompt:string;position:number;choices:string[];correct_index:number};
type Quiz = {id:number;title:string;passing_percent:number;max_attempts:number;is_published:boolean;question_count:number;attempt_count:number;questions:Question[]};
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default function ModuleQuizBuilder({moduleId,role}:{moduleId:number;role:Role}) {
  const url=BASE+"/api/recorded-courses/learning/manage/modules/"+moduleId+"/quiz/";
  const [quiz,setQuiz]=useState<Quiz|null>(null);
  const [title,setTitle]=useState("Module Knowledge Check");
  const [passing,setPassing]=useState(70);
  const [attempts,setAttempts]=useState(3);
  const [prompt,setPrompt]=useState("");
  const [choices,setChoices]=useState(["","","",""]);
  const [correct,setCorrect]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const call=useCallback(async (path:string,init:RequestInit={})=>{
    const token=localStorage.getItem(role==="teacher"?"teacher_access_token":"college_admin_access_token");
    if(!token)throw Error("Please sign in again.");
    const response=await fetch(path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+token,...(init.headers||{})}});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.detail||"Quiz request failed.");
    return result;
  },[role]);
  const reload=useCallback(async ()=>{
    const result=await call(url);
    setQuiz(result.quiz||null);
    if(result.quiz){setTitle(result.quiz.title);setPassing(result.quiz.passing_percent);setAttempts(result.quiz.max_attempts);}
  },[call,url]);
  useEffect(()=>{void reload().catch(err=>setError(String(err)));},[reload]);
  async function action(cb:()=>Promise<void>) {
    setBusy(true);setError("");setNotice("");
    try{await cb();}catch(e){setError(e instanceof Error?e.message:"Quiz request failed.");}
    finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();
    await action(async()=>{
      await call(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,passing_percent:passing,max_attempts:attempts})});
      await reload();setNotice("Quiz draft saved.");
    });
  }
  async function addQuestion(event:FormEvent){
    event.preventDefault();
    await action(async()=>{
      await call(url+"questions/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,choices,correct_index:correct})});
      setPrompt("");setChoices(["","","",""]);setCorrect(0);await reload();setNotice("Question added.");
    });
  }
  async function toggle(){
    if(!quiz)return;
    await action(async()=>{
      await call(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_published:!quiz.is_published})});
      await reload();setNotice("Quiz publication updated.");
    });
  }
  const locked=!!quiz&&(quiz.is_published||quiz.attempt_count>0);
  return <section className="border rounded-3 p-3 mt-4" aria-label="Module quiz builder">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <h5 className="h6 fw-bold mb-0">Module Quiz</h5>
      {quiz&&<span className={"badge "+(quiz.is_published?"bg-success":"bg-secondary")}>{quiz.is_published?"Published":"Draft"} · {quiz.question_count} questions</span>}
    </div>
    <p className="small text-muted mt-2">Students can attempt a published quiz after completing all active video lessons in this module.</p>
    {error&&<div className="alert alert-danger py-2" role="alert">{error}</div>}
    {notice&&<div className="alert alert-success py-2" role="status">{notice}</div>}
    <form onSubmit={save} className="row g-2 mb-3">
      <label className="col-lg-6">Quiz title<input required maxLength={180} disabled={busy||locked} className="form-control" value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <label className="col-lg-3">Passing (%)<input required type="number" min={1} max={100} disabled={busy||locked} className="form-control" value={passing} onChange={e=>setPassing(Number(e.target.value))}/></label>
      <label className="col-lg-3">Maximum attempts<input required type="number" min={1} max={10} disabled={busy||locked} className="form-control" value={attempts} onChange={e=>setAttempts(Number(e.target.value))}/></label>
      <div className="col-12 d-flex gap-2">
        <button className="btn btn-outline-primary btn-sm" disabled={busy||locked}>Save quiz draft</button>
        {role==="college_admin"&&quiz&&<button type="button" className="btn btn-primary btn-sm" onClick={()=>void toggle()} disabled={busy||quiz.attempt_count>0}>
          {quiz.is_published?"Unpublish quiz":"Publish quiz"}
        </button>}
      </div>
    </form>
    {quiz&&<>
      <ol className="ps-4">{quiz.questions.map(question=><li key={question.id} className="mb-2">
        <strong>{question.prompt}</strong>
        <ul className="small">{question.choices.map((choice,index)=><li key={index} className={index===question.correct_index?"text-success fw-semibold":""}>
          {choice}{index===question.correct_index?" (correct)":""}
        </li>)}</ul>
      </li>)}</ol>
      {!locked?<form onSubmit={addQuestion} className="border-top pt-3">
        <label className="form-label w-100">New question<input className="form-control" required maxLength={1000} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>
        <div className="row g-2">{choices.map((choice,index)=><div className="col-md-6" key={index}>
          <label className="form-label w-100">Option {index+1} {index===correct?"(correct)":""}
            <span className="d-flex gap-2 align-items-center">
              <input type="radio" name={"correct-option-"+moduleId} checked={correct===index} onChange={()=>setCorrect(index)} aria-label={"Option "+(index+1)+" is correct"}/>
              <input className="form-control" required maxLength={400} value={choice} onChange={e=>setChoices(old=>old.map((s,i)=>i===index?e.target.value:s))}/>
            </span>
          </label>
        </div>)}</div>
        <button className="btn btn-outline-primary btn-sm mt-2" disabled={busy}>Add question</button>
      </form>:<p className="small text-muted">Questions are locked after publication or student attempts.</p>}
    </>}
  </section>;
}
