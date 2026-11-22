import {useState} from 'react';
import type {DevicePush} from './useDevicePush';
import {PushPermissionHelp} from './PushOnboarding';
export function PushSettings({push}:{push:DevicePush}){
 const {supported,enabled,toggle}=push;const [inspecting,setBusy]=useState(false),[notice,setNotice]=useState('');const busy=push.busy||inspecting;
 async function inspectNotifications(){setBusy(true);try{
  const reg=await navigator.serviceWorker.ready;
  const status=await new Promise<{mode:string;count:number;backgroundBadge?:boolean}>((resolve,reject)=>{
   const channel=new MessageChannel();
   const timer=setTimeout(()=>{channel.port1.close();reject(new Error('알림 업데이트가 필요합니다. 새로고침 후 다시 확인해 주세요.'))},5000);
   channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};
   reg.active?.postMessage({type:'PUSH_STATUS'},[channel.port2]);
  });
  setNotice(status.mode==='per-message-v1'?`메시지별 알림 적용됨 · ${status.backgroundBadge?'창을 닫은 상태의 배지 갱신 적용됨':'배지 업데이트를 위해 새로고침해 주세요'} · 이 브라우저에 남은 알림 ${status.count}개. 홈 화면 배지 숫자와 비교해 주세요. 안 읽은 메시지 수와는 다를 수 있습니다.`:'새로고침 후 다시 확인해 주세요.');
 }catch(e){setNotice(String((e as Error).message))}finally{setBusy(false)}}
 return <section className="push-settings"><h2>기기 알림</h2><p className="muted">메시지 내용은 알림에 표시하지 않습니다. 메시지·언급·리마인더를 받으려면 이 기기의 알림을 켜 주세요.</p><button className="primary-button" disabled={!supported||busy} onClick={()=>{setNotice('');void toggle()}}>{busy?'설정 중…':enabled?'이 기기 알림 끄기':'이 기기 알림 켜기'}</button><button className="text-button" disabled={!supported||busy} onClick={()=>void inspectNotifications()}>알림 수 확인</button><p className="muted">Windows의 설치형 Edge·Chrome 웹앱은 새 메시지 푸시를 받으면 창이 닫혀 있어도 작업표시줄 배지에 전체 안 읽은 수를 반영합니다. 이 브라우저의 알림을 켜고 앱을 작업표시줄에 고정해 주세요. 브라우저 강제 종료·오프라인 상태에서는 갱신이 지연될 수 있습니다.</p><p className="muted">갤럭시 Edge의 홈 화면 바로가기는 숫자 배지가 표시되지 않을 수 있습니다. 숫자 표시가 필요한 경우 Chrome에서 이 사이트를 설치해 사용해 주세요. Edge에서도 메시지 알림과 읽음 상태 정리는 지원합니다.</p><details><summary>숫자 배지 검증 안내</summary><p className="muted">메시지마다 알림을 따로 남깁니다. Edge와 Chrome에서 각각 알림을 켜고 홈 화면으로 나간 뒤, 상대 계정에서 메시지 3개를 보내세요. 삼성 인터넷도 같은 순서로 비교할 수 있습니다.</p><p className="muted">갤럭시 설정의 앱 아이콘 배지를 숫자로 설정하세요. 숫자·점·표시 없음 중 어떤 결과인지, 메신저와 브라우저 중 어느 아이콘에 표시되는지 확인해 주세요. 알림을 지우면 배지가 사라질 수 있으며, 같은 계정의 다른 기기에서 대화를 모두 읽으면, 실행 중인 메신저는 해당 대화의 알림을 정리합니다. 닫혀 있던 메신저는 다시 열 때 정리합니다. 백그라운드 실행이 중단된 경우에는 화면으로 돌아올 때 반영됩니다.</p></details>{push.permission==='denied'&&<PushPermissionHelp/>}<p role="status" className="notice">{supported?(notice||push.notice):'이 브라우저는 웹 푸시를 지원하지 않습니다. Chrome 또는 Edge에서 열어 주세요.'}</p></section>;
}
