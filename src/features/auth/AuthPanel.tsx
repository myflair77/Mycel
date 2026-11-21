import {RecoveryRequest} from './RecoveryRequest';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {supabase} from '../../services/supabase';
type AuthClient=Pick<NonNullable<typeof supabase>['auth'],'signUp'|'signInWithPassword'|'resend'>;
export function AuthPanel({signup,onSwitch,inviteToken,authClient=supabase?.auth}:{signup:boolean;onSwitch:()=>void;inviteToken?:string;authClient?:AuthClient}){
 const [recovery,setRecovery]=useState<'password'|'username'|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [pendingEmail,setPendingEmail]=useState(''),[retrySignup,setRetrySignup]=useState(false),[cooldown,setCooldown]=useState(0);
 const [fields,setFields]=useState({email:'',password:'',username:'',displayName:''});
 const requestLock=useRef(false);const isSignup=signup||retrySignup;
 useEffect(()=>{if(!pendingEmail)return;const timer=setInterval(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer)},[pendingEmail]);
 const field=(key:keyof typeof fields,value:string)=>setFields(old=>({...old,[key]:value}));
 function switchMode(){setPendingEmail('');setNotice('');setFields({email:'',password:'',username:'',displayName:''});setCooldown(0);if(retrySignup&&!signup)setRetrySignup(false);else{setRetrySignup(false);onSwitch()}}
 function retry(){setPendingEmail('');setNotice('');setRetrySignup(true);setCooldown(0);setFields(old=>({...old,email:'',password:'',username:''}))}
 function failure(error:unknown){const code=(error as {code?:string})?.code;if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';if(code==='unexpected_failure')return '가입을 완료하지 못했습니다. 이미 신청한 사용자 ID라면 다른 ID를 입력해 주세요. 계속 실패하면 잠시 후 다시 시도해 주세요.';return error instanceof Error?error.message:'인증 요청에 실패했습니다.'}
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
 if(pendingEmail)return <section className="auth-panel"><h2>이메일 인증을 기다리고 있어요</h2><p><strong className="pending-signup-email">{pendingEmail}</strong> 주소의 인증 링크를 열어 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p><div className="signup-pending-actions"><button className="primary-button" disabled={busy} onClick={retry}>다른 이메일로 다시 가입</button><button disabled={busy||cooldown>0} onClick={()=>void resend()}>{cooldown>0?`인증 메일 다시 보내기 (${cooldown}초)`:'인증 메일 다시 보내기'}</button><button className="text-button" disabled={busy} onClick={()=>{setPendingEmail('');setNotice('');setRetrySignup(false);if(signup)onSwitch()}}>인증 후 로그인</button></div><p role="status" className="notice">{notice}</p></section>;
 return <section className="auth-panel"><h2>{isSignup?'처음 만나는 대화':'다시 만나 반가워요'}</h2><p>이메일 계정으로 대화를 이어가세요.</p>
 {!authClient&&<p className="notice" role="status">Supabase 연결 준비 중입니다. 아직 가입 정보는 전송되지 않습니다.</p>}
 {retrySignup&&<p>받을 수 있는 새 이메일로 가입해 주세요. 이전에 신청한 사용자 ID는 사용 중일 수 있으므로 새 ID를 입력해 주세요.</p>}
 <form onSubmit={submit}><label>이메일<input autoFocus={retrySignup} name="email" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={e=>field('email',e.target.value)}/></label>
 <label>비밀번호<input name="password" type="password" autoComplete={isSignup?'new-password':'current-password'} minLength={8} required value={fields.password} onChange={e=>field('password',e.target.value)}/></label>
 {isSignup&&<><label>사용자 ID<input name="username" pattern="[a-zA-Z0-9_]{3,24}" title="영문, 숫자, 밑줄 3~24자" autoComplete="username" required value={fields.username} onChange={e=>field('username',e.target.value)}/></label><label>표시 이름<input name="displayName" maxLength={30} required value={fields.displayName} onChange={e=>field('displayName',e.target.value)}/></label></>}
 <button className="primary-button" disabled={!authClient||busy}>{busy?'처리 중…':isSignup?'회원가입':'로그인'}</button></form>
 <p role="status" className="notice">{notice}</p><button className="text-button" disabled={busy} onClick={switchMode}>{isSignup?'이미 계정이 있어요':'계정 만들기'}</button>{!isSignup&&<div className="recovery-links"><button className="text-button" disabled={busy} onClick={()=>setRecovery('password')}>비밀번호 재설정</button><button className="text-button" disabled={busy} onClick={()=>setRecovery('username')}>아이디 찾기</button></div>}</section>
}
