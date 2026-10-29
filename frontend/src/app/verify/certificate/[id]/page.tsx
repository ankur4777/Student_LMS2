"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
const BASE=(process.env.NEXT_PUBLIC_API_BASE_URL||"").replace(/\/$/,"");
type Verification={certificate_id:string;valid:boolean;status:string;student:string;course:string;organization:string;issued_at:string};
export default function CertificateVerificationPage(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Verification|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();
  void fetch(BASE+"/api/recorded-courses/learning/certificates/verify/"+encodeURIComponent(id)+"/",{cache:"no-store",signal:controller.signal})
   .then(async r=>{const json=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===404?"Certificate not found.":"Verification unavailable.");return json;})
   .then(x=>{if(!controller.signal.aborted)setData(x);})
   .catch(e=>{if(!controller.signal.aborted)setError(String(e));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[id]);
 return <main style={{minHeight:"100vh",background:"#f6f8fc",padding:"min(7vw,68px) 20px",color:"#192841"}}>
  <article style={{maxWidth:760,margin:"auto",background:"#fff",padding:"clamp(24px,5vw,56px)",borderRadius:20,boxShadow:"0 18px 45px #19284114"}}>
   <div style={{fontSize:13,letterSpacing:".08em",fontWeight:700,color:"#c93448"}}>MySLS · CERTIFICATE VERIFICATION</div>
   <h1 style={{fontSize:"clamp(28px,4vw,38px)",margin:"15px 0"}}>Verify a course certificate</h1>
   {loading?<p>Checking certificate…</p>:error?<p role="alert" style={{color:"#b42335"}}>{error}</p>:data&&<>
    <p style={{fontWeight:700,color:data.valid?"#1c8759":"#b42335",fontSize:20}}>{data.valid?"✓ Valid certificate":"✕ Certificate revoked"}</p>
    <dl style={{display:"grid",gridTemplateColumns:"minmax(100px,160px) 1fr",gap:"15px 20px",marginTop:25}}>
     <dt>Recipient</dt><dd>{data.student} <small>(partially masked)</small></dd>
     <dt>Course</dt><dd>{data.course}</dd>
     <dt>Institution</dt><dd>{data.organization}</dd>
     <dt>Issued</dt><dd>{data.issued_at}</dd>
     <dt>Certificate ID</dt><dd style={{overflowWrap:"anywhere"}}>{data.certificate_id}</dd>
    </dl>
   </>}
   <p style={{fontSize:13,color:"#60718a",marginTop:28}}>This page verifies certificate issuance status. The recipient name is masked for privacy.</p>
   <Link href="/" style={{color:"#c93448",fontWeight:700}}>MySLS Home</Link>
  </article>
 </main>;
}
