import {useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../../services/supabase';
import {contiguousReadPosition} from './readState';
import {useReadState} from './useReadState';
import {PushSettings} from '../notifications/PushSettings';
import {disablePush} from '../notifications/push';
import {FriendsPanel} from '../friends/FriendsPanel';
import {mergeMessages,type ChatMessage} from './model';
import {Outbox} from './outbox';
import {recoverMessages} from './recover';
type Room={id:string;direct_key:string;peer?:{id:string;username:string;display_name:string}};
export function ChatWorkspace({session,conversationVisible,onOpen,onBack}:{session:Session;conversationVisible:boolean;onOpen:()=>void;onBack:()=>void}){
 const [rooms,setRooms]=useState<Room[]>([]),[room,setRoom]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]);
 const [roomsError,setRoomsError]=useState('');
 const [error,setError]=useState(''),[connection,setConnection]=useState('대화방을 선택하세요'),[body,setBody]=useState(''),[outboxVersion,setOutboxVersion]=useState(0),[busy,setBusy]=useState(false);
 const [outbox]=useState(()=>new Outbox(sessionStorage,session.user.id,()=>setOutboxVersion(v=>v+1)));
 const sendLock=useRef(false);
 const activeRoom=useRef(room);activeRoom.current=room;
 const sequence=useRef(0);
 useEffect(()=>{const target=new URLSearchParams(window.location.search).get('room');if(target&&/^[0-9a-f-]{36}$/i.test(target)){setRoom(target);onOpen();window.history.replaceState(null,'',window.location.pathname)}},[]);
 const messageList=useRef<HTMLDivElement>(null);
 const latestSequence=contiguousReadPosition(messages,room);
 const {activity,readError}=useReadState(room,latestSequence,conversationVisible,session.user.id);
 useLayoutEffect(()=>{
  const list=messageList.current;
  if(list)list.scrollTop=list.scrollHeight;
 },[room,messages,outboxVersion]);
 useEffect(()=>{
  const list=messageList.current;if(!list)return;
  // Also show the latest message when a phone conversation becomes visible
  // or the keyboard changes the available height.
  const observer=new ResizeObserver(()=>{list.scrollTop=list.scrollHeight});
  observer.observe(list);
  return()=>observer.disconnect();
 },[]);
 const refreshRooms=async()=>{
  const {data,error}=await supabase!.from('chat_rooms').select('id,direct_key').order('created_at',{ascending:false});
  if(error){setRoomsError('대화 목록 연결을 다시 확인하고 있습니다.');return}
  const rows=data??[];
  if(!rows.length){setRoomsError('');setRooms([]);return}
  const members=await supabase!.from('chat_members').select('room_id,user_id').in('room_id',rows.map(row=>row.id)).neq('user_id',session.user.id);
  if(members.error){setRoomsError('대화 상대를 다시 확인하고 있습니다.');setRooms(rows);return}
  const ids=[...new Set((members.data??[]).map(member=>member.user_id))];
  if(!ids.length){setRooms(rows);return}
  const profiles=await supabase!.from('profiles').select('id,username,display_name').in('id',ids);
  if(profiles.error){setRoomsError('대화 상대를 다시 확인하고 있습니다.');setRooms(rows);return}
  const people=new Map((profiles.data??[]).map(profile=>[profile.id,profile]));
  const peers=new Map((members.data??[]).map(member=>[member.room_id,people.get(member.user_id)]));
  setRoomsError('');setRooms(rows.map(row=>({...row,peer:peers.get(row.id)})));
 };
 useEffect(()=>{void refreshRooms();const interval=setInterval(()=>void refreshRooms(),10000);return()=>clearInterval(interval)},[session.user.id]);
 useEffect(()=>{
  setMessages([]);sequence.current=0;setBody('');setError('');
  if(!room)return;let stopped=false;let syncing=false;let queued=false;let realtime=false;
  async function sync(){
   if(stopped)return;if(!navigator.onLine){setConnection('오프라인 · 연결을 기다리는 중');return}if(syncing){queued=true;return}syncing=true;
   try{
    await recoverMessages(sequence.current,async cursor=>{
     const {data,error}=await supabase!.from('messages').select('id,room_id,sender_id,body,sequence,created_at,idempotency_key').eq('room_id',room).gt('sequence',cursor).order('sequence').limit(100).abortSignal(AbortSignal.timeout(15000));
     if(error)throw error;return data as ChatMessage[];
    },(rows,cursor)=>{outbox.reconcile(rows);setMessages(old=>mergeMessages(old,rows));sequence.current=cursor},()=>stopped);
    if(stopped)return;
   setConnection(realtime?'실시간 연결됨':'연결됨 · 주기적으로 대화 확인 중');
   }catch{if(!stopped)setConnection(navigator.onLine?'연결 재시도 중 · 대화를 불러오지 못했습니다':'오프라인 · 연결을 기다리는 중')}finally{syncing=false;if(queued&&!stopped){queued=false;void sync()}}
  }
  setConnection('연결 중');
  const channel=supabase!.channel('room:'+room+':'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room_id=eq.'+room},()=>{void sync()}).subscribe(status=>{
   if(stopped)return;
   realtime=status==='SUBSCRIBED';setConnection(!navigator.onLine?'오프라인 · 연결을 기다리는 중':realtime?'실시간 연결됨':'실시간 연결 복구 중');
   if(status==='SUBSCRIBED')void sync();
  });
  void sync();const timer=setInterval(()=>void sync(),5000);
  const resume=()=>{if(document.visibilityState==='visible'){setConnection('대화 복구 중');void sync();void refreshRooms()}};const offline=()=>setConnection('오프라인 · 연결을 기다리는 중');window.addEventListener('online',resume);window.addEventListener('offline',offline);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',resume);window.removeEventListener('offline',offline);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);void supabase!.removeChannel(channel)};
 },[room]);
 async function openChat(name:string){setError('');
  const {data,error}=await supabase!.rpc('open_direct_chat',{p_username:name});if(error){setError(error.message);return}await refreshRooms();setRoom(data);onOpen();
 }
 async function retry(key:string){
  const saved=await outbox.send(key,async item=>{
   if(!navigator.onLine)throw new Error('인터넷 연결이 없습니다. 연결 후 재전송해 주세요.');
   const {data,error}=await supabase!.rpc('send_message',{p_room:item.room,p_body:item.body,p_key:item.key}).abortSignal(AbortSignal.timeout(15000));
   if(error)throw new Error(error.message.includes('Abort')?'응답 시간이 초과되었습니다. 재전송해도 중복 저장되지 않습니다.':error.message);
   return data as ChatMessage;
  });
  if(saved&&activeRoom.current===saved.room_id)setMessages(old=>mergeMessages(old,[saved]));
 }
 function send(event:FormEvent){event.preventDefault();if(!body.trim()||sendLock.current||!room)return;
  sendLock.current=true;setBusy(true);
  const item=outbox.enqueue(room,body.trim());setBody('');setError('');
  void retry(item.key).finally(()=>{sendLock.current=false;setBusy(false)});
 }
 return <><aside className="list chat-list"><h1>대화</h1><p className="muted">@{session.user.user_metadata.username}</p><PushSettings userId={session.user.id} room={room} conversationVisible={conversationVisible}/><FriendsPanel onChat={openChat}/><p className="notice" role="alert">{error}</p><p className="notice" role="status">{roomsError}</p><h2>대화 목록</h2><div className="room-list">{rooms.map(item=><button key={item.id} aria-current={room===item.id?'page':undefined} onClick={()=>{setRoom(item.id);onOpen()}}>{item.peer?.display_name??'대화 상대'}{Number(activity[item.id]?.unread_count)>0&&<span className="unread-badge" aria-label={'안 읽은 메시지 '+activity[item.id].unread_count+'개'}>{Number(activity[item.id].unread_count)>99?'99+':activity[item.id].unread_count}</span>}<small>{item.peer?'@'+item.peer.username:'프로필 확인 중'}</small></button>)}</div><button className="text-button" onClick={()=>void refreshRooms()}>목록 새로고침</button><button className="text-button" onClick={async()=>{try{await disablePush();const {error}=await supabase!.auth.signOut();if(error)setError(error.message)}catch(e){setError('알림 구독 해제 실패: '+String((e as {message?:string}).message??e))}}}>로그아웃</button></aside>
 <main className="chat-main"><header className="topbar"><button className="back" onClick={onBack}>← 목록</button><span>{rooms.find(item=>item.id===room)?.peer?.display_name??'1:1 대화'}</span><span className="muted" role="status">{connection}</span>{room&&<button className="text-button" onClick={async()=>{const peer=rooms.find(item=>item.id===room)?.peer;if(!peer)return;const {data,error}=await supabase!.rpc('set_user_block',{p_peer:peer.id,p_block:true});setError(error?.message??data?.error??'차단했습니다. 이전 대화는 보존되고 새 메시지는 양쪽 모두 전송할 수 없습니다.')}}>상대 차단</button>}</header>
 <div ref={messageList} className="message-list" aria-label="대화 메시지" aria-live="polite">{!room&&<p>대화방을 선택하거나 사용자 ID로 대화를 시작하세요.</p>}{messages.map(message=><article key={message.id} className={message.sender_id===session.user.id?'message mine':'message'}><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time>{message.sender_id===session.user.id&&<small className="read-receipt">{!activity[room]?'확인 중':Number(activity[room].peer_read_sequence)>=message.sequence?'읽음':'안 읽음'}</small>}</article>)}{outbox.items.filter(item=>item.room===room).map(item=><article key={item.key} className="message mine outgoing"><p>{item.body}</p><small role="status">{item.status==='sending'?'전송 중…':'전송 실패 · '+item.error}</small>{item.status==='failed'&&<button type="button" className="retry-button" onClick={()=>void retry(item.key)}>재전송</button>}</article>)}</div>
 <p className="notice" role="status">{readError}</p><p className="notice" role="alert">{error}</p><form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">메시지</label><textarea id="message" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} disabled={!room} placeholder="메시지를 입력하세요" rows={2}/><button className="primary-button" disabled={!room||!body.trim()||busy||outbox.items.some(item=>item.room===room&&item.status==='sending')}>전송</button></form></main></>;
}
