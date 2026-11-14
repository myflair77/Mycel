import {ExpiringFiles} from './ExpiringFiles';
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
import {AttachmentMessage} from './AttachmentMessage';
import {deliverAttachment,fileName,fileMime,fileSize,validateFile,type Attachment} from './attachments';
import {useConversations,conversationTime} from './useConversations';
import {MessageSearch} from './MessageSearch';
import {recoverMessages} from './recover';
export function ChatWorkspace({session,conversationVisible,onOpen,onBack}:{session:Session;conversationVisible:boolean;onOpen:()=>void;onBack:()=>void}){
 const {rooms,roomsError,refreshRooms}=useConversations(session.user.id);
 const [room,setRoom]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]);
 const [searchOpen,setSearchOpen]=useState(false),[jumpId,setJumpId]=useState(''),[muteBusy,setMuteBusy]=useState(false),[dragging,setDragging]=useState(false);
 const jumpRef=useRef('');jumpRef.current=jumpId;
 const [error,setError]=useState(''),[connection,setConnection]=useState('대화방을 선택하세요'),[body,setBody]=useState(''),[outboxVersion,setOutboxVersion]=useState(0),[busy,setBusy]=useState(false);
 const [outbox]=useState(()=>new Outbox(sessionStorage,session.user.id,()=>setOutboxVersion(v=>v+1)));
 const [selected,setSelected]=useState<File|null>(null),[uploadStages,setUploadStages]=useState<Record<string,string>>({});
 const uploadFiles=useRef(new Map<string,File>());const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{for(const key of uploadFiles.current.keys())if(!outbox.items.some(item=>item.key===key))uploadFiles.current.delete(key)},[outboxVersion]);
 const sendLock=useRef(false);
 const activeRoom=useRef(room);activeRoom.current=room;
 const sequence=useRef(0);
 useEffect(()=>{const target=new URLSearchParams(window.location.search).get('room');if(target&&/^[0-9a-f-]{36}$/i.test(target)){setRoom(target);onOpen();window.history.replaceState(null,'',window.location.pathname)}},[]);
 const messageList=useRef<HTMLDivElement>(null);
 const latestSequence=contiguousReadPosition(messages,room);
 const {activity,readError}=useReadState(room,latestSequence,conversationVisible&&!jumpId,session.user.id);
 useLayoutEffect(()=>{
  const list=messageList.current;
  if(list){if(jumpId){const target=list.querySelector<HTMLElement>('[data-message-id="'+jumpId+'"]');if(target)list.scrollTop+=target.getBoundingClientRect().top-list.getBoundingClientRect().top-20}else list.scrollTop=list.scrollHeight;}
 },[room,messages,outboxVersion,jumpId]);
 useEffect(()=>{
  const list=messageList.current;if(!list)return;
  // Also show the latest message when a phone conversation becomes visible
  // or the keyboard changes the available height.
  const observer=new ResizeObserver(()=>{if(!jumpRef.current)list.scrollTop=list.scrollHeight});
  observer.observe(list);
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  setMessages([]);setJumpId('');setSearchOpen(false);setDragging(false);sequence.current=0;setBody('');setSelected(null);setError('');
  if(!room)return;let stopped=false;let syncing=false;let queued=false;let realtime=false;
  async function sync(){
   if(stopped)return;if(!navigator.onLine){setConnection('오프라인 · 연결을 기다리는 중');return}if(syncing){queued=true;return}syncing=true;
   try{
    await recoverMessages(sequence.current,async cursor=>{
     const {data,error}=await supabase!.from('messages').select('id,room_id,sender_id,body,sequence,created_at,idempotency_key,attachment_id').eq('room_id',room).gt('sequence',cursor).order('sequence').limit(100).abortSignal(AbortSignal.timeout(15000));
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
   if(item.attachment)return deliverAttachment(item.attachment,uploadFiles.current.get(item.key),stage=>setUploadStages(v=>({...v,[item.key]:stage})));
   if(!navigator.onLine)throw new Error('인터넷 연결이 없습니다. 연결 후 재전송해 주세요.');
   const {data,error}=await supabase!.rpc('send_message',{p_room:item.room,p_body:item.body,p_key:item.key}).abortSignal(AbortSignal.timeout(15000));
   if(error)throw new Error(error.message.includes('Abort')?'응답 시간이 초과되었습니다. 재전송해도 중복 저장되지 않습니다.':error.message);
   return data as ChatMessage;
  });
  if(saved){uploadFiles.current.delete(key);void refreshRooms()}
  if(saved&&activeRoom.current===saved.room_id)setMessages(old=>mergeMessages(old,[saved]));
 }
 async function send(event:FormEvent){event.preventDefault();if((!body.trim()&&!selected)||sendLock.current||!room)return;
  sendLock.current=true;setBusy(true);const target=room;
  try{
   let attachment:Attachment|undefined;
   if(selected){validateFile(selected);const id=crypto.randomUUID();attachment={id,room_id:target,sender_id:session.user.id,name:fileName(selected.name),size:selected.size,mime:await fileMime(selected),path:session.user.id+'/'+id};uploadFiles.current.set(id,selected)}
   const item=outbox.enqueue(target,attachment?.name??body.trim(),attachment);if(activeRoom.current===target){if(!attachment)setBody('');setSelected(null)}setError('');
   await retry(item.key);
  }catch(e){setError((e as Error).message)}finally{sendLock.current=false;setBusy(false)}
 }
 async function toggleMute(){const target=room;const current=rooms.find(x=>x.id===target);if(!current||muteBusy)return;setMuteBusy(true);try{const {error}=await supabase!.rpc('set_room_muted',{p_room:target,p_muted:!current.muted}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;await refreshRooms()}catch{setError('알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.')}finally{setMuteBusy(false)}}
 function chooseFile(file:File){try{validateFile(file);setSelected(file);setError('')}catch(err){setError((err as Error).message)}}
 function dropFile(event:React.DragEvent){if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();setDragging(false);if(!room||busy)return;if(event.dataTransfer.files.length!==1){setError('파일은 한 번에 1개씩 첨부해 주세요.');return}chooseFile(event.dataTransfer.files[0]);}
 return <><aside className="list chat-list"><h1>대화</h1><p className="muted">@{session.user.user_metadata.username}</p><PushSettings userId={session.user.id} room={room} conversationVisible={conversationVisible}/><FriendsPanel onChat={openChat}/><p className="notice" role="alert">{error}</p><p className="notice" role="status">{roomsError}</p><ExpiringFiles onOpen={id=>{setRoom(id);onOpen()}}/><h2>대화 목록</h2><div className="room-list">{rooms.map(item=><button key={item.id} aria-current={room===item.id?'page':undefined} onClick={()=>{setRoom(item.id);onOpen()}}>{item.peer?.display_name??'대화 상대'}{Number(activity[item.id]?.unread_count)>0&&<span className="unread-badge" aria-label={'안 읽은 메시지 '+activity[item.id].unread_count+'개'}>{Number(activity[item.id].unread_count)>99?'99+':activity[item.id].unread_count}</span>}<small>{item.peer?'@'+item.peer.username:'프로필 확인 중'}{item.muted?' · 알림 꺼짐':''}</small><span className="conversation-preview">{item.last_body??'아직 메시지가 없습니다.'}</span>{item.last_at&&<time className="conversation-time" dateTime={item.last_at}>{conversationTime(item.last_at)}</time>}</button>)}</div><button className="text-button" onClick={()=>void refreshRooms()}>목록 새로고침</button><button className="text-button" onClick={async()=>{try{await disablePush();const {error}=await supabase!.auth.signOut();if(error)setError(error.message)}catch(e){setError('알림 구독 해제 실패: '+String((e as {message?:string}).message??e))}}}>로그아웃</button></aside>
 <main className={'chat-main'+(dragging?' file-dragging':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=room&&!busy?'copy':'none';setDragging(Boolean(room&&!busy))}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragging(false)}} onDrop={dropFile}><header className="topbar"><button className="back" onClick={onBack}>← 목록</button><span>{rooms.find(item=>item.id===room)?.peer?.display_name??'1:1 대화'}</span><span className="muted" role="status">{connection}</span>{room&&<button className="text-button" onClick={async()=>{const peer=rooms.find(item=>item.id===room)?.peer;if(!peer)return;const {data,error}=await supabase!.rpc('set_user_block',{p_peer:peer.id,p_block:true});setError(error?.message??data?.error??'차단했습니다. 이전 대화는 보존되고 새 메시지는 양쪽 모두 전송할 수 없습니다.')}}>상대 차단</button>}{room&&<><button type="button" className="text-button" aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}>대화 검색</button><button type="button" className="text-button" disabled={muteBusy||!rooms.some(x=>x.id===room)} aria-pressed={rooms.find(x=>x.id===room)?.muted??false} onClick={()=>void toggleMute()}>{muteBusy?'저장 중…':rooms.find(x=>x.id===room)?.muted?'이 대화 알림 켜기':'이 대화 알림 끄기'}</button></>}</header>
 {searchOpen&&room&&<MessageSearch key={room} room={room} onSelect={message=>{setMessages(old=>mergeMessages(old,[message]));setJumpId(message.id)}}/>}{jumpId&&<button type="button" className="latest-message" onClick={()=>setJumpId('')}>최근 메시지로 돌아가기 ↓</button>}{dragging&&<p className="drop-hint">파일을 놓아 첨부하세요 · 전송 버튼을 누르면 보내집니다</p>}
 <div ref={messageList} className="message-list" aria-label="대화 메시지" aria-live="polite">{!room&&<p>대화방을 선택하거나 사용자 ID로 대화를 시작하세요.</p>}{messages.map(message=><article key={message.id} data-message-id={message.id} className={(message.sender_id===session.user.id?'message mine':'message')+(jumpId===message.id?' search-highlight':'')}><div className={'message-bubble'+(message.attachment_id?' attachment-bubble':'')}>{message.attachment_id?<AttachmentMessage id={message.attachment_id}/>:<p>{message.body}</p>}</div><div className="message-meta">{message.sender_id===session.user.id&&activity[room]&&Number(activity[room].peer_read_sequence)<message.sequence&&<small className="unread-people" aria-label="안 읽은 사람 1명">1</small>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div></article>)}{outbox.items.filter(item=>item.room===room).map(item=><article key={item.key} className="message mine outgoing"><p>{item.body}</p><small role="status">{item.status==='sending'?(uploadStages[item.key]??'전송 중…'):'전송 실패 · '+item.error}</small>{item.status==='failed'&&item.attachment&&!uploadFiles.current.has(item.key)&&<label className="reselect-file">파일 다시 선택<input type="file" onChange={e=>{const file=e.target.files?.[0];if(!file)return;try{validateFile(file);if(fileName(file.name)!==item.attachment!.name||file.size!==item.attachment!.size)throw Error('같은 이름과 크기의 원본 파일을 선택해 주세요.');uploadFiles.current.set(item.key,file);setOutboxVersion(v=>v+1)}catch(err){setError((err as Error).message)}}}/></label>}{item.status==='failed'&&<button type="button" className="retry-button" onClick={()=>void retry(item.key)}>재전송</button>}</article>)}</div>
 <p className="notice" role="status">{readError}</p><p className="notice" role="alert">{error}</p><div className="attachment-toolbar"><input ref={fileInput} className="sr-only" type="file" aria-label="사진 또는 파일 선택" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;chooseFile(file)}}/><button type="button" disabled={!room||busy} onClick={()=>fileInput.current?.click()}>＋ 사진·파일</button>{selected?<span>{fileName(selected.name)} · {fileSize(selected.size)} <button type="button" onClick={()=>setSelected(null)}>선택 취소</button></span>:<small>파일당 최대 300MB · 새 파일은 30일 보관</small>}</div><form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">메시지</label><textarea id="message" value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} disabled={!room||Boolean(selected)} placeholder={selected?'선택한 파일을 전송합니다':'메시지를 입력하세요'} rows={2}/><button className="primary-button" disabled={!room||(!body.trim()&&!selected)||busy||outbox.items.some(item=>item.room===room&&item.status==='sending')}>전송</button></form></main></>;
}
