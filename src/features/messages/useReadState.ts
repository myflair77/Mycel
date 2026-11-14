import {savedPush} from '../notifications/push';
import {closeReadNotifications} from '../notifications/readNotifications';
import {syncServerBadge} from '../notifications/badge';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
import {canMarkRead} from './readState';
type Activity={room_id:string;unread_count:number;peer_read_sequence:number};
export function useReadState(room:string,latestSequence:number,conversationVisible:boolean,userId:string){
 const [activity,setActivity]=useState<Record<string,Activity>>({});
 const [readError,setReadError]=useState('');
 const [wake,setWake]=useState(0);
 const acknowledged=useRef<Record<string,number>>({});
 const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let stopped=false,loading=false,queued=false;
  async function refresh(){
   if(stopped)return;if(loading){queued=true;return}loading=true;
   try{
    let notifications:Notification[]=[];
    if('serviceWorker' in navigator&&savedPush()?.userId===userId){
     try{const registration=await navigator.serviceWorker.getRegistration('/');notifications=await registration?.getNotifications()??[]}catch{/* Read state still works without notifications. */}
    }
    if(stopped)return;
    const {data,error}=await supabase!.rpc('get_chat_activity');
    if(stopped)return;
    if(error){setReadError('읽음 상태를 확인하지 못했습니다. 자동으로 다시 시도합니다.');return}
    if(savedPush()?.userId===userId)closeReadNotifications(notifications,data as Activity[]);
    const badge=await supabase!.rpc('get_badge_snapshot');
    if(stopped)return;
    if(!badge.error&&badge.data)await syncServerBadge(badge.data);
    if(stopped)return;
    setActivity(Object.fromEntries((data as Activity[]).map(item=>[item.room_id,item])));
   }finally{loading=false;if(queued&&!stopped){queued=false;void refresh()}}
  }
  refreshRef.current=()=>void refresh();
  const resume=()=>{setWake(value=>value+1);void refresh()};
  const channel=supabase!.channel('activity:'+crypto.randomUUID())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>void refresh())
   .on('postgres_changes',{event:'*',schema:'public',table:'chat_reads'},()=>void refresh())
   .subscribe(status=>{if(status==='SUBSCRIBED')void refresh()});
  const timer=setInterval(resume,5000);
  window.addEventListener('focus',resume);window.addEventListener('blur',resume);
  window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  const badgeRefresh=(event:MessageEvent)=>{if(event.data?.type==='BADGE_REFRESH')void refresh()};
  navigator.serviceWorker?.addEventListener('message',badgeRefresh);
  void refresh();
  return()=>{stopped=true;navigator.serviceWorker?.removeEventListener('message',badgeRefresh);clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('blur',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);void supabase!.removeChannel(channel)};
 },[userId]);
 useEffect(()=>{
  if(!canMarkRead(room,conversationVisible,document.visibilityState==='visible',document.hasFocus())||latestSequence<=0||latestSequence<=(acknowledged.current[room]??0))return;
  let cancelled=false;
  // Wait until the visible conversation has painted; cancelled when focus/room changes.
  const frame=requestAnimationFrame(()=>{
   if(cancelled||!canMarkRead(room,conversationVisible,document.visibilityState==='visible',document.hasFocus()))return;
   void supabase!.rpc('mark_chat_read',{p_room:room,p_sequence:latestSequence}).then(({data,error})=>{
    if(error){if(!cancelled)setReadError('읽음 상태를 저장하지 못했습니다. 자동으로 다시 시도합니다.');return}
    acknowledged.current[room]=Math.max(acknowledged.current[room]??0,Number(data));
    if(!cancelled){setReadError('');refreshRef.current()}
   });
  });
  return()=>{cancelled=true;cancelAnimationFrame(frame)};
 },[room,latestSequence,conversationVisible,wake]);
 return {activity,readError};
}
