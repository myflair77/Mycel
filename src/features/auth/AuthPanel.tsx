import {changeSignupEmail,type SignupEmailInput,type SignupEmailResult} from './changeSignupEmail';
import {RecoveryRequest} from './RecoveryRequest';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {supabase} from '../../services/supabase';
type AuthClient=Pick<NonNullable<typeof supabase>['auth'],'signUp'|'signInWithPassword'|'resend'>;
export function AuthPanel({signup,onSwitch,inviteToken,authClient=supabase?.auth,changeEmail=changeSignupEmail}:{signup:boolean;onSwitch:()=>void;inviteToken?:string;authClient?:AuthClient;changeEmail?:(input:SignupEmailInput)=>Promise<SignupEmailResult>}){
 const [recovery,setRecovery]=useState<'password'|'username'|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [pendingEmail,setPendingEmail]=useState(''),[editingEmail,setEditingEmail]=useState(false),[newEmail,setNewEmail]=useState(''),[changePassword,setChangePassword]=useState(''),[cooldown,setCooldown]=useState(0);
 const [fields,setFields]=useState({email:'',password:'',username:'',displayName:''});
 const requestLock=useRef(false);const isSignup=signup;
 useEffect(()=>{if(!pendingEmail)return;const timer=setInterval(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer)},[pendingEmail]);
 const field=(key:keyof typeof fields,value:string)=>setFields(old=>({...old,[key]:value}));
 function switchMode(){setPendingEmail('');setNotice('');setEditingEmail(false);setChangePassword('');setFields({email:'',password:'',username:'',displayName:''});setCooldown(0);onSwitch()}
 async function replaceEmail(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(requestLock.current)return;
  requestLock.current=true;setBusy(true);setNotice('');
  try{
   const result=await changeEmail({email:pendingEmail,newEmail:newEmail.trim(),password:changePassword});
   setPendingEmail(result.email);setFields(old=>({...old,email:result.email,password:''}));setEditingEmail(false);setNewEmail('');setCooldown(result.mailSent?60:0);
   setNotice(result.mailSent?'사용자 ID는 그대로 유지됩니다. 새 이메일로 보낸 인증 링크를 확인해 주세요.':'이메일은 변경되었지만 인증 메일을 보내지 못했습니다. 인증 메일 다시 보내기를 눌러 주세요.');
  }catch(error){setNotice(failure(error))}finally{setChangePassword('');requestLock.current=false;setBusy(false)}
 }
 function failure(error:unknown){const code=(error as {code?:string})?.code;if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';if(code==='unexpected_failure')return '가입을 완료하지 못했습니다. 이미 가입을 신청했다면 기존 이메일로 로그인한 뒤 인증 안내에서 이메일 주소를 변경해 주세요.';return error instanceof Error?error.message:'인증 요청에 실패했습니다.'}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!authClient||requestLock.current)return;
  requestLock.current=true;setBusy(true);setNotice('');
  try{
   const credentials={email:fields.email.trim(),password:fields.password};
   if(isSignup){
    const {data,error}=await authClient.signUp({...credentials,options:{data:{...(inviteToken?{invite_token:inviteToken}:{}),username:fields.username.toLowerCase().trim(),display_name:fields.displayName.trim()},emailRedirectTo:window.location.origin}});
    if(error)throw error;
    setFields(old=>({...old,password:''}));
    if(!data.session){setPendingEmail(credentials.email);setCooldown(60)}
   }else{const {error}=await authClient.signInWithPassword(credentials);if(error){if(error.code==='email_not_confirmed'){setPendingEmail(credentials.email);setCooldown(0);setFields(old=>({...old,password:''}));return}throw error}}
  }catch(error){setNotice(failure(error))}finally{requestLock.current=false;setBusy(false)}
 }
 async function resend(){if(!authClient||busy||requestLock.current||cooldown>0||!pendingEmail)return;requestLock.current=true;setBusy(true);setNotice('');try{const {error}=await authClient.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setCooldown(60);setNotice('인증 메일 재발송을 요청했습니다. 받은편지함과 스팸함을 확인해 주세요.')}catch(error){setNotice(failure(error))}finally{requestLock.current=false;setBusy(false)}}
 if(recovery)return <RecoveryRequest kind={recovery} onBack={()=>setRecovery(null)}/>;
 if(pendingEmail)return <section className="auth-panel"><h2>{editingEmail?'인증 이메일 변경':'이메일 인증을 기다리고 있어요'}</h2>
 <p><strong className="pending-signup-email">{pendingEmail}</strong>{editingEmail?' 대신 인증 메일을 받을 주소를 입력해 주세요. 사용자 ID와 계정은 그대로 유지됩니다.':' 주소로 받은 메일의 인증 링크를 눌러야 회원가입이 완료됩니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.'}</p>
 {fields.username&&<p>사용자 ID <strong>@{fields.username}</strong></p>}
 {editingEmail?<form onSubmit={replaceEmail}><label>새 이메일<input autoFocus name="newEmail" type="email" required maxLength={254} autoComplete="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></label>
 <label>가입할 때 정한 비밀번호<input name="signupPassword" type="password" required minLength={8} maxLength={128} autoComplete="current-password" value={changePassword} onChange={e=>setChangePassword(e.target.value)}/></label>
 <button className="primary-button" disabled={busy}>{busy?'변경 중…':'이메일 변경 후 인증 메일 받기'}</button><button type="button" disabled={busy} onClick={()=>{setEditingEmail(false);setChangePassword('');setNotice('')}}>취소</button></form>
 :<div className="signup-pending-actions"><button className="primary-button" disabled={busy} onClick={()=>{setEditingEmail(true);setNewEmail('');setChangePassword('');setNotice('')}}>이메일 주소 변경</button><button disabled={busy||cooldown>0} onClick={()=>void resend()}>{cooldown>0?`인증 메일 다시 보내기 (${cooldown}초)`:'인증 메일 다시 보내기'}</button><button className="text-button" disabled={busy} onClick={()=>{setPendingEmail('');setNotice('');if(signup)onSwitch()}}>인증 후 로그인</button></div>}<p role="status" className="notice">{notice}</p></section>;
 return <section className="auth-panel"><h2>{isSignup?'처음 만나는 대화':'다시 만나 반가워요'}</h2><p>이메일 계정으로 대화를 이어가세요.</p>
 {!authClient&&<p className="notice" role="status">Supabase 연결 준비 중입니다. 아직 가입 정보는 전송되지 않습니다.</p>}
 <form onSubmit={submit}><label>이메일<input name="email" type="email" aria-describedby={isSignup?"signup-email-help":undefined} autoComplete="email" required maxLength={254} value={fields.email} onChange={e=>field('email',e.target.value)}/></label>
 {isSignup&&<p id="signup-email-help" className="signup-email-help"><strong>인증 메일을 받을 수 있는 이메일 주소를 입력해 주세요.</strong><span>해당 메일의 인증 링크를 눌러야 회원가입이 완료됩니다.</span></p>}
 <label>비밀번호<input name="password" type="password" autoComplete={isSignup?'new-password':'current-password'} minLength={8} required value={fields.password} onChange={e=>field('password',e.target.value)}/></label>
 {isSignup&&<><label>사용자 ID<input name="username" pattern="[a-zA-Z0-9_]{3,24}" title="영문, 숫자, 밑줄 3~24자" autoComplete="username" required value={fields.username} onChange={e=>field('username',e.target.value)}/></label><label>표시 이름<input name="displayName" maxLength={30} required value={fields.displayName} onChange={e=>field('displayName',e.target.value)}/></label></>}
 <button className="primary-button" disabled={!authClient||busy}>{busy?'처리 중…':isSignup?'인증 메일 받기':'로그인'}</button></form>
 <p role="status" className="notice">{notice}</p><button className="text-button" disabled={busy} onClick={switchMode}>{isSignup?'이미 계정이 있어요':'계정 만들기'}</button>{!isSignup&&<div className="recovery-links"><button className="text-button" disabled={busy} onClick={()=>setRecovery('password')}>비밀번호 재설정</button><button className="text-button" disabled={busy} onClick={()=>setRecovery('username')}>아이디 찾기</button></div>}</section>
}
