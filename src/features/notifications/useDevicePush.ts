import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
import {bindWorker,disablePush,savedPush} from './push';
import {registerDevicePush} from './registerDevicePush';
export function useDevicePush(userId:string,room:string,conversationVisible:boolean){
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [permission,setPermission]=useState<NotificationPermission>(()=>'Notification' in window?Notification.permission:'default');
 const locked=useRef(false),generation=useRef(0),alive=useRef(true);
 const refresh=useCallback(async()=>{if(locked.current)return;const request=++generation.current;
  if(!supported){setReady(true);return}
  try{const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});const device=savedPush();
   const active=Boolean(device?.userId===userId&&Notification.permission==='granted'&&await reg.pushManager.getSubscription());
   if(active)await bindWorker(reg,userId);
   if(alive.current&&request===generation.current){setEnabled(active);setPermission(Notification.permission)}
  }catch{if(alive.current)setNotice('알림 상태를 확인하지 못했습니다. 다시 시도해 주세요.')}
  finally{if(alive.current)setReady(true)}
 },[supported,userId]);
 useEffect(()=>{alive.current=true;void refresh();const visible=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{alive.current=false;generation.current++;window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);document.removeEventListener('visibilitychange',visible)}
 },[refresh]);
 useEffect(()=>{if(!enabled)return;const device=savedPush();if(!device||device.userId!==userId)return;
  const update=()=>{const visible=conversationVisible&&document.visibilityState==='visible'&&document.hasFocus();void supabase!.rpc('touch_push',{p_device:device.id,p_room:visible&&room?room:null})};
  update();const timer=setInterval(update,10000);window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('blur',update);document.removeEventListener('visibilitychange',update);void supabase!.rpc('touch_push',{p_device:device.id,p_room:null})}
 },[enabled,userId,room,conversationVisible]);
 async function toggle(){if(locked.current||!supported)return;locked.current=true;generation.current++;setBusy(true);setNotice('');
  try{if(enabled){await disablePush();if(alive.current){setEnabled(false);setNotice('이 기기의 알림을 껐습니다.')}return}
   const registered=await registerDevicePush(userId);
   if(alive.current){setEnabled(registered);setPermission(Notification.permission);setNotice(registered?'메시지·언급·리마인더 알림을 받을 준비가 됐습니다.':Notification.permission==='denied'?'알림 권한이 차단되어 있습니다. 아래 안내에 따라 허용해 주세요.':'알림 허용을 완료하지 않았습니다. 알림 켜기를 눌러 다시 시도할 수 있어요.')}
  }catch(e){if(alive.current){setPermission(Notification.permission);setNotice((e as Error).message||'알림 등록에 실패했습니다. 다시 시도해 주세요.')}}
  finally{locked.current=false;if(alive.current)setBusy(false)}
 }
 return {userId,supported,enabled,ready,busy,notice,permission,toggle,refresh};
}
export type DevicePush=ReturnType<typeof useDevicePush>;
