import {installShareUrl} from '../features/invites/context';
import {useEffect,useRef,useState} from 'react';
interface InstallPrompt extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
const GUIDE_KEY='weano-install-guide-v1';
export function installPlatform(ua:string,platform='',touch=0){
 const android=/Android/i.test(ua)||/Android/i.test(platform);
 const ios=/iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(platform)&&touch>1);
 const edge=/Edg(?:A|iOS)?\//.test(ua);
 return {android,ios,mac:!ios&&/Mac/i.test(platform||ua),edge,chrome:android&&/Chrome\//.test(ua)&&!edge&&!/SamsungBrowser|OPR\/|; wv\)/.test(ua)};
}
function standalone(){return matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)}
export function InstallButton(){return <div className="install-control"><button className="install-button" onClick={()=>window.dispatchEvent(new Event('weano-install-help'))}>설치 안내</button></div>}
export function InstallGuideHost(){
 const [platform]=useState(()=>installPlatform(navigator.userAgent,(navigator as Navigator&{userAgentData?:{platform:string}}).userAgentData?.platform??navigator.platform,navigator.maxTouchPoints));
 const [installed,setInstalled]=useState(standalone),[prompt,setPrompt]=useState<InstallPrompt|null>(null),[open,setOpen]=useState(false),[notice,setNotice]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const help=()=>{setNotice('');setOpen(true)},ready=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt)},done=()=>{setInstalled(true);setPrompt(null);setNotice('설치가 완료됐습니다. 홈 화면에서 메신저를 열고 설정에서 알림을 켜 주세요.')};
  window.addEventListener('weano-install-help',help);window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);
  let seen=false;try{seen=localStorage.getItem(GUIDE_KEY)==='seen'}catch{}
  // Device platform, not window width: desktop small windows must not get mobile instructions.
  if((platform.android||platform.ios)&&(!standalone()||(platform.android&&platform.edge))&&!seen)setOpen(true);
  return()=>{window.removeEventListener('weano-install-help',help);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done)};
 },[platform]);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open)dialog.current?.close()},[open]);
 function close(){try{localStorage.setItem(GUIDE_KEY,'seen')}catch{}setOpen(false)}
 async function install(){if(!prompt)return;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted'){setInstalled(true);setNotice('홈 화면에서 메신저를 열고 설정에서 알림을 켜 주세요.')}else setNotice('설치를 취소했습니다. 나중에 다시 설치할 수 있습니다.')}catch{setNotice('브라우저 메뉴에서 앱 설치를 선택해 주세요.')}finally{setPrompt(null)}}
 const origin=installShareUrl(),target=new URL(origin),chromeLink='intent://'+target.host+target.pathname+target.search+'#Intent;scheme='+target.protocol.slice(0,-1)+';package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(origin)+';end';
 return <dialog ref={dialog} className="install-guide" aria-labelledby="install-guide-title" onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
 <header><span className="install-guide-kicker">기기에 메신저 설치하기</span><button className="install-guide-close" aria-label="설치 안내 닫기" onClick={close}>✕</button></header>
 <h2 id="install-guide-title">{platform.android?'휴대폰·태블릿에서는 Chrome을 권장해요':platform.ios?'홈 화면에서 메신저를 열어보세요':'메신저를 앱으로 설치하세요'}</h2>
 {platform.android?<><p className="install-guide-lead">{platform.edge?'지금은 Edge로 접속했어요. Chrome으로 다시 열어 설치해 주세요.':platform.chrome?'Chrome으로 접속했어요. 아래 순서대로 설치해 주세요.':'이 사이트를 Chrome으로 다시 열어 설치해 주세요.'}</p>
 <div className="install-guide-note">홈 화면 숫자 배지를 사용하려면 Chrome으로 설치하는 것을 권장합니다. 갤럭시 테스트에서 Chrome은 숫자가 표시됐지만 Edge로 만든 아이콘에서는 표시되지 않았습니다.</div>
 <ol><li><strong>Chrome에서 이 사이트 열기</strong><p>{platform.chrome?'지금 보고 있는 페이지에서 다음 단계로 진행하세요.':'아래 ‘Chrome으로 열기’를 누르세요. 열리지 않으면 주소를 복사한 뒤 Chrome 주소창에 붙여넣으세요.'}</p></li><li><strong>브라우저 메뉴 ⋮ 누르기</strong><p>‘홈 화면에 추가’ 또는 ‘설치 및 바로가기 만들기’를 선택하세요. 버전에 따라 ‘앱 설치’가 바로 보일 수 있습니다.</p></li><li><strong>‘설치’ 선택하기</strong><p>‘앱 설치’와 ‘바로가기 만들기’가 함께 보이면 ‘앱 설치’를 선택해 주세요.</p></li><li><strong>홈 화면에서 실행하고 알림 켜기</strong><p>메신저 아이콘으로 실행 → 로그인 → 설정 → 알림 켜기. 브라우저가 묻는 알림 권한도 허용해 주세요.</p></li></ol>
 <p className="install-guide-footnote">숫자는 기기·홈 화면·알림 설정에 따라 다릅니다. 갤럭시의 ‘앱 아이콘 배지’도 켜져 있어야 합니다. 알림창의 알림을 지우면 숫자가 사라질 수 있어요.</p>
 {!platform.chrome&&<div className="install-guide-actions"><a className="guide-primary" href={chromeLink}>Chrome으로 열기</a><button onClick={()=>void navigator.clipboard.writeText(origin).then(()=>setNotice('주소를 복사했습니다. Chrome 주소창에 붙여넣어 주세요.')).catch(()=>setNotice('아래 사이트 주소를 길게 눌러 복사해 주세요.'))}>사이트 주소 복사</button></div>}
 {!platform.chrome&&<><p className="install-guide-address">{origin}</p><p className="install-guide-footnote">Chrome이 없다면 Play 스토어에서 Google Chrome을 설치한 뒤 이 주소를 열어 주세요. 기존 대화와 친구는 같은 계정으로 로그인하면 그대로 보입니다.</p></>}
 <a className="install-official" href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=ko" target="_blank" rel="noreferrer">Chrome 공식 설치 도움말 ↗</a>
 </>:platform.ios?<><p>iPhone·iPad에서는 Safari로 사이트를 열어 주세요.</p><ol><li>공유 버튼 누르기</li><li>‘홈 화면에 추가’ 선택</li><li>‘추가’를 누르고 홈 화면 아이콘으로 실행</li><li>로그인 후 설정에서 알림 켜기</li></ol></>:platform.mac?<><p>Mac에서는 Safari의 ‘파일 → Dock에 추가’로 설치할 수 있습니다(macOS Sonoma 14 이상).</p><p>Chrome·Edge에서도 앱 설치를 이용할 수 있습니다. 설치 후 앱에서 로그인하고 알림을 켜 주세요.</p><p>Mac의 알림·숫자 배지는 현재 실기기 검증 전입니다.</p></>:<><p>Chrome·Edge 브라우저에서 주소창의 설치 아이콘 또는 메뉴의 ‘앱 설치’를 선택하세요.</p><p>설치 후에도 같은 계정으로 기존 대화를 이어갈 수 있습니다.</p></>}
 {prompt&&!installed&&(!platform.android||platform.chrome)&&<button className="guide-primary" onClick={()=>void install()}>지금 앱 설치</button>}
 {installed&&<p className="install-guide-footnote">앱이 설치되어 있습니다. 홈 화면 아이콘으로 실행해 주세요. 설치 안내는 설정에서 다시 볼 수 있어요.</p>}
 <p role="status">{notice}</p><footer><button onClick={close}>확인 · 닫기</button><small>나중에 설정 → 설치 안내에서 다시 볼 수 있어요.</small></footer>
 </dialog>
}
