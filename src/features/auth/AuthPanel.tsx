import {RecoveryRequest} from './RecoveryRequest';
import {useState,type FormEvent} from 'react';
import {supabase} from '../../services/supabase';
export function AuthPanel({signup,onSwitch,inviteToken}:{signup:boolean;onSwitch:()=>void;inviteToken?:string}){
 const [recovery,setRecovery]=useState<'password'|'username'|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase)return;
  const form=new FormData(event.currentTarget);setBusy(true);setNotice('');
  try{
   const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
   if(signup){
    const {data,error}=await supabase.auth.signUp({...credentials,options:{data:{...(inviteToken?{invite_token:inviteToken}:{}),username:String(form.get('username')).toLowerCase().trim(),display_name:String(form.get('displayName')).trim()},emailRedirectTo:window.location.origin}});
    if(error)throw error;
    if(!data.session)setNotice('가입 요청을 접수했습니다. 이메일의 인증 링크를 확인한 뒤 로그인해 주세요.');
   }else{const {error}=await supabase.auth.signInWithPassword(credentials);if(error)throw error}
  }catch(error){setNotice(error instanceof Error?error.message:'인증 요청에 실패했습니다.')}finally{setBusy(false)}
 }
 if(recovery)return <RecoveryRequest kind={recovery} onBack={()=>setRecovery(null)}/>;
 return <section className="auth-panel"><h2>{signup?'처음 만나는 대화':'다시 만나 반가워요'}</h2><p>이메일 계정으로 대화를 이어가세요.</p>
 {!supabase&&<p className="notice" role="status">Supabase 연결 준비 중입니다. 아직 가입 정보는 전송되지 않습니다.</p>}
 <form onSubmit={submit}><label>이메일<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
 <label>비밀번호<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={8} required/></label>
 {signup&&<><label>사용자 ID<input name="username" pattern="[a-zA-Z0-9_]{3,24}" title="영문, 숫자, 밑줄 3~24자" autoComplete="username" required/></label><label>표시 이름<input name="displayName" maxLength={30} required/></label></>}
 <button className="primary-button" disabled={!supabase||busy}>{busy?'처리 중…':signup?'회원가입':'로그인'}</button></form>
 <p role="status" className="notice">{notice}</p><button className="text-button" onClick={onSwitch}>{signup?'이미 계정이 있어요':'계정 만들기'}</button>{!signup&&<div className="recovery-links"><button className="text-button" onClick={()=>setRecovery('password')}>비밀번호 재설정</button><button className="text-button" onClick={()=>setRecovery('username')}>아이디 찾기</button></div>}</section>
}
