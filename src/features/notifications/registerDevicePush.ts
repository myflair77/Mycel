import {supabase} from '../../services/supabase';
import {bindWorker,rememberPush,savedPush} from './push';
/** Called only by a user action. Permission alone is not a registered device. */
export async function registerDevicePush(userId:string){
 if(Notification.permission==='denied')return false;
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')return false;
 const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
 if(!reg.active)await navigator.serviceWorker.ready;
 const {data:publicKey,error}=await supabase!.rpc('get_push_public_key');
 if(error||!publicKey)throw new Error('서버 알림 설정을 확인할 수 없습니다.');
 const existing=savedPush();
 if(existing&&existing.userId!==userId){await (await reg.pushManager.getSubscription())?.unsubscribe();await bindWorker(reg,'')}
 const bytes=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const subscription=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 const json=subscription.toJSON();
 const result=await supabase!.rpc('register_push',{p_endpoint:subscription.endpoint,p_p256dh:json.keys?.p256dh,p_auth:json.keys?.auth,p_label:/Android/.test(navigator.userAgent)?'갤럭시/Android':'데스크톱 브라우저'});
 if(result.error)throw result.error;
 if(!result.data)throw new Error('기기 알림 등록을 확인하지 못했습니다. 다시 시도해 주세요.');
 await bindWorker(reg,userId);rememberPush(result.data,userId);return true;
}
