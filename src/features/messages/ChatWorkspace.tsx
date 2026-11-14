import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../../services/supabase';
import {mergeMessages,type ChatMessage} from './model';
type Room={id:string;direct_key:string;peer?:{username:string;display_name:string}};
export function ChatWorkspace({session,onOpen,onBack}:{session:Session;onOpen:()=>void;onBack:()=>void}){
 const [rooms,setRooms]=useState<Room[]>([]),[room,setRoom]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]);
 const [error,setError]=useState(''),[connection,setConnection]=useState('대화방을 선택하세요'),[body,setBody]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef<{room:string;body:string;key:string}|null>(null);const activeRoom=useRef(room);activeRoom.current=room;
 const sequence=useRef(0);
 const refreshRooms=async()=>{
  const {data,error}=await supabase!.from('chat_rooms').select('id,direct_key').order('created_at',{ascending:false});
  if(error){setError(error.message);return}
  const rows=data??[];
  if(!rows.length){setRooms([]);return}
  const members=await supabase!.from('chat_members').select('room_id,user_id').in('room_id',rows.map(row=>row.id)).neq('user_id',session.user.id);
  if(members.error){setError(members.error.message);setRooms(rows);return}
  const ids=[...new Set((members.data??[]).map(member=>member.user_id))];
  if(!ids.length){setRooms(rows);return}
  const profiles=await supabase!.from('profiles').select('id,username,display_name').in('id',ids);
  if(profiles.error){setError(profiles.error.message);setRooms(rows);return}
  const people=new Map((profiles.data??[]).map(profile=>[profile.id,profile]));
  const peers=new Map((members.data??[]).map(member=>[member.room_id,people.get(member.user_id)]));
  setRooms(rows.map(row=>({...row,peer:peers.get(row.id)})));
 };
 useEffect(()=>{void refreshRooms();const interval=setInterval(()=>void refreshRooms(),10000);return()=>clearInterval(interval)},[session.user.id]);
 useEffect(()=>{
  setMessages([]);sequence.current=0;pending.current=null;setBody('');setError('');
  if(!room)return;let stopped=false;let syncing=false;
  async function sync(){
   if(syncing)return;syncing=true;
   try{
    let cursor=sequence.current;
    while(!stopped){
     const {data,error}=await supabase!.from('messages').select('id,room_id,sender_id,body,sequence,created_at').eq('room_id',room).gt('sequence',cursor).order('sequence').limit(100);
     if(stopped)return;if(error){setError(error.message);return}
     const rows=data as ChatMessage[];
     if(rows.length){setMessages(old=>mergeMessages(old,rows));cursor=rows[rows.length-1].sequence;sequence.current=cursor}
     if(rows.length<100)break;
    }
   }finally{syncing=false}
  }
  setConnection('연결 중');
  const channel=supabase!.channel('room:'+room+':'+crypto.randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room_id=eq.'+room},()=>{void sync()}).subscribe(status=>{
   if(stopped)return;
   setConnection(status==='SUBSCRIBED'?'실시간 연결됨':status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'연결 재시도 중':status);
   if(status==='SUBSCRIBED')void sync();
  });
  void sync();const timer=setInterval(()=>void sync(),5000);
  const resume=()=>void sync();window.addEventListener('online',resume);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',resume);void supabase!.removeChannel(channel)};
 },[room]);
 async function open(event:FormEvent<HTMLFormElement>){event.preventDefault();const name=String(new FormData(event.currentTarget).get('username')).replace(/^@/,'');setError('');
  const {data,error}=await supabase!.rpc('open_direct_chat',{p_username:name});if(error){setError(error.message);return}await refreshRooms();setRoom(data);onOpen();
 }
 async function send(event:FormEvent){event.preventDefault();if(!body.trim()||busy||!room)return;
  const target=room;const content=body.trim();
  if(!pending.current||pending.current.room!==target||pending.current.body!==content)pending.current={room:target,body:content,key:crypto.randomUUID()};
  const key=pending.current.key;setBusy(true);setError('');
  try{const {data,error}=await supabase!.rpc('send_message',{p_room:target,p_body:content,p_key:key});
   if(error)throw error;
   if(activeRoom.current===target){setMessages(old=>mergeMessages(old,[data as ChatMessage]));setBody('');pending.current=null}
  }catch(error){if(activeRoom.current===target)setError((error instanceof Error?error.message:'전송 실패')+' — 같은 내용으로 다시 전송하면 중복을 방지합니다.')}finally{setBusy(false)}
 }
 return <><aside className="list chat-list"><h1>대화</h1><p className="muted">@{session.user.user_metadata.username}</p><form onSubmit={open}><label>상대 사용자 ID<input name="username" placeholder="@username" required/></label><button className="primary-button">대화 시작</button></form><p className="muted">개발 베타: 정확한 ID로 1:1 대화를 엽니다.</p><div className="room-list">{rooms.map(item=><button key={item.id} aria-current={room===item.id?'page':undefined} onClick={()=>{setRoom(item.id);onOpen()}}>{item.peer?.display_name??'대화 상대'}<small>{item.peer?'@'+item.peer.username:'프로필 확인 중'}</small></button>)}</div><button className="text-button" onClick={()=>void refreshRooms()}>목록 새로고침</button><button className="text-button" onClick={async()=>{const {error}=await supabase!.auth.signOut();if(error)setError(error.message)}}>로그아웃</button></aside>
 <main className="chat-main"><header className="topbar"><button className="back" onClick={onBack}>← 목록</button><span>{rooms.find(item=>item.id===room)?.peer?.display_name??'1:1 대화'}</span><span className="muted" role="status">{connection}</span></header>
 <div className="message-list" aria-label="대화 메시지" aria-live="polite">{!room&&<p>대화방을 선택하거나 사용자 ID로 대화를 시작하세요.</p>}{messages.map(message=><article key={message.id} className={message.sender_id===session.user.id?'message mine':'message'}><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></article>)}</div>
 <p className="notice" role="alert">{error}</p><form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">메시지</label><textarea id="message" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} disabled={!room||busy} placeholder="메시지를 입력하세요" rows={2}/><button className="primary-button" disabled={!room||!body.trim()||busy}>{busy?'저장 중…':'전송'}</button></form></main></>;
}
