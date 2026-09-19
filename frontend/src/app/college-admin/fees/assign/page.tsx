"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CollegeAdminSidebar from "@/components/college-admin/CollegeAdminSidebar";
import CollegeAdminTopbar from "@/components/college-admin/CollegeAdminTopbar";
import "../../../teacher/dashboard/dashboard.css";

const API_BASE=process.env.NEXT_PUBLIC_API_BASE_URL;
interface Admin{username?:string;name?:string;organization?:string}
interface Student{student_profile_id:number;name:string;username:string;admission_number:string;enrollment_id:number;section_id:number;class_room_id:number}
interface Enrollment{id:number;student_profile_id:number;section_id:number;class_room_id:number;roll_number:string}
interface Structure{id:number;name:string;total_amount:string;due_date:string|null;academic_session:{id:number;name:string};class_room:{id:number;name:string}}
function saved():Admin{if(typeof window==="undefined")return{};try{return JSON.parse(localStorage.getItem("college_admin_user")||"{}")}catch{return{}}}
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2}).format(v);

export default function AssignFeePage(){
 const router=useRouter(),[admin]=useState<Admin>(saved),[students,setStudents]=useState<Student[]>([]),[enrollments,setEnrollments]=useState<Enrollment[]>([]),[structures,setStructures]=useState<Structure[]>([]);
 const [studentId,setStudentId]=useState(""),[structureId,setStructureId]=useState(""),[discount,setDiscount]=useState("0"),[fine,setFine]=useState("0"),[dueDate,setDueDate]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const token=useCallback(()=>{const t=localStorage.getItem("college_admin_access_token");if(!t)router.replace("/college-admin/login");return t},[router]);
 useEffect(()=>{let mounted=true;(async()=>{const t=token();if(!t)return;try{const r=await fetch(`${API_BASE}/api/fees/college-admin/setup/`,{headers:{Authorization:`Bearer ${t}`}});const j=await r.json();if(r.status===401){router.replace("/college-admin/login");return}if(!r.ok)throw new Error(j.detail||"Unable to load fee setup.");if(mounted){setStudents(j.students||[]);setEnrollments(j.enrollments||[]);setStructures(j.fee_structures||[])}}catch(e){if(mounted)setError(e instanceof Error?e.message:"Unable to load fee setup.")}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[router,token]);
 const student=useMemo(()=>students.find(x=>String(x.student_profile_id)===studentId),[students,studentId]);
 const enrollment=useMemo(()=>student?enrollments.find(x=>x.id===student.enrollment_id):undefined,[enrollments,student]);
 const compatible=useMemo(()=>structures.filter(x=>!student||x.class_room.id===student.class_room_id),[structures,student]);
 const structure=useMemo(()=>structures.find(x=>String(x.id)===structureId),[structures,structureId]);
 const payable=Math.max(0,Number(structure?.total_amount||0)-Number(discount||0)+Number(fine||0));
 const chooseStructure=(id:string)=>{setStructureId(id);const x=structures.find(s=>String(s.id)===id);setDueDate(x?.due_date||"")};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!student||!enrollment||!structure)return;const t=token();if(!t)return;setSaving(true);setError("");try{const r=await fetch(`${API_BASE}/api/fees/college-admin/student-fees/`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({student_profile_id:student.student_profile_id,enrollment_id:enrollment.id,academic_session_id:structure.academic_session.id,fee_structure_id:structure.id,discount_amount:Number(discount||0).toFixed(2),fine_amount:Number(fine||0).toFixed(2),due_date:dueDate})});const j=await r.json();if(!r.ok){const m=j.detail||j.discount_amount||j.fine_amount||"Unable to assign fee.";throw new Error(Array.isArray(m)?m.join(", "):String(m))}router.replace("/college-admin/fees")}catch(e){setError(e instanceof Error?e.message:"Unable to assign fee.")}finally{setSaving(false)}};
 return <div className="teacher-dashboard"><CollegeAdminSidebar/><main className="teacher-dashboard-main"><CollegeAdminTopbar name={admin.name||admin.username||"College Admin"} organization={admin.organization||""}/><div className="teacher-dashboard-content"><div className="container-fluid">
 <div className="mb-4"><h2 className="fw-bold mb-1">Assign Fee</h2><p className="text-muted mb-0">Assign an active fee structure to an enrolled student.</p></div>{error&&<div className="alert alert-danger">{error}</div>}
 {loading?<div className="card border-0 shadow-sm"><div className="card-body py-5 text-center text-muted">Loading fee setup...</div></div>:<div className="card border-0 shadow-sm"><div className="card-body p-4"><form onSubmit={submit}><div className="row g-3">
 <div className="col-md-6"><label className="form-label">Student</label><select className="form-select" value={studentId} onChange={e=>{setStudentId(e.target.value);setStructureId("");setDueDate("")}} required><option value="">Select student</option>{students.map(x=><option key={x.student_profile_id} value={x.student_profile_id}>{x.name} — {x.admission_number||x.username}</option>)}</select>{enrollment&&<small className="text-muted">Roll number: {enrollment.roll_number||"-"}</small>}</div>
 <div className="col-md-6"><label className="form-label">Fee Structure</label><select className="form-select" value={structureId} onChange={e=>chooseStructure(e.target.value)} required disabled={!studentId}><option value="">Select fee structure</option>{compatible.map(x=><option key={x.id} value={x.id}>{x.name} — {money(Number(x.total_amount))}</option>)}</select>{studentId&&compatible.length===0&&<small className="text-danger">No active fee structure is available for this student's class.</small>}</div>
 <div className="col-md-4"><label className="form-label">Original Amount</label><input className="form-control" value={structure?money(Number(structure.total_amount)):"₹0.00"} disabled/></div>
 <div className="col-md-4"><label className="form-label">Discount</label><input type="number" min="0" step="0.01" className="form-control" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
 <div className="col-md-4"><label className="form-label">Fine</label><input type="number" min="0" step="0.01" className="form-control" value={fine} onChange={e=>setFine(e.target.value)}/></div>
 <div className="col-md-6"><label className="form-label">Due Date</label><input type="date" className="form-control" value={dueDate} onChange={e=>setDueDate(e.target.value)} required/></div><div className="col-md-6"><label className="form-label">Calculated Payable</label><input className="form-control fw-bold" value={money(payable)} disabled/><small className="text-muted">Final payable amount is validated and calculated by the server.</small></div>
 <div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={saving||!student||!structure}>{saving?"Assigning...":"Assign Fee"}</button><button type="button" className="btn btn-outline-secondary" onClick={()=>router.push("/college-admin/fees")}>Cancel</button></div>
 </div></form></div></div>}</div></div></main></div>
}