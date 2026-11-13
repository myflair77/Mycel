import { useEffect, useState } from 'react';
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
export function InstallButton(){
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null); const [help,setHelp]=useState(false);
 const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
 useEffect(()=>{const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};const done=()=>{setInstalled(true);setPrompt(null)};window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done)}},[]);
 async function install(){if(!prompt){setHelp(!help);return}try{await prompt.prompt();await prompt.userChoice;setPrompt(null)}catch{setHelp(true);setPrompt(null)}}
 return <div className="install-control"><button className="install-button" onClick={install} disabled={installed} aria-expanded={help}>{installed?'앱 실행 중':prompt?'앱 설치':'설치 안내'}</button>{help&&<div className="install-help" role="region" aria-label="앱 설치 안내"><strong>기기에 앱으로 설치하기</strong><p>데스크톱: Chrome·Edge 메뉴의 앱 설치 또는 Safari의 Dock에 추가.</p><p>태블릿·휴대폰: 브라우저 메뉴의 앱 설치 또는 공유 메뉴의 홈 화면에 추가.</p><p>설치 메뉴가 없다면 일반 브라우저에서 사이트를 열어 주세요. 설치 후에도 화면 모드를 자유롭게 바꿀 수 있어요.</p><button onClick={()=>setHelp(false)}>닫기</button></div>}</div>
}
