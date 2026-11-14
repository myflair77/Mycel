import {useEffect,useState} from 'react';
import {supabase} from '../../services/supabase';
import {bindWorker,disablePush,rememberPush,savedPush} from './push';
export function PushSettings({userId,room,conversationVisible}:{userId:string;room:string;conversationVisible:boolean}){
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(!supported)return;void navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(async reg=>{const device=savedPush();setEnabled(Boolean(device?.userId===userId&&Notification.permission==='granted'&&await reg.pushManager.getSubscription()))}).catch(()=>setNotice('알림 서비스 준비에 실패했습니다. 새로고침해 주세요.'))},[userId,supported]);
 useEffect(()=>{
  if(!enabled)return;const device=savedPush();if(!device||device.userId!==userId)return;
  const update=()=>{const visible=conversationVisible&&document.visibilityState==='visible'&&document.hasFocus();void supabase!.rpc('touch_push',{p_device:device.id,p_room:visible&&room?room:null})};
  update();const timer=setInterval(update,10000);
  window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('blur',update);document.removeEventListener('visibilitychange',update);void supabase!.rpc('touch_push',{p_device:device.id,p_room:null})};
 },[enabled,userId,room,conversationVisible]);
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
 return <section className="push-settings"><h2>기기 알림</h2><p className="muted">메시지 내용은 알림에 표시하지 않습니다. 각 기기에서 따로 켜 주세요.</p><button className="primary-button" disabled={!supported||busy} onClick={()=>void toggle()}>{busy?'설정 중…':enabled?'이 기기 알림 끄기':'이 기기 알림 켜기'}</button><p role="status" className="notice">{supported?notice:'이 브라우저는 웹 푸시를 지원하지 않습니다. Chrome 또는 Edge에서 열어 주세요.'}</p></section>;
}
