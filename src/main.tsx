import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {appConfig} from './config';
import {useLayout} from './hooks/useLayout';
import {InstallButton} from './components/InstallButton';
import {AuthPanel} from './features/auth/AuthPanel';
import {ChatWorkspace} from './features/messages/ChatWorkspace';
import {supabase} from './services/supabase';
import './styles/app.css';
function App(){
 const {preference,setPreference,layout}=useLayout();
 const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
 const [dark,setDark]=useState(false),[detail,setDetail]=useState(false),[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(Boolean(supabase));
 useEffect(()=>{if(!supabase)return;let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{if(active){setSession(current);setLoading(false)}});
  void supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}});
  return()=>{active=false;subscription.unsubscribe()};
 },[]);
 return <div data-layout={layout} className={`app ${dark?'dark':''} ${detail?'detail-open':''}`}>
  <div className="display-controls"><label htmlFor="layout-mode">화면 모드</label><select id="layout-mode" value={preference} onChange={e=>setPreference(e.target.value as typeof preference)}><option value="auto">자동</option><option value="desktop">데스크톱</option><option value="tablet">태블릿</option><option value="phone">휴대폰</option></select><span className="active-layout" aria-live="polite">{layout==='desktop'?'데스크톱':layout==='tablet'?'태블릿':'휴대폰'} 화면</span><InstallButton/></div>
  <nav className="rail" aria-label="주 탐색"><div className="mark" aria-label="메신저">w·</div><div className="nav-items"><button aria-current="page" onClick={()=>setDetail(false)}><span aria-hidden="true">◫</span>채팅</button></div><button className="theme" onClick={()=>setDark(!dark)} aria-label={dark?'라이트 모드':'다크 모드'}>{dark?'☀':'☾'}</button></nav>
  {session?<ChatWorkspace key={session.user.id} session={session} onOpen={()=>setDetail(true)} onBack={()=>setDetail(false)}/>:<>
   <aside className="list"><header><p className="eyebrow">A LITTLE CLOSER</p><h1>{appConfig.displayName}</h1><p className="muted">{appConfig.nameStatus}</p></header><section className="empty-list"><div className="outline-icon">＋</div><h2>대화의 시작.</h2><p>나만의 계정으로 소중한 대화를 이어가세요.</p><div className="auth-actions"><button className="primary-button" onClick={()=>{setAuthMode('login');setDetail(true)}}>로그인</button><button className="text-button" onClick={()=>{setAuthMode('signup');setDetail(true)}}>회원가입</button></div></section><footer>{supabase?'Supabase 연결 설정됨':'백엔드 연결 준비 중'}</footer></aside>
   <main><header className="topbar"><button className="back" onClick={()=>setDetail(false)}>← 목록</button><span>우리의 대화가 시작되는 곳</span><span className="badge">개발 베타</span></header>{loading?<p role="status">로그인 상태 확인 중…</p>:<AuthPanel key={authMode} signup={authMode==='signup'} onSwitch={()=>setAuthMode(authMode==='signup'?'login':'signup')}/>}<footer className="main-footer">이름은 고민 중, 좋은 대화는 준비 중.</footer></main>
  </>}
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
