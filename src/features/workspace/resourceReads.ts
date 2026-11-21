import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
export type UnreadResource={id:string;kind:'event'|'note';version:number};
const changed='mycel-resource-read';
export function useResourceUnread(userId:string,room:string|null,enabled:boolean){
 const [result,setResult]=useState<{scope:string;items:UnreadResource[];error:string}>({scope:'',items:[],error:''});
 const scope=userId+':'+(room??'personal');
 useEffect(()=>{if(!enabled)return;let stopped=false,loading=false,queued=false;
 const refresh=async()=>{if(stopped)return;if(loading){queued=true;return}if(document.visibilityState!=='visible')return;loading=true;
 try{const {data,error}=await supabase!.rpc('workspace_unread',{p_room:room});if(!stopped)setResult({scope,items:error?[]:data??[],error:error?'확인할 항목 수를 불러오지 못했습니다. 자동으로 다시 시도합니다.':''})}
 catch{if(!stopped)setResult({scope,items:[],error:'확인할 항목 수를 불러오지 못했습니다. 자동으로 다시 시도합니다.'})}
 finally{loading=false;if(queued&&!stopped){queued=false;void refresh()}}};
 const resume=()=>void refresh();resume();const timer=setInterval(resume,5000);window.addEventListener(changed,resume);window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
 return()=>{stopped=true;clearInterval(timer);window.removeEventListener(changed,resume);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)};
 },[scope,enabled,room]);
 return enabled&&result.scope===scope?result:{items:[],error:''};
}
export function useResourceRead(userId:string,id:string,version:number,room:string|null,active:boolean){
 const confirmed=useRef('');const [error,setError]=useState('');
 useEffect(()=>{if(!active||!version)return;let cancelled=false,loading=false;const key=[userId,id,room,version].join(':');
 const mark=async()=>{if(cancelled||loading||confirmed.current===key||document.visibilityState!=='visible'||!document.hasFocus())return;loading=true;
 try{const {error}=await supabase!.rpc('workspace_mark_read',{p_id:id,p_version:version,p_room:room});if(!cancelled){if(error)setError('확인 상태를 저장하지 못했습니다. 자동으로 다시 시도합니다.');else{confirmed.current=key;setError('');window.dispatchEvent(new Event(changed))}}}
 catch{if(!cancelled)setError('확인 상태를 저장하지 못했습니다. 자동으로 다시 시도합니다.')}
 finally{loading=false}};
 const resume=()=>void mark();const frame=requestAnimationFrame(resume);const timer=setInterval(resume,5000);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
 return()=>{cancelled=true;cancelAnimationFrame(frame);clearInterval(timer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
 },[userId,id,version,room,active]);return error;
}
