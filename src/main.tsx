import {usePhoneDrawer} from './components/usePhoneDrawer';
import type {Section} from './features/workspace/Workspace';
import {InvitePage} from './features/invites/InvitePage';
import {readInvite,clearInvite} from './features/invites/context';
import {AccountRecovery,type AccountFlow} from './features/auth/AccountRecovery';
import {Icon,type IconName} from './components/Icon';
import {useSaved} from './features/messages/ux';
import {useFontScale} from './components/FontSizeControl';
import {syncUnreadBadge} from './features/notifications/badge';
import React,{useEffect,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {appConfig} from './config';
import {useLayout} from './hooks/useLayout';
import {InstallGuideHost} from './components/InstallButton';
import {AuthPanel} from './features/auth/AuthPanel';
import {ChatWorkspace} from './features/messages/ChatWorkspace';
import {supabase,initialAuthFlow} from './services/supabase';
import './styles/app.css';
import './styles/atelier.css';
function App(){
 useFontScale();
 useEffect(()=>{if('serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});},[]);
 const [inviteToken,setInviteToken]=useState<string|null>(readInvite),[serverInvite,setServerInvite]=useState(false);
 const [accountFlow,setAccountFlow]=useState<AccountFlow|null>(initialAuthFlow as AccountFlow|null);
 const {preference,setPreference,layout}=useLayout();
 const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
 const [theme,setTheme]=useSaved<'light'|'dark'|'system'>('weano-theme',(()=>{try{return localStorage.getItem('weano-dark')==='true'?'dark':'system'}catch{return 'system'}})());const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);const dark=theme==='dark'||(theme==='system'&&systemDark); const [section,setSection]=useState<Section>('chats');const [requests,setRequests]=useState(0);const [detail,setDetail]=useState(false),[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(Boolean(supabase));
 useEffect(()=>{if(!supabase)return;let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{if(active){setSession(current);setLoading(false);if(_event==='PASSWORD_RECOVERY'){setAccountFlow('recovery');if(current)sessionStorage.setItem('weano-recovery-user',current.user.id)}else if(current&&sessionStorage.getItem('weano-recovery-user')===current.user.id)setAccountFlow('recovery')}});
  void supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(!loading&&!session)void syncUnreadBadge(0)},[loading,session]);
 useEffect(()=>{if(!session||inviteToken!==null){setServerInvite(false);return}let live=true;const check=()=>{void supabase!.rpc('resolve_friend_invite').then(({data,error})=>{if(live&&!error)setServerInvite(!data.none)})};check();window.addEventListener('focus',check);return()=>{live=false;window.removeEventListener('focus',check)}},[session?.user.id,inviteToken]);
 function finishInvite(room?:string,friends=false){clearInvite();if(room){const u=new URL(location.href);u.searchParams.set('room',room);history.replaceState(null,'',u.pathname+u.search)}setInviteToken(null);setServerInvite(false);setSection(friends?'friends':'chats');setDetail(!!room)}
 const inviteVisible=inviteToken!==null||serverInvite;

 useEffect(()=>{const update=()=>{document.documentElement.style.setProperty('--viewport-height',(window.visualViewport?.height??window.innerHeight)+'px')};update();window.visualViewport?.addEventListener('resize',update);window.addEventListener('resize',update);return()=>{window.visualViewport?.removeEventListener('resize',update);window.removeEventListener('resize',update)}},[]);
 if(accountFlow)return <AccountRecovery flow={accountFlow} session={session} onDone={()=>{sessionStorage.removeItem('weano-recovery-user');history.replaceState(null,'',location.pathname);setAccountFlow(null);setAuthMode('login')}}/>;
 const phoneDrawer=usePhoneDrawer(!!session && layout==='phone' && section==='chats' && !inviteVisible,!detail,value=>setDetail(!value));
 return <div {...phoneDrawer} data-layout={layout} data-section={section} className={`app ${inviteVisible?'invite-mode':''} ${session?'signed-in':''} ${dark?'dark':''} ${detail?'detail-open':''}`}>
  <InstallGuideHost/>{!session&&new URLSearchParams(location.search).has('share')&&<div className="share-status" role="status">공유받은 내용이 있습니다. 로그인 후 보낼 대화를 선택해 주세요.</div>}{new URLSearchParams(location.search).has('shareError')&&<div className="share-status" role="alert">공유를 받지 못했습니다. 최대 10개·합계 300MB, 텍스트 4,000자와 기기 저장 공간을 확인하고 다시 공유해 주세요.<button onClick={()=>{const u=new URL(location.href);u.searchParams.delete('shareError');location.replace(u.href)}}>닫기</button></div>}
  <nav className="rail" aria-label="주 탐색"><div className="mark" aria-label="Mycel"><img src="/icons/mycel-m-v2-192.png" alt=""/></div><div className="nav-items">{([['chats','공간','chat'],['friends','사람','friends'],['settings','설정','settings']] as const).filter(([key])=>session||key==='chats').map(([key,label,icon])=><button key={key} aria-current={section===key?'page':undefined} onClick={()=>{if(key==='settings'){window.dispatchEvent(new Event('mycel-settings'));return}setSection(key);setDetail(layout==='phone'&&key==='chats'&&key===section?!detail:false)}}><span aria-hidden="true"><Icon name={icon as IconName}/></span>{label}{key==='friends'&&requests>0&&<b className="nav-count">{requests}</b>}</button>)}</div></nav>
  {inviteVisible?<InvitePage token={inviteToken} session={session} authLoading={loading} onDone={finishInvite}/>:session?<ChatWorkspace phonePanelOpen={!detail} layoutPreference={preference} onLayoutPreference={setPreference} theme={theme} onTheme={setTheme} key={session.user.id} session={session} section={section} onSection={setSection} onRequests={setRequests} layout={layout} conversationVisible={(section==='chats'&&(layout!=='phone'||detail))} onOpen={()=>{setDetail(true)}} onBack={()=>setDetail(false)}/>:<>
   <aside className="list"><header><p className="eyebrow">A LITTLE CLOSER</p><h1>{appConfig.displayName}</h1><p className="muted">{appConfig.nameStatus}</p></header><section className="empty-list"><div className="outline-icon">＋</div><h2>대화의 시작.</h2><p>나만의 계정으로 소중한 대화를 이어가세요.</p><div className="auth-actions"><button className="primary-button" onClick={()=>{setAuthMode('login');setDetail(true)}}>로그인</button><button className="text-button" onClick={()=>{setAuthMode('signup');setDetail(true)}}>회원가입</button></div></section><footer>언제 어디서나, 이어지는 대화</footer></aside>
   <main><header className="topbar"><button className="back" onClick={()=>setDetail(false)}>← 목록</button><span>우리의 대화가 시작되는 곳</span><span className="badge">개발 베타</span></header>{loading?<p role="status">로그인 상태 확인 중…</p>:<AuthPanel key={authMode} signup={authMode==='signup'} onSwitch={()=>setAuthMode(authMode==='signup'?'login':'signup')}/>}<footer className="main-footer">Mycel에서 우리의 대화를 이어가세요.</footer></main>
  </>}
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
