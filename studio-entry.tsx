"use client";
import {Component,lazy,Suspense,useEffect,useState,type ReactNode} from "react";
const Studio=lazy(()=>import("./studio"));
function Opening(){return <main className="studio-boot"><b>SGX</b><h1>Opening your stage</h1><p>vTuber Engine · Spatialgineers</p></main>;}
class StageBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){if(this.state.failed)return <main className="studio-boot"><b>SGX</b><h1>El estudio no pudo cargar</h1><p>Recarga la página para volver a intentar.</p><button onClick={()=>window.location.reload()}>Recargar estudio</button></main>;return this.props.children;}}
// WebGL and device controls mount in the browser, after hydration.
export default function StudioEntry(){const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return mounted?<StageBoundary><Suspense fallback={<Opening/>}><Studio/></Suspense></StageBoundary>:<Opening/>;}
