import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthPanel} from '../src/features/auth/AuthPanel';
import '../src/styles/app.css';
import '../src/styles/atelier.css';
const calls:Array<Record<string,unknown>>=[];
function Fixture(){
 const [signup,setSignup]=useState(true),[history,setHistory]=useState('');
 const record=(call:Record<string,unknown>)=>{calls.push(call);setHistory(JSON.stringify(calls))};
 const authClient={
  signUp:async(args:any)=>{record({action:'signup',email:args.email,...args.options.data});return {data:{user:{},session:null},error:null}},
  signInWithPassword:async(args:any)=>{record({action:'login',email:args.email});return {data:{user:null,session:null},error:{code:'email_not_confirmed',message:'Email not confirmed'}}},
  resend:async(args:any)=>{record({action:'resend',email:args.email,type:args.type});return {data:{user:null,session:null},error:null}}
 } as any;
 return <div className="app" style={{display:'block',overflow:'auto'}}><p>로컬 검증 전용 · 실제 가입 및 메일 발송 없음</p><AuthPanel signup={signup} onSwitch={()=>setSignup(v=>!v)} inviteToken="test-invite" authClient={authClient}/><output aria-label="검증 요청">{history}</output></div>
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
