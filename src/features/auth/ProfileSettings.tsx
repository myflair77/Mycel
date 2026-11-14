import {useEffect,useState,type FormEvent} from 'react';
import type {Session,User} from '@supabase/supabase-js';
import {supabase} from '../../services/supabase';
type Profile={display_name:string;username:string;username_changed_at:string|null};
export function ProfileSettings({session}:{session:Session}){
 const [profile,setProfile]=useState<Profile|null>(null),[user,setUser]=useState<User>(session.user),[editing,setEditing]=useState<'name'|'username'|'email'|'password'|null>(null);
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[checked,setChecked]=useState(''),[candidate,setCandidate]=useState('');
 async function refresh(){const [p,u]=await Promise.all([supabase!.from('profiles').select('display_name,username,username_changed_at').eq('id',session.user.id).single(),supabase!.auth.getUser()]);if(p.error)setNotice('프로필을 불러오지 못했습니다. 다시 시도해 주세요.');else setProfile(p.data);if(u.data.user)setUser(u.data.user)}
 useEffect(()=>{void refresh();const wake=()=>void refresh();window.addEventListener('focus',wake);return()=>window.removeEventListener('focus',wake)},[session.user.id]);
 function edit(value:typeof editing){setEditing(value);setNotice('');setChecked('');setCandidate('')}
 async function check(){setBusy(true);setNotice('');try{const {data,error}=await supabase!.rpc('check_username',{p_username:candidate.trim().toLowerCase()});if(error)throw error;if(data.error)throw Error(data.error);if(data.available){setChecked(candidate.trim().toLowerCase());setNotice('사용 가능한 아이디입니다. 저장 시 한 번 더 확인합니다.')}else setNotice('사용할 수 없는 아이디입니다.')}catch(e){setNotice(e instanceof Error?e.message:'확인에 실패했습니다.')}finally{setBusy(false)}}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget,f=new FormData(form);setBusy(true);setNotice('');try{
  if(editing==='name'||editing==='username'){
   if(editing==='username'&&checked!==candidate.trim().toLowerCase())throw Error('아이디 중복 확인을 먼저 해 주세요.');
   const {data,error}=await supabase!.rpc('update_my_profile',editing==='name'?{p_display_name:String(f.get('name')).trim()}:{p_username:checked});if(error)throw error;if(data.error)throw Error(data.error);setProfile(data.profile);await supabase!.auth.refreshSession();setNotice('변경했습니다. 기존 대화와 친구 관계는 그대로 유지됩니다.');
  }else{
   const password=String(f.get('current'));
   const {data,error}=await supabase!.auth.signInWithPassword({email:user.email!,password});if(error||data.user?.id!==session.user.id)throw Error('현재 비밀번호를 확인해 주세요.');
   if(editing==='password'){
    const next=String(f.get('password'));if(next!==f.get('confirm'))throw Error('새 비밀번호가 일치하지 않습니다.');
    const result=await supabase!.auth.updateUser({password:next,current_password:password});if(result.error)throw result.error;
    form.reset();const logout=await supabase!.auth.signOut({scope:'others'});if(logout.error)throw Error('비밀번호는 변경됐지만 다른 기기 로그아웃을 완료하지 못했습니다. 연결을 확인해 주세요.');
    setNotice('비밀번호를 변경했습니다. 다른 기기는 새 비밀번호로 다시 로그인해야 합니다.');
   }else{
    const email=String(f.get('email')).trim();if(email.toLowerCase()===user.email?.toLowerCase())throw Error('현재와 다른 이메일을 입력해 주세요.');
    const result=await supabase!.auth.updateUser({email},{emailRedirectTo:location.origin});if(result.error)throw result.error;
    setUser(result.data.user);setNotice('기존 이메일과 새 이메일에 보낸 인증 링크를 모두 확인해 주세요. 인증 전에는 기존 이메일이 유지됩니다.');
   }
  }
  setEditing(null);void refresh();
 }catch(e){setNotice(e instanceof Error?e.message:'변경에 실패했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 async function resend(){setBusy(true);try{const {error}=await supabase!.auth.resend({type:'email_change',email:user.new_email!,options:{emailRedirectTo:location.origin}});if(error)throw error;setNotice('인증 메일을 다시 요청했습니다. 받은편지함과 스팸함을 확인해 주세요.')}catch(e){setNotice(e instanceof Error?e.message:'발송에 실패했습니다.')}finally{setBusy(false)}}
 return <section className="profile-settings"><h2>내 프로필</h2><p className="muted">프로필을 바꿔도 기존 대화·친구·파일은 유지됩니다.</p>
 {!profile?<button onClick={()=>void refresh()}>프로필 다시 불러오기</button>:<>
 {([['name','닉네임',profile.display_name],['username','아이디','@'+profile.username],['email','이메일',user.email],['password','비밀번호','••••••••']] as const).map(([key,label,value])=><div className="profile-setting-row" key={key}><div><small>{label}</small><strong>{value}</strong></div><button disabled={busy} onClick={()=>edit(key)}>변경</button></div>)}
 {user.new_email&&<div className="notice"><p>변경 대기: {user.new_email}</p><p>기존·새 이메일 양쪽 인증이 필요합니다. 재발송은 60초 이상 간격을 두고 요청해 주세요.</p><button disabled={busy} onClick={()=>void resend()}>인증 메일 다시 보내기</button><button disabled={busy} onClick={()=>void refresh()}>인증 상태 확인</button></div>}
 {editing&&<form className="profile-edit-form" onSubmit={submit}><h3>{editing==='name'?'닉네임':editing==='username'?'아이디':editing==='email'?'이메일':'비밀번호'} 변경</h3>
 {editing==='name'&&<label>새 닉네임<input name="name" defaultValue={profile.display_name} maxLength={30} required/></label>}
 {editing==='username'&&<><label>새 아이디<input value={candidate} onChange={e=>{setCandidate(e.target.value);setChecked('')}} pattern="[a-zA-Z0-9_]{3,24}" maxLength={24} required autoComplete="off"/></label><button type="button" disabled={busy||!candidate.trim()} onClick={()=>void check()}>중복 확인</button><p className="muted">영문·숫자·밑줄 3~24자. 30일에 한 번 변경할 수 있습니다. 이전 아이디는 30일 동안 사용할 수 없습니다.</p>{profile.username_changed_at&&<p>마지막 변경: {new Date(profile.username_changed_at).toLocaleDateString('ko-KR')}</p>}</>}
 {(editing==='email'||editing==='password')&&<label>현재 비밀번호<input name="current" type="password" autoComplete="current-password" required maxLength={128}/></label>}
 {editing==='email'&&<label>새 이메일<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>}
 {editing==='password'&&<><label>새 비밀번호<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label><label>새 비밀번호 확인<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label></>}
 <div className="friend-actions"><button type="button" disabled={busy} onClick={()=>edit(null)}>취소</button><button className="primary-button" disabled={busy||(editing==='username'&&!checked)}>{busy?'처리 중…':editing==='email'?'인증 메일 보내기':'변경 저장'}</button></div></form>}
 </>}<p role="status">{notice}</p></section>
}
