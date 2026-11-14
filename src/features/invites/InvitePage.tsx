import {useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../../services/supabase';
import {AuthPanel} from '../auth/AuthPanel';
import {InstallButton,installPlatform} from '../../components/InstallButton';
import {installShareUrl,validInvite} from './context';
type State={invite_id?:string;name?:string;username?:string;status?:'login'|'ready'|'pending'|'incoming'|'accepted'|'self';expires_at?:string;error?:string;none?:boolean};
export function InvitePage({token,session,authLoading,onDone}:{token:string|null;session:Session|null;authLoading:boolean;onDone:(room?:string,friends?:boolean)=>void}){
 const generation=useRef(0);
 const [state,setState]=useState<State|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState<'login'|'signup'|null>(null);
 const device=installPlatform(navigator.userAgent,(navigator as Navigator&{userAgentData?:{platform:string}}).userAgentData?.platform??navigator.platform,navigator.maxTouchPoints);
 async function load(){const run=++generation.current;if(!supabase){setNotice('서버 연결을 확인해 주세요.');return}setNotice('');try{const {data,error}=await supabase.rpc(session&&token?'remember_friend_invite':'resolve_friend_invite',token?{p_token:token}:{});if(error)throw error;if(run===generation.current)setState(data)}catch{if(run===generation.current)setNotice('초대를 불러오지 못했습니다. 다시 시도해 주세요.')}}
 useEffect(()=>{if(!authLoading)void load()},[token,session?.user.id,authLoading]);
 async function done(room?:string,friends=false){setBusy(true);try{if(session&&state?.invite_id){const {error}=await supabase!.rpc('dismiss_friend_invite',{p_invite_id:state.invite_id});if(error)throw error}onDone(room,friends)}catch{setNotice('초대를 정리하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 async function request(){setBusy(true);setNotice('');try{const {data,error}=await supabase!.rpc('request_invited_friend',{p_invite_id:state?.invite_id});if(error)throw error;if(data.error)throw Error(data.error);setState(old=>({...old,status:'pending'}));setNotice('친구 요청을 보냈습니다. 상대가 수락하면 친구 목록에서 대화할 수 있습니다.')}catch(e){setNotice(e instanceof Error?e.message:'요청하지 못했습니다.')}finally{setBusy(false)}}
 async function chat(){setBusy(true);try{const {data,error}=await supabase!.rpc('open_direct_chat',{p_username:state?.username});if(error)throw error;await done(data)}catch(e){setNotice(e instanceof Error?e.message:'대화를 열지 못했습니다.')}finally{setBusy(false)}}
 const url=installShareUrl(),parsed=new URL(url),chrome='intent://'+parsed.host+parsed.pathname+parsed.search+'#Intent;scheme='+parsed.protocol.slice(0,-1)+';package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(url)+';end';
 return <main className="invite-page"><section className="invite-welcome"><small className="invite-eyebrow">WEBMESSENGER · 친구 초대</small><h1>{state?.name?state.name+'님이 친구로 초대했어요.':'친구와 대화를 시작하세요.'}</h1>
 {device.android&&!device.chrome&&<div className="invite-browser-note"><strong>Chrome으로 다시 열어 주세요</strong><p>갤럭시의 홈 화면 숫자 배지는 Chrome으로 설치하는 것을 권장합니다. 초대 정보도 함께 전달됩니다.</p><div className="friend-actions"><a className="primary-button" href={chrome}>Chrome으로 열기</a><button onClick={()=>void navigator.clipboard.writeText(url).then(()=>setNotice('초대 링크를 복사했습니다. Chrome 주소창에 붙여넣어 주세요.')).catch(()=>setNotice('아래 주소를 선택해 복사해 주세요.'))}>초대 링크 복사</button></div><input aria-label="Chrome에서 열 초대 주소" readOnly value={url} onFocus={e=>e.currentTarget.select()}/><small>Chrome이 없다면 Play 스토어에서 설치해 주세요. 현재 브라우저에서도 계속할 수 있습니다.</small></div>}
 {device.ios&&<p>iPhone·iPad는 Safari에서 ‘공유 → 홈 화면에 추가’로 설치하는 것을 권장합니다.</p>}
 {!state&&!notice&&<p role="status">초대를 확인하고 있습니다…</p>}
 {state?.error&&<p role="alert">{state.error}</p>}{state?.none&&<p>이어갈 초대가 없습니다. 친구에게 초대 링크를 다시 받아 주세요.</p>}
 {state&&!state.error&&!state.none&&!session&&<><p>회원가입 또는 로그인 후 친구 요청을 보낼 수 있습니다. 자동으로 친구가 추가되지는 않습니다.</p><div className="friend-actions"><button className="primary-button" onClick={()=>setMode('signup')}>회원가입하고 계속</button><button onClick={()=>setMode('login')}>로그인하고 계속</button></div></>}
 {session&&state?.status==='ready'&&<><p>{state.name}님에게 친구 요청을 보낼까요?</p><button className="primary-button" disabled={busy} onClick={()=>void request()}>친구 요청 보내기</button></>}
 {session&&state?.status==='pending'&&<p>수락 대기 중입니다. 상대가 수락하면 친구가 됩니다.</p>}
 {session&&state?.status==='incoming'&&<><p>이 사용자가 보낸 친구 요청이 이미 있습니다.</p><button disabled={busy} onClick={()=>void done(undefined,true)}>받은 요청 확인</button></>}
 {session&&state?.status==='accepted'&&<><p>이미 친구입니다.</p><button className="primary-button" disabled={busy} onClick={()=>void chat()}>대화 시작</button></>}
 {state?.status==='self'&&<p>내가 만든 초대 링크입니다. 친구에게 공유해 주세요.</p>}
 <p role="status">{notice}</p>{notice&&!state&&<button onClick={()=>void load()}>다시 불러오기</button>}
 {mode&&!session&&!state?.error&&<AuthPanel signup={mode==='signup'} onSwitch={()=>setMode(mode==='signup'?'login':'signup')} inviteToken={validInvite(token)?token:undefined}/>}
 <div className="invite-footer"><button disabled={busy} onClick={()=>void done()}>나중에 · 메신저로 이동</button><InstallButton/></div><small className="muted">설치는 선택 사항입니다. 같은 계정으로 로그인하면 기존 대화와 친구가 유지됩니다.</small>
 </section></main>
}
