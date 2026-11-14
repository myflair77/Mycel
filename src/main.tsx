import {AccountRecovery,type AccountFlow} from './features/auth/AccountRecovery';
import {Icon,type IconName} from './components/Icon';
import {useSaved} from './features/messages/ux';
import {FontSizeControl} from './components/FontSizeControl';
import {syncUnreadBadge} from './features/notifications/badge';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {appConfig} from './config';
import {useLayout} from './hooks/useLayout';
import {InstallButton} from './components/InstallButton';
import {AuthPanel} from './features/auth/AuthPanel';
import {ChatWorkspace} from './features/messages/ChatWorkspace';
import {supabase,initialAuthFlow} from './services/supabase';
import './styles/app.css';
import './styles/atelier.css';
function App(){
 const [accountFlow,setAccountFlow]=useState<AccountFlow|null>(initialAuthFlow as AccountFlow|null);
 const {preference,setPreference,layout}=useLayout();
 const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
 const [theme,setTheme]=useSaved<'light'|'dark'|'system'>('weano-theme',(()=>{try{return localStorage.getItem('weano-dark')==='true'?'dark':'system'}catch{return 'system'}})());const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);const dark=theme==='dark'||(theme==='system'&&systemDark); const [section,setSection]=useState<'chats'|'friends'|'settings'>('chats');const [requests,setRequests]=useState(0);const [detail,setDetail]=useState(false),[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(Boolean(supabase));
 useEffect(()=>{if(!supabase)return;let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{if(active){setSession(current);setLoading(false);if(_event==='PASSWORD_RECOVERY'){setAccountFlow('recovery');if(current)sessionStorage.setItem('weano-recovery-user',current.user.id)}else if(current&&sessionStorage.getItem('weano-recovery-user')===current.user.id)setAccountFlow('recovery')}});
  void supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 useEffect(()=>{if(!loading&&!session)void syncUnreadBadge(0)},[loading,session]);
 useEffect(()=>{const update=()=>{document.documentElement.style.setProperty('--viewport-height',(window.visualViewport?.height??window.innerHeight)+'px')};update();window.visualViewport?.addEventListener('resize',update);window.addEventListener('resize',update);return()=>{window.visualViewport?.removeEventListener('resize',update);window.removeEventListener('resize',update)}},[]);
 if(accountFlow)return <AccountRecovery flow={accountFlow} session={session} onDone={()=>{sessionStorage.removeItem('weano-recovery-user');history.replaceState(null,'',location.pathname);setAccountFlow(null);setAuthMode('login')}}/>;
 return <div data-layout={layout} data-section={section} className={`app ${session?'signed-in':''} ${dark?'dark':''} ${detail?'detail-open':''}`}>
  <div className="display-controls"><div className="app-brand"><Icon name="chat" size={20}/><span>WebMessenger</span></div><select aria-label="화면 모드" id="layout-mode" value={preference} onChange={e=>setPreference(e.target.value as typeof preference)}><option value="auto">자동</option><option value="desktop">데스크톱</option><option value="tablet">태블릿</option><option value="phone">휴대폰</option></select><FontSizeControl/><InstallButton/></div>
  <nav className="rail" aria-label="주 탐색"><div className="mark" aria-label="WebMessenger"><Icon name="chat" size={23}/></div><div className="nav-items">{([['friends','친구','friends'],['chats','대화','chat'],['settings','설정','settings']] as const).filter(([key])=>session||key==='chats').map(([key,label,icon])=><button key={key} aria-current={section===key?'page':undefined} onClick={()=>{setSection(key);setDetail(false)}}><span aria-hidden="true"><Icon name={icon as IconName}/></span>{label}{key==='friends'&&requests>0&&<b className="nav-count">{requests}</b>}</button>)}</div></nav>
  {session?<ChatWorkspace theme={theme} onTheme={setTheme} key={session.user.id} session={session} section={section} onSection={setSection} onRequests={setRequests} layout={layout} conversationVisible={section==='chats'&&(layout!=='phone'||detail)} onOpen={()=>{setSection('chats');setDetail(true)}} onBack={()=>setDetail(false)}/>:<>
   <aside className="list"><header><p className="eyebrow">A LITTLE CLOSER</p><h1>{appConfig.displayName}</h1><p className="muted">{appConfig.nameStatus}</p></header><section className="empty-list"><div className="outline-icon">＋</div><h2>대화의 시작.</h2><p>나만의 계정으로 소중한 대화를 이어가세요.</p><div className="auth-actions"><button className="primary-button" onClick={()=>{setAuthMode('login');setDetail(true)}}>로그인</button><button className="text-button" onClick={()=>{setAuthMode('signup');setDetail(true)}}>회원가입</button></div></section><footer>언제 어디서나, 이어지는 대화</footer></aside>
   <main><header className="topbar"><button className="back" onClick={()=>setDetail(false)}>← 목록</button><span>우리의 대화가 시작되는 곳</span><span className="badge">개발 베타</span></header>{loading?<p role="status">로그인 상태 확인 중…</p>:<AuthPanel key={authMode} signup={authMode==='signup'} onSwitch={()=>setAuthMode(authMode==='signup'?'login':'signup')}/>}<footer className="main-footer">이름은 고민 중, 좋은 대화는 준비 중.</footer></main>
  </>}
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
