import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
export type Conversation={id:string;direct_key:string;peer:{id:string;username:string;display_name:string}|null;last_body:string|null;last_at:string|null;muted:boolean};
export function conversationTime(value:string|null){if(!value)return '';const date=new Date(value),now=new Date();return date.toDateString()===now.toDateString()?date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',...(date.getFullYear()!==now.getFullYear()?{year:'numeric' as const}:{})})}
export function useConversations(userId:string){
 const [rooms,setRooms]=useState<Conversation[]>([]),[roomsError,setRoomsError]=useState('');
 const refreshRef=useRef<()=>Promise<void>>(async()=>{});
 const refreshRooms=useCallback(()=>refreshRef.current(),[]);
 useEffect(()=>{
  let stopped=false,loading=false,queued=false;
  async function refresh(){if(stopped)return;if(loading){queued=true;return}loading=true;
   try{const {data,error}=await supabase!.rpc('get_conversations').abortSignal(AbortSignal.timeout(15000));if(stopped)return;if(error)throw error;setRooms(data as Conversation[]);setRoomsError('')}
   catch{if(!stopped)setRoomsError('대화 목록 연결을 다시 확인하고 있습니다.')}
   finally{loading=false;if(queued&&!stopped){queued=false;void refresh()}}
  }
  refreshRef.current=refresh;
  const channel=supabase!.channel('conversations:'+userId+':'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>void refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void refresh()});
  const resume=()=>{if(document.visibilityState==='visible')void refresh()};const timer=setInterval(resume,5000);
  window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);void refresh();
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);void supabase!.removeChannel(channel)};
 },[userId]);
 return {rooms,roomsError,refreshRooms};
}
