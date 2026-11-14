import {useEffect,useState,type FormEvent} from 'react';
export function RecoveryRequest({kind,onBack}:{kind:'password'|'username';onBack:()=>void}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[seconds,setSeconds]=useState(0);
 useEffect(()=>{if(!seconds)return;const t=setTimeout(()=>setSeconds(n=>n-1),1000);return()=>clearTimeout(t)},[seconds]);
 async function send(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setNotice('');try{const r=await fetch('/api/account/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,email:new FormData(e.currentTarget).get('email')})});const d=await r.json();if(!r.ok)throw Error(d.error);setNotice(d.message);setSeconds(60)}catch(e){setNotice(e instanceof Error?e.message:'연결을 확인해 주세요.')}finally{setBusy(false)}}
 return <section className="auth-panel"><h2>{kind==='password'?'비밀번호 재설정':'아이디 찾기'}</h2><p>현재 계정에 등록된 이메일로 본인 확인 안내를 보내드립니다.</p><form onSubmit={send}><label>등록 이메일<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><button className="primary-button" disabled={busy||seconds>0}>{busy?'처리 중…':seconds>0?seconds+'초 후 다시 보내기':'안내 메일 보내기'}</button></form><p role="status">{notice}</p><button onClick={onBack}>로그인으로 돌아가기</button></section>
}
