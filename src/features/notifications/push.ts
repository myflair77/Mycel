import {supabase} from '../../services/supabase';
const key='messenger-push-device';
export function savedPush():{id:string;userId:string}|null{try{return JSON.parse(localStorage.getItem(key)??'null')}catch{return null}}
export async function bindWorker(reg:ServiceWorkerRegistration,userId:string){
 const worker=reg.active;if(!worker)throw new Error('알림 서비스를 다시 시도해 주세요.');
 await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(new Error('알림 서비스 응답 시간 초과')),5000);channel.port1.onmessage=()=>{clearTimeout(timer);resolve()};worker.postMessage({type:'PUSH_USER',userId},[channel.port2])});
}
export async function disablePush(){
 const device=savedPush();
 if(device){const {error}=await supabase!.rpc('remove_push',{p_device:device.id});if(error)throw error}
 if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('/');if(reg){await bindWorker(reg,'');await (await reg.pushManager.getSubscription())?.unsubscribe()}}
 localStorage.removeItem(key);
}
export function rememberPush(id:string,userId:string){localStorage.setItem(key,JSON.stringify({id,userId}))}
