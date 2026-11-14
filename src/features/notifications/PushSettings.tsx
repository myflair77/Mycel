import {useEffect,useState} from 'react';
import {supabase} from '../../services/supabase';
import {bindWorker,disablePush,rememberPush,savedPush} from './push';
export function PushSettings({userId,room,conversationVisible}:{userId:string;room:string;conversationVisible:boolean}){
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(!supported)return;void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async reg=>{const device=savedPush();setEnabled(Boolean(device?.userId===userId&&Notification.permission==='granted'&&await reg.pushManager.getSubscription()))}).catch(()=>setNotice('알림 서비스 준비에 실패했습니다. 새로고침해 주세요.'))},[userId,supported]);
 useEffect(()=>{
  if(!enabled)return;const device=savedPush();if(!device||device.userId!==userId)return;
  const update=()=>{const visible=conversationVisible&&document.visibilityState==='visible'&&document.hasFocus();void supabase!.rpc('touch_push',{p_device:device.id,p_room:visible&&room?room:null})};
  update();const timer=setInterval(update,10000);
  window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('blur',update);document.removeEventListener('visibilitychange',update);void supabase!.rpc('touch_push',{p_device:device.id,p_room:null})};
 },[enabled,userId,room,conversationVisible]);
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
 async function toggle(){setBusy(true);setNotice('');try{
  if(enabled){await disablePush();setEnabled(false);setNotice('이 기기의 알림을 껐습니다.');return}
  const permission=await Notification.requestPermission();if(permission!=='granted'){setNotice('브라우저의 사이트 설정에서 알림을 허용해 주세요.');return}
  const reg=await navigator.serviceWorker.ready;
  const {data:publicKey,error}=await supabase!.rpc('get_push_public_key');if(error||!publicKey)throw new Error('서버 알림 설정을 확인할 수 없습니다.');
  const existing=savedPush();if(existing&&existing.userId!==userId){await (await reg.pushManager.getSubscription())?.unsubscribe();await bindWorker(reg,'')}
  const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const subscription=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
  const json=subscription.toJSON();
  const result=await supabase!.rpc('register_push',{p_endpoint:subscription.endpoint,p_p256dh:json.keys?.p256dh,p_auth:json.keys?.auth,p_label:/Android/.test(navigator.userAgent)?'갤럭시/Android':'데스크톱 브라우저'});
  if(result.error)throw result.error;
  await bindWorker(reg,userId);rememberPush(result.data,userId);setEnabled(true);setNotice('이 기기에서 새 메시지 알림을 받습니다.');
 }catch(e){setNotice(String((e as {message?:string}).message??'알림 설정 실패'))}finally{setBusy(false)}}
 return <section className="push-settings"><h2>기기 알림</h2><p className="muted">메시지 내용은 알림에 표시하지 않습니다. 각 기기에서 따로 켜 주세요.</p><button className="primary-button" disabled={!supported||busy} onClick={()=>void toggle()}>{busy?'설정 중…':enabled?'이 기기 알림 끄기':'이 기기 알림 켜기'}</button><button className="text-button" disabled={!supported||busy} onClick={()=>void inspectNotifications()}>알림 수 확인</button><p className="muted">Windows의 설치형 Edge·Chrome 웹앱은 새 메시지 푸시를 받으면 창이 닫혀 있어도 작업표시줄 배지에 전체 안 읽은 수를 반영합니다. 이 브라우저의 알림을 켜고 앱을 작업표시줄에 고정해 주세요. 브라우저 강제 종료·오프라인 상태에서는 갱신이 지연될 수 있습니다.</p><details><summary>숫자 배지 검증 안내</summary><p className="muted">메시지마다 알림을 따로 남깁니다. Edge와 Chrome에서 각각 알림을 켜고 홈 화면으로 나간 뒤, 상대 계정에서 메시지 3개를 보내세요. 삼성 인터넷도 같은 순서로 비교할 수 있습니다.</p><p className="muted">갤럭시 설정의 앱 아이콘 배지를 숫자로 설정하세요. 숫자·점·표시 없음 중 어떤 결과인지, 메신저와 브라우저 중 어느 아이콘에 표시되는지 확인해 주세요. 알림을 지우면 배지가 사라질 수 있으며, 다른 기기에서 읽어도 이 기기의 알림은 자동으로 지워지지 않습니다.</p></details><p role="status" className="notice">{supported?notice:'이 브라우저는 웹 푸시를 지원하지 않습니다. Chrome 또는 Edge에서 열어 주세요.'}</p></section>;
}
