import {PersonalWorkspace} from '../workspace/PersonalWorkspace';
import {SettingsDialog} from '../../components/SettingsDialog';
import {openAI} from '../ai/client';
import {Library,type Section} from '../workspace/Workspace';
import {ComposerTools,PollCard,useRoomTools} from './ComposerTools';
import {MessageText} from './MessageText';
import {GroupDialog,useGroupState,unreadPeople} from './GroupChat';
import {ShareInbox} from '../sharing/ShareInbox';
import {SearchInput} from '../../components/SearchInput';
import {MessageActions} from './MessageActions';
import {MessageGesture} from './MessageGesture';
import {ReplyQuote} from './ReplyQuote';
import {useMessageFlags} from './useMessageFlags';
import {Board,useRoomPosts} from './Board';
import type {LayoutPreference} from '../layout/layout';
import {useBlockConfirmation} from '../../components/BlockConfirmation';
import {ProfileSettings} from '../auth/ProfileSettings';
import {Icon} from '../../components/Icon';
import {InstallButton} from '../../components/InstallButton';
import {cancelPendingUpload} from './r2';
import {RoomDrawer} from './RoomDrawer';
import {SelectedFiles} from './SelectedFiles';
import {useSaved,dayLabel,grouped} from './ux';
import {FontSizeControl} from '../../components/FontSizeControl';
import {ExpiringFiles} from './ExpiringFiles';
import {Fragment,useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
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
export function ChatWorkspace({layoutPreference,onLayoutPreference,theme,onTheme,session,section,onSection:onSectionRoot,onRequests,layout,conversationVisible,onOpen,onBack}:{layoutPreference:LayoutPreference;onLayoutPreference:(value:LayoutPreference)=>void;theme:'light'|'dark'|'system';onTheme:(theme:'light'|'dark'|'system')=>void;session:Session;section:Section;onSection:(s:Section)=>void;onRequests:(n:number)=>void;layout:string;conversationVisible:boolean;onOpen:()=>void;onBack:()=>void}){
  const [spaceTab,setSpaceTab]=useState<'chat'|'event'|'note'>('chat'),[personalTab,setPersonalTab]=useState<'event'|'note'>('event'),[chatKind,setChatKind]=useState('all');
 const {confirmBlock,confirmation}=useBlockConfirmation();
 const {rooms,roomsError,refreshRooms}=useConversations(session.user.id);
 const [composerTools,setComposerTools]=useState<'menu'|'poll'|'schedule'|null>(null);
 const [groupDialog,setGroupDialog]=useState<'new'|'manage'|'from-direct'|null>(null);
 const [room,setRoom]=useState(''),[messages,setMessages]=useState<ChatMessage[]>([]);
 const [action,setAction]=useState<{message:ChatMessage;x:number;y:number}|null>(null),[reply,setReply]=useState<ChatMessage|null>(null),[board,setBoard]=useState<{message?:ChatMessage;notice?:boolean;postId?:string}|null>(null),[important,setImportant]=useState(false),[noticeClosed,setNoticeClosed]=useState(false);
 const {flags,flagsError}=useMessageFlags(session.user.id);const {posts,postsError}=useRoomPosts(room);
 const syncRef=useRef<()=>void>(()=>{});const actionsOpen=useRef(false);actionsOpen.current=!!action||!!board;
 const visibleMessages=messages.filter(m=>!flags[m.id]?.hidden&&(!important||flags[m.id]?.starred));
 function changed(){syncRef.current();void refreshRooms()}
 function showActions(message:ChatMessage,x:number,y:number){setAction({message,x,y})}

 const [searchOpen,setSearchOpen]=useState(false),[jumpId,setJumpId]=useState(''),[muteBusy,setMuteBusy]=useState(false),[dragging,setDragging]=useState(false);
 const jumpRef=useRef('');jumpRef.current=jumpId;
 const [error,setError]=useState(''),[connection,setConnection]=useState('대화방을 선택하세요'),[body,setBody]=useState(''),[outboxVersion,setOutboxVersion]=useState(0),[busy,setBusy]=useState(false);
 const [outbox]=useState(()=>new Outbox(sessionStorage,session.user.id,()=>setOutboxVersion(v=>v+1),new URLSearchParams(location.search).get('popup')?':'+window.name:''));
 const [selected,setSelected]=useState<File[]>([]),[uploadStages,setUploadStages]=useState<Record<string,string>>({});
 const uploadFiles=useRef(new Map<string,File>());const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{for(const key of uploadFiles.current.keys())if(!outbox.items.some(item=>item.key===key))uploadFiles.current.delete(key)},[outboxVersion]);
 const [menu,setMenu]=useState(false),[drawer,setDrawer]=useState(false),[filter,setFilter]=useState(''),[unreadOnly,setUnreadOnly]=useState(false),[collapsed,setCollapsed]=useState(false),[atBottom,setAtBottom]=useState(true);
 const [pins,setPins]=useSaved<string[]>('weano-pins:'+session.user.id,[]),[listWidth,setListWidth]=useSaved('weano-list-width',310),[enterSend,setEnterSend]=useSaved('weano-enter-send',true);
 const pendingFiles=useRef(new Map<string,File[]>()),cancelled=useRef(new Set<string>()),popupWindows=useRef(new Map<string,Window>()),textarea=useRef<HTMLTextAreaElement>(null);
 const draftKey=(id:string)=>'weano-draft:'+session.user.id+':'+id;
 function writeBody(value:string){setBody(value);try{localStorage.setItem(draftKey(room),value)}catch{}}
 function selectRoom(id:string,push=true){onSection('chats');pendingFiles.current.set(room,selected);setRoom(id);onOpen();if(push&&layout==='phone')history.pushState({weanoRoom:id},'',location.pathname+'?room='+id)}
 useEffect(()=>{document.querySelector('.app')?.classList.toggle('list-collapsed',collapsed&&section==='chats')});
 function back(){setCollapsed(false);document.querySelector('.app')?.classList.remove('list-collapsed');if(layout==='phone')history.replaceState(null,'',location.pathname);setMenu(false);setDrawer(false);setSearchOpen(false);onBack();}
 function popup(){if(!room)return;const old=popupWindows.current.get(room);if(old&&!old.closed){old.focus();return}const opened=window.open(location.pathname+'?room='+room+'&popup=1','weano-room-'+room,'popup,width=480,height=760');if(opened){popupWindows.current.set(room,opened);opened.focus()}else setError('새 창이 차단되었습니다. 브라우저에서 팝업을 허용하거나 현재 창에서 대화해 주세요.');setMenu(false)}
 const overlay=useRef(false);overlay.current=menu||drawer||searchOpen||!!action||!!board||!!groupDialog||!!composerTools;
 useEffect(()=>{if((menu||drawer||searchOpen||!!action||!!board||!!groupDialog||!!composerTools)&&!history.state?.weanoOverlay)history.pushState({...history.state,weanoOverlay:true},'',location.href);else if(!(menu||drawer||searchOpen||!!action||!!board||!!groupDialog||!!composerTools)&&history.state?.weanoOverlay)history.back()},[menu,drawer,searchOpen,action,board,groupDialog,composerTools]);
 useEffect(()=>{const pop=(e:PopStateEvent)=>{const dialog=document.querySelector<HTMLDialogElement>('dialog[open]');if(dialog){dialog.dispatchEvent(new Event('cancel',{cancelable:true}));return}if(overlay.current){setMenu(false);setDrawer(false);setSearchOpen(false);return}if(e.state?.weanoRoom){setRoom(e.state.weanoRoom);onOpen()}else back()};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(document.querySelector('dialog[open]'))return;if(menu)setMenu(false);else if(drawer)setDrawer(false);else if(searchOpen)setSearchOpen(false);else back()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&room&&conversationVisible){e.preventDefault();setSearchOpen(true)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[menu,drawer,searchOpen,room,conversationVisible]);
 useEffect(()=>{const el=textarea.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,140)+'px'}},[body]);
 useEffect(()=>{document.documentElement.style.setProperty('--list-width',Math.max(140,Math.min(600,Number.isFinite(listWidth)?listWidth:310))+'px')},[listWidth]);
 const resizeDrag=useRef<{x:number;width:number}|null>(null);
 function resizeList(separator:HTMLElement,width:number){
  const app=separator.closest('.app')!;const list=separator.previousElementSibling as HTMLElement;
  const available=app.getBoundingClientRect().right-list.getBoundingClientRect().left;
  setListWidth(Math.round(Math.max(140,Math.min(600,Math.max(140,available-284),width))));
 }
 const sendLock=useRef(false),deliveryLock=useRef(false);const [delivering,setDelivering]=useState(false);
 const activeRoom=useRef(room);activeRoom.current=room;
 const sequence=useRef(0);
 useEffect(()=>{const target=new URLSearchParams(window.location.search).get('room');if(target&&/^[0-9a-f-]{36}$/i.test(target)){setRoom(target);onOpen();window.history.replaceState({weanoRoom:target},'',window.location.href)}},[]);
 const messageList=useRef<HTMLDivElement>(null);const stickToBottom=useRef(true);
 const isSelf=rooms.some(x=>x.id===room&&x.direct_key==='self:'+session.user.id);
 const [selfBusy,setSelfBusy]=useState(false);
 async function openSelf(){if(selfBusy)return;setSelfBusy(true);setError('');try{const {data,error}=await supabase!.rpc('open_self_chat');if(error)throw error;await refreshRooms();selectRoom(data)}catch{setError('나와의 대화를 열지 못했습니다. 다시 시도해 주세요.')}finally{setSelfBusy(false)}}
 const historyStart=Number(rooms.find(x=>x.id===room)?.peer?.history_start_sequence??0);
 const latestSequence=contiguousReadPosition(messages,room,historyStart);
 const {activity,readError}=useReadState(room,latestSequence,conversationVisible&&spaceTab==='chat'&&!composerTools&&!groupDialog&&!action&&!board&&!important&&!isSelf&&!drawer&&!menu&&!jumpId&&atBottom,session.user.id);
 useLayoutEffect(()=>{
  const list=messageList.current;
  if(list&&!actionsOpen.current){if(jumpId){const target=list.querySelector<HTMLElement>('[data-message-id="'+jumpId+'"]');if(target)list.scrollTop+=target.getBoundingClientRect().top-list.getBoundingClientRect().top-20}else if(stickToBottom.current){stickToBottom.current=true;list.scrollTop=list.scrollHeight;}}
 },[room,messages,outboxVersion,jumpId]);
 useEffect(()=>{
  const list=messageList.current;if(!list)return;
  // Also show the latest message when a phone conversation becomes visible
  // or the keyboard changes the available height.
  let nearBottom=stickToBottom.current;const track=()=>{nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<100};list.addEventListener('scroll',track);const observer=new ResizeObserver(()=>{if(!actionsOpen.current&&!jumpRef.current&&nearBottom)list.scrollTop=list.scrollHeight});
  observer.observe(list);const media=()=>{if(!actionsOpen.current&&stickToBottom.current&&!jumpRef.current)list.scrollTop=list.scrollHeight};list.addEventListener('weano-media-ready',media);
  return()=>{observer.disconnect();list.removeEventListener('scroll',track);list.removeEventListener('weano-media-ready',media)};
 },[]);
 useEffect(()=>{
  setAction(null);setReply(null);setBoard(null);setImportant(false);setNoticeClosed(false);setMessages([]);setJumpId('');setSearchOpen(false);setDragging(false);sequence.current=historyStart;try{setBody(localStorage.getItem(draftKey(room))??'')}catch{setBody('')}setSelected(pendingFiles.current.get(room)??[]);stickToBottom.current=true;setAtBottom(true);setMenu(false);setDrawer(false);setError('');
  if(!room)return;let stopped=false;let syncing=false;let queued=false;let realtime=false;let changedSince='1970-01-01T00:00:00.000Z';
  async function sync(){
   if(stopped)return;if(!navigator.onLine){setConnection('오프라인 · 연결을 기다리는 중');return}if(syncing){queued=true;return}syncing=true;
   try{
    let newestChange=Date.parse(changedSince);
    await recoverMessages(sequence.current,async cursor=>{
     const {data,error}=await supabase!.from('messages').select('*').eq('room_id',room).gt('sequence',cursor).order('sequence').limit(100).abortSignal(AbortSignal.timeout(15000));
     if(error)throw error;return data as ChatMessage[];
    },(rows,cursor)=>{outbox.reconcile(rows);setMessages(old=>mergeMessages(old,rows));sequence.current=cursor},()=>stopped);
    for(let from=0;;from+=100){const updates=await supabase!.from('messages').select('*').eq('room_id',room).gte('updated_at',changedSince).order('updated_at').order('id').range(from,from+99).abortSignal(AbortSignal.timeout(15000));if(updates.error)throw updates.error;if(stopped)return;if(updates.data.length){newestChange=Math.max(newestChange,...updates.data.map(m=>Date.parse(m.updated_at)));setMessages(old=>mergeMessages(old,updates.data as ChatMessage[]));}if(updates.data.length<100)break}changedSince=new Date(Math.max(0,newestChange-60000)).toISOString();
    if(stopped)return;
   setConnection(realtime?'실시간 연결됨':'연결됨 · 주기적으로 대화 확인 중');
   }catch{if(!stopped)setConnection(navigator.onLine?'연결 재시도 중 · 대화를 불러오지 못했습니다':'오프라인 · 연결을 기다리는 중')}finally{syncing=false;if(queued&&!stopped){queued=false;void sync()}}
  }
  syncRef.current=()=>void sync();
  setConnection('연결 중');
  const channel=supabase!.channel('room:'+room+':'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'room_id=eq.'+room},()=>{void sync()}).subscribe(status=>{
   if(stopped)return;
   realtime=status==='SUBSCRIBED';setConnection(!navigator.onLine?'오프라인 · 연결을 기다리는 중':realtime?'실시간 연결됨':'실시간 연결 복구 중');
   if(status==='SUBSCRIBED')void sync();
  });
  void sync();const timer=setInterval(()=>void sync(),5000);
  const resume=()=>{if(document.visibilityState==='visible'){changedSince='1970-01-01T00:00:00.000Z';setConnection('대화 복구 중');void sync();void refreshRooms()}};const offline=()=>setConnection('오프라인 · 연결을 기다리는 중');window.addEventListener('online',resume);window.addEventListener('offline',offline);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',resume);window.removeEventListener('offline',offline);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);void supabase!.removeChannel(channel)};
 },[room,historyStart]);
 async function openChat(name:string){setError('');
  const {data,error}=await supabase!.rpc('open_direct_chat',{p_username:name});if(error){setError(error.message);return}await refreshRooms();selectRoom(data);
 }
 async function retry(key:string){
  if(deliveryLock.current)return;deliveryLock.current=true;setDelivering(true);cancelled.current.delete(key);
  const saved=await outbox.send(key,async item=>{
   if(item.replyTo){const context=await supabase!.rpc('prepare_message_reply',{p_key:item.key,p_room:item.room,p_reply:item.replyTo});if(context.error)throw context.error;}
   if(item.attachment)return deliverAttachment(item.attachment,uploadFiles.current.get(item.key),stage=>setUploadStages(v=>({...v,[item.key]:stage})),()=>cancelled.current.has(item.key));
   if(!navigator.onLine)throw new Error('인터넷 연결이 없습니다. 연결 후 재전송해 주세요.');
   const {data,error}=await supabase!.rpc('send_message',{p_room:item.room,p_body:item.body,p_key:item.key}).abortSignal(AbortSignal.timeout(15000));
   if(error)throw new Error(error.message.includes('Abort')?'응답 시간이 초과되었습니다. 재전송해도 중복 저장되지 않습니다.':error.message);
   return data as ChatMessage;
  });
  deliveryLock.current=false;setDelivering(false);
  if(saved){uploadFiles.current.delete(key);void refreshRooms()}
  if(saved&&activeRoom.current===saved.room_id)setMessages(old=>mergeMessages(old,[saved]));
 }
 async function send(event:FormEvent){event.preventDefault();if((!body.trim()&&!selected.length)||sendLock.current||deliveryLock.current||!room)return;
  sendLock.current=true;setBusy(true);const target=room,files=[...selected],text=body.trim();setError('');
  try{
   const queue=[];if(text)queue.push(outbox.enqueue(target,text,undefined,reply?.id));
   for(const file of files){validateFile(file);const id=crypto.randomUUID();const attachment:Attachment={id,room_id:target,sender_id:session.user.id,name:fileName(file.name),size:file.size,mime:await fileMime(file),path:session.user.id+'/'+id};uploadFiles.current.set(id,file);queue.push(outbox.enqueue(target,attachment.name,attachment,reply?.id));}
   pendingFiles.current.delete(target);try{localStorage.removeItem(draftKey(target))}catch{}if(activeRoom.current===target){setBody('');setSelected([]);setReply(null)}
   for(const item of queue){if(cancelled.current.has(item.key)){outbox.remove(item.key);continue}await retry(item.key)}
  }catch(e){setError((e as Error).message)}finally{sendLock.current=false;setBusy(false)}
 }
 async function toggleMute(){const target=room;const current=rooms.find(x=>x.id===target);if(!current||muteBusy)return;setMuteBusy(true);try{const {error}=await supabase!.rpc('set_room_muted',{p_room:target,p_muted:!current.muted}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;await refreshRooms()}catch{setError('알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.')}finally{setMuteBusy(false)}}
 function chooseFiles(files:File[]){try{files.forEach(validateFile);if(selected.length+files.length>10)throw Error('한 번에 최대 10개까지 선택해 주세요. 파일 전송은 시간당 20개로 제한됩니다.');const next=[...selected,...files];setSelected(next);pendingFiles.current.set(room,next);setError('')}catch(err){setError((err as Error).message)}}
 function dropFile(event:React.DragEvent){if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();setDragging(false);if(!room||busy)return;chooseFiles(Array.from(event.dataTransfer.files));}
 const knownRooms=useRef<string[]>([]);
 useEffect(()=>{if(room&&knownRooms.current.includes(room)&&!rooms.some(x=>x.id===room)){setRoom('');setMessages([]);setGroupDialog(null);onBack()}knownRooms.current=rooms.map(x=>x.id)},[rooms]);
 const activeConversation=rooms.find(x=>x.id===room);const peer=activeConversation?.peer;
 const isGroup=!!activeConversation?.direct_key.startsWith('group:');
 const groupState=useGroupState(room,isGroup);
 
 const spaces=rooms.map(r=>({id:r.id,name:r.peer?.display_name??'대화',owner_id:''}));
 const roomTools=useRoomTools(room);
 useEffect(()=>{setComposerTools(null);setSpaceTab('chat')},[room]);
 const [friendsOpen,setFriendsOpen]=useState(false);
 function onSection(next:Section){if(next==='friends'){setFriendsOpen(true);onSectionRoot('chats');onBack()}else{if(next==='chats')setFriendsOpen(false);onSectionRoot(next)}}
 useEffect(()=>{if(section==='friends'){setFriendsOpen(true);onSectionRoot('chats')}},[section]);
 const [settingsOpen,setSettingsOpen]=useState(false);
 useEffect(()=>{const show=()=>setSettingsOpen(true);window.addEventListener('mycel-settings',show);return()=>window.removeEventListener('mycel-settings',show)},[]);
 const [refreshing,setRefreshing]=useState(false);
 async function manualRefresh(){setRefreshing(true);try{await refreshRooms()}finally{setRefreshing(false)}}
 useEffect(()=>{document.title=peer?peer.display_name+' · Mycel':'Mycel'},[peer?.display_name]);
 function jump(message:ChatMessage){if(flags[message.id]?.hidden){setError('내 목록에서 숨긴 메시지입니다.');return}setImportant(false);setMessages(old=>mergeMessages(old,[message]));setJumpId(message.id);setDrawer(false);setAction(null)}
 return <>{layout==='phone'&&section==='chats'&&!conversationVisible&&room&&<button className="chat-sidebar-backdrop" aria-label="대화 탐색 닫기" onClick={onOpen}/>}<ShareInbox userId={session.user.id} rooms={rooms} onSent={id=>{selectRoom(id);void refreshRooms()}}/>
 {section==='me'&&<PersonalWorkspace userId={session.user.id} spaces={spaces} onSelf={()=>{onSection('chats');void openSelf()}}/>}
 <aside className="list chat-list" hidden={section==='me'||collapsed&&section==='chats'}><div className="conversation-nav-tabs"><button aria-pressed={!friendsOpen} onClick={()=>setFriendsOpen(false)}>대화</button><button aria-pressed={friendsOpen} onClick={()=>setFriendsOpen(true)}>친구</button></div>
 <div hidden={section!=='chats'||friendsOpen} className="chat-list-content"><header className="list-title section-heading"><div><h1>대화</h1><small className="list-caption">나의 대화 공간</small></div><div className="list-header-actions"><button disabled={refreshing} onClick={()=>void manualRefresh()} aria-label="대화 목록 새로고침" title="대화 목록 새로고침"><Icon name="refresh"/></button><button onClick={()=>setGroupDialog('new')} aria-label="새 그룹 대화" title="새 그룹 대화"><Icon name="friends"/></button><button onClick={()=>onSection('friends')} aria-label="새 대화"><Icon name="plus"/></button></div></header><SearchInput onClear={()=>setFilter('')} className="room-search" aria-label="대화 목록 검색" placeholder="이름 또는 최근 메시지 검색" value={filter} onChange={e=>setFilter(e.target.value)}/><div className="filter-tabs"><button aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>전체</button><button aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>안 읽음</button></div><p className="notice" role="status">{roomsError}</p><ExpiringFiles onOpen={id=>selectRoom(id)}/><div className="room-list">{!rooms.some(x=>x.direct_key==='self:'+session.user.id)&&!unreadOnly&&'나와의 대화'.includes(filter)&&<button className="room-item self-chat-entry" disabled={selfBusy} onClick={()=>void openSelf()}><span className="room-avatar">나</span><span className="room-copy"><strong>나와의 대화</strong><span className="conversation-preview">나만 볼 수 있는 메모와 파일</span></span></button>}{[...rooms].sort((a,b)=>Number(b.direct_key.startsWith('self:'))-Number(a.direct_key.startsWith('self:'))||Number(pins.includes(b.id))-Number(pins.includes(a.id))).filter(x=>(!unreadOnly||Number(activity[x.id]?.unread_count)>0)&&((x.peer?.display_name??'')+' '+(x.peer?.username??'')+' '+(x.last_body??'')).toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(item=><div className="room-row" key={item.id}><button className="room-item" aria-current={room===item.id?'page':undefined} onClick={()=>selectRoom(item.id)}><span className="room-avatar" aria-hidden="true">{(item.peer?.display_name??'?').slice(0,1)}</span><span className="room-copy"><strong>{item.peer?.display_name??'대화 상대'}{item.direct_key.startsWith('group:')&&' · '+(item.peer?.member_count??'')+'명'}</strong><span className="conversation-preview">{item.last_body??'아직 메시지가 없습니다.'}</span></span><span className="room-meta"><time>{conversationTime(item.last_at)}</time>{Number(activity[item.id]?.unread_count)>0&&<b className="unread-badge" aria-label={'안 읽은 메시지 '+activity[item.id].unread_count+'개'}>{Math.min(99,Number(activity[item.id].unread_count))}{Number(activity[item.id].unread_count)>99?'+':''}</b>}{!item.direct_key.startsWith('self:')&&item.muted&&<small>알림 꺼짐</small>}</span></button>{!item.direct_key.startsWith('self:')&&<button className="pin-room" aria-label={pins.includes(item.id)?'대화 고정 해제':'대화 상단 고정'} aria-pressed={pins.includes(item.id)} onClick={()=>setPins(old=>old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id])}><Icon name="pin" size={14}/></button>}</div>)}</div>{!rooms.length&&<p className="empty-hint">아직 대화가 없습니다. + 버튼으로 친구와 대화를 시작하세요.</p>}</div>
 <div hidden={!friendsOpen}><FriendsPanel onChat={openChat} onRequests={onRequests}/></div>
 {composerTools&&room&&<ComposerTools key={room} kind={composerTools} room={room} scheduled={roomTools.scheduled} onClose={()=>setComposerTools(null)} onKind={setComposerTools} onFiles={()=>{setComposerTools(null);fileInput.current?.click()}}/>}{groupDialog&&<GroupDialog spaceMode={false} room={groupDialog==='manage'?room:undefined} sourceRoom={groupDialog==='from-direct'?room:undefined} existingPeer={groupDialog==='from-direct'&&peer?peer:undefined} name={groupDialog==='manage'?peer?.display_name:groupDialog==='from-direct'?(peer?.display_name??'친구')+' 그룹':undefined} members={groupDialog==='manage'?groupState.members:[]} userId={session.user.id} onClose={()=>setGroupDialog(null)} onChanged={()=>void refreshRooms()} onCreated={id=>{onSection('chats');selectRoom(id)}} onLeft={()=>{setRoom('');setMessages([]);onBack()}}/>}{confirmation}
 </aside>
 <SettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)}><div className="settings-panel"><header className="section-heading"><div><h1>설정</h1><p>내 프로필과 사용 환경을 관리하세요.</p></div></header><ProfileSettings session={session}/><section><h2>AI 연결</h2><p>내 API 또는 이 기기의 Ollama를 연결합니다.</p><button onClick={()=>{setSettingsOpen(false);openAI({settings:true})}}>내 AI 연결 관리</button></section><section><h2>화면과 입력</h2><label>테마 <select value={theme} onChange={e=>onTheme(e.target.value as typeof theme)}><option value="light">라이트</option><option value="dark">다크</option><option value="system">시스템</option></select></label><div className="settings-display-row"><label htmlFor="layout-mode">화면 모드</label><select id="layout-mode" value={layoutPreference} onChange={e=>onLayoutPreference(e.target.value as LayoutPreference)}><option value="auto">자동</option><option value="desktop">데스크톱</option><option value="tablet">태블릿</option><option value="phone">휴대폰</option></select></div><div className="settings-display-row"><span>글자 크기</span><FontSizeControl/></div><p className="muted">글자 크기는 1%씩 조절할 수 있으며, 앱·기기를 다시 시작해도 유지됩니다.</p><label><input type="checkbox" checked={enterSend} onChange={e=>setEnterSend(e.target.checked)}/> 데스크톱 Enter 전송 (Shift+Enter 줄바꿈)</label><div><InstallButton/></div><p className="muted">대화 고정·초안·화면 설정은 이 브라우저에 저장됩니다.</p></section></div>
 <div><PushSettings userId={session.user.id} room={room} conversationVisible={conversationVisible}/><p>대화별 알림은 대화 오른쪽 위 더보기에서 변경합니다. 차단 관리는 친구 화면에 있습니다.</p><button className="text-button" onClick={()=>{setSettingsOpen(false);onSection('friends')}}>차단 관리 열기</button><button className="text-button" onClick={async()=>{try{await disablePush();const {error}=await supabase!.auth.signOut();if(error)setError(error.message)}catch{setError('로그아웃하지 못했습니다. 다시 시도해 주세요.')}}}>로그아웃</button></div></SettingsDialog>
 <div className="list-resizer" role="separator" aria-label="대화 목록 너비 조절" aria-orientation="vertical" title="드래그 또는 방향키로 너비 조절" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const list=e.currentTarget.previousElementSibling as HTMLElement;resizeList(e.currentTarget,list.getBoundingClientRect().width+(e.key==='ArrowLeft'?-10:10))}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();const list=e.currentTarget.previousElementSibling as HTMLElement;resizeDrag.current={x:e.clientX,width:list.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(resizeDrag.current&&e.currentTarget.hasPointerCapture(e.pointerId))resizeList(e.currentTarget,resizeDrag.current.width+e.clientX-resizeDrag.current.x)}} onPointerUp={e=>{resizeDrag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{resizeDrag.current=null}} onLostPointerCapture={()=>{resizeDrag.current=null}}/>
 <main hidden={section==='me'} data-room-tab={room?spaceTab:'chat'} className={'chat-main'+(dragging?' file-dragging':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=room&&!busy?'copy':'none';setDragging(Boolean(room&&!busy))}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragging(false)}} onDrop={dropFile}>
 {isGroup&&groupState.history_proposal&&['pending','approved'].includes(groupState.history_proposal.status)&&<button className="group-vote-banner" onClick={()=>setGroupDialog('manage')}>이전 기록 공개 초대 · 동의 {groupState.history_proposal.agreed}/{groupState.history_proposal.total}명 · 확인하기</button>}<header className="topbar"><button className="back" onClick={back} aria-label="대화 목록으로"><Icon name="back"/></button><button className="collapse-list" aria-label={collapsed?'대화 목록 펼치기':'대화 목록 접기'} onClick={()=>{setCollapsed(!collapsed);document.querySelector('.app')?.classList.toggle('list-collapsed',!collapsed)}}><Icon name="panel"/></button>{peer&&<span className="peer-avatar" aria-hidden="true">{peer.display_name.slice(0,1)}</span>}<strong className="peer-name">{peer?.display_name??(room?'대화 상대 확인 중':'대화를 선택하세요')}{isGroup&&' · '+(groupState.mode==='team'?'팀채팅':'그룹')+' ('+(peer?.member_count??groupState.members.length)+')'}</strong>{room&&<><button aria-label="대화를 AI로 정리" onClick={()=>openAI({label:"현재 불러온 대화의 최근 100개 메시지",text:visibleMessages.filter(m=>!m.deleted_at&&!m.attachment_id).slice(-100).map(m=>m.created_at+" · "+m.body).join("\n")})}>AI</button><button aria-label="대화 내용 검색" aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><Icon name="search"/></button><button aria-label="대화 더보기" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><Icon name="more"/></button></>}</header>
 {room&&section==='chats'&&<div className="conversation-resource-tabs" role="tablist" aria-label="대화 자료">{(['chat','event','note'] as const).map(t=><button key={t} role="tab" aria-selected={spaceTab===t} onClick={()=>setSpaceTab(t)}>{t==='chat'?'채팅':t==='event'?'일정':'페이지'}</button>)}</div>}
 {room&&spaceTab!=='chat'&&section==='chats'&&<div className="conversation-resource-library"><Library key={room+spaceTab} kind={spaceTab} space={room} spaces={spaces} userId={session.user.id}/></div>}
 {menu&&<section className="conversation-menu" aria-label="대화 더보기">{!isSelf&&!isGroup&&<button onClick={()=>{setGroupDialog('from-direct');setMenu(false)}}>사람 추가 · 새 그룹 만들기</button>}{isGroup&&<button onClick={()=>{setGroupDialog('manage');setMenu(false)}}>참여자 · 초대 · 그룹 관리</button>}<button onClick={()=>{setBoard({});setMenu(false)}}>게시판 · 공지</button><button onClick={()=>{setImportant(v=>!v);setMenu(false)}}>{important?'전체 메시지 보기':'중요 메시지 모아보기'}</button><button onClick={()=>{setDrawer(true);setMenu(false)}}>사진·파일·링크 모아보기</button>{!isSelf&&<button disabled={muteBusy} onClick={()=>void toggleMute()}>{rooms.find(x=>x.id===room)?.muted?'이 대화 알림 켜기':'이 대화 알림 끄기'}</button>}<button onClick={popup}>별도 창에서 대화</button>{!isSelf&&!isGroup&&<button className="danger" onClick={async()=>{if(!peer||!await confirmBlock(peer.display_name))return;const {data,error}=await supabase!.rpc('set_user_block',{p_peer:peer.id,p_block:true});setError(error?.message??data?.error??'차단했습니다. 이전 대화는 보존됩니다.');setMenu(false)}}>상대 차단</button>}<button onClick={()=>setMenu(false)}>닫기</button></section>}
 {isGroup&&groupState.proposal?.status==='pending'&&<div className="notice-banner"><button onClick={()=>setGroupDialog('manage')}>방 종류 변경 투표 · 동의 {groupState.proposal.agreed}/{groupState.proposal.total}명 · 확인하기</button></div>}
 {action&&<MessageActions key={action.message.id} message={messages.find(m=>m.id===action.message.id)??action.message} userId={session.user.id} isSelf={isSelf} canNotice={!isGroup||groupState.mode==='regular'||groupState.owner_id===session.user.id||groupState.roles[session.user.id]==='admin'} rooms={rooms} starred={!!flags[action.message.id]?.starred} position={action} onReply={m=>{setReply(m);textarea.current?.focus()}} onPost={(m,notice)=>setBoard({message:m,notice})} onChanged={changed} onClose={()=>setAction(null)}/>}
 {board&&<Board canNotice={!isGroup||groupState.mode==='regular'||groupState.owner_id===session.user.id||groupState.roles[session.user.id]==='admin'} key={room} room={room} userId={session.user.id} posts={posts} messages={messages.filter(m=>!flags[m.id]?.hidden)} initial={board} onClose={()=>setBoard(null)} onChanged={changed}/>}
 {posts.some(p=>p.notice&&!p.deleted_at)&&<div className="notice-banner"><button onClick={()=>setBoard({postId:posts.find(p=>p.notice&&!p.deleted_at)?.id})}>{noticeClosed?'📌 공지 보기':'📌 '+posts.find(p=>p.notice&&!p.deleted_at)?.title}</button><button onClick={()=>setBoard({})}>전체</button><button aria-label={noticeClosed?'공지 펼치기':'공지 접기'} onClick={()=>setNoticeClosed(v=>!v)}>{noticeClosed?'⌄':'×'}</button></div>}
 {important&&<div className="notice-banner">★ 중요 메시지<button onClick={()=>setImportant(false)}>전체 보기</button></div>}
 {(flagsError||postsError)&&<p className="notice" role="status">{flagsError||postsError}</p>}
 {isSelf&&<p className="self-chat-note">나만 볼 수 있는 메모와 파일 · 같은 계정의 기기에 동기화됩니다.<br/>파일당 300MB · 원본은 30일 후 삭제됩니다.</p>}
 {connection!=='실시간 연결됨'&&room&&<div className="connection-strip" role="status">{connection}</div>}
 {searchOpen&&room&&<MessageSearch key={room} room={room} onSelect={jump}/>}{drawer&&room&&<RoomDrawer key={room} room={room} messages={visibleMessages} onJump={jump} onClose={()=>setDrawer(false)}/>}
 {jumpId&&<button className="latest-message" onClick={()=>{setAtBottom(true);setJumpId('');if(messageList.current)messageList.current.scrollTop=messageList.current.scrollHeight}}>최근 메시지로 돌아가기 ↓</button>}{dragging&&<p className="drop-hint">사진·파일을 놓아 첨부하세요. 전송 버튼을 누르면 보냅니다.</p>}
 <div ref={messageList} className="message-list" aria-label="대화 메시지" aria-live="polite" onScroll={e=>{const el=e.currentTarget;const bottom=el.scrollHeight-el.scrollTop-el.clientHeight<100;stickToBottom.current=bottom;setAtBottom(bottom)}}>{!room&&<div className="empty-hint"><h2>우리의 대화를 이어가세요</h2><p>왼쪽 목록에서 대화를 선택하거나 새 대화를 시작하세요.</p><button onClick={()=>onSection('friends')}>친구 찾기</button></div>}{visibleMessages.map((message,index)=><Fragment key={message.id}>{(!visibleMessages[index-1]||dayLabel(visibleMessages[index-1].created_at)!==dayLabel(message.created_at))&&<div className="date-separator">{dayLabel(message.created_at)}</div>}<MessageGesture message={message} onMenu={showActions} className={(message.sender_id===session.user.id?'message mine':'message')+(grouped(visibleMessages[index-1],message)?' grouped':'')+(jumpId===message.id?' search-highlight':'')}><div className={'message-bubble'+(message.attachment_id?' attachment-bubble':'')}>{isGroup&&message.sender_id!==session.user.id&&!grouped(visibleMessages[index-1],message)&&<small className="group-sender">{groupState.authors[message.sender_id]??groupState.members.find(m=>m.id===message.sender_id)?.display_name??'참여자'}</small>}{message.reply_to&&!message.deleted_at&&<ReplyQuote id={message.reply_to} messages={messages} onJump={jump}/>} {message.forwarded&&!message.deleted_at&&<small className="forwarded-label">전달된 메시지</small>}{message.deleted_at?<p className="deleted-message">삭제된 메시지입니다.</p>:message.attachment_id?<AttachmentMessage id={message.attachment_id}/>:message.post_id?<button className="post-message-link" onClick={()=>setBoard({postId:message.post_id!})}>{message.body} ↗</button>:roomTools.polls.some(p=>p.message_id===message.id)?<PollCard poll={roomTools.polls.find(p=>p.message_id===message.id)!} userId={session.user.id} manager={isGroup&&groupState.mode==='team'&&(groupState.owner_id===session.user.id||groupState.roles[session.user.id]==='admin')}/>:<MessageText id={message.id} body={message.body}/>}</div><div className="message-meta">{flags[message.id]?.starred&&<small aria-label="중요 메시지">★</small>}{message.edited_at&&!message.deleted_at&&<small>수정됨</small>}{!message.deleted_at&&!isSelf&&(isGroup?unreadPeople(groupState.members,message.sender_id,message.sequence)>0:message.sender_id===session.user.id&&activity[room]&&Number(activity[room].peer_read_sequence)<message.sequence)&&<small className="unread-people" aria-label={"안 읽은 사람 "+(isGroup?unreadPeople(groupState.members,message.sender_id,message.sequence):1)+"명"}>{isGroup?unreadPeople(groupState.members,message.sender_id,message.sequence):1}</small>}<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time></div></MessageGesture></Fragment>)}{outbox.items.filter(item=>item.room===room).map(item=>{const percent=Number(uploadStages[item.key]?.match(/(\d+)%/)?.[1]??0);return <article key={item.key} className="message mine outgoing"><p>{item.body}</p><small role="status">{item.status==='sending'?(uploadStages[item.key]??'전송 대기 중…'):'전송 실패 · '+item.error}</small>{item.attachment&&item.status==='sending'&&<><progress value={percent} max={100} aria-label="파일 전송 진행률"/><button disabled={uploadStages[item.key]?.includes('검증')||cancelled.current.has(item.key)} onClick={()=>{cancelled.current.add(item.key);setOutboxVersion(v=>v+1)}}>{cancelled.current.has(item.key)?'현재 조각 완료 후 취소':'전송 취소'}</button></>}{item.status==='failed'&&item.attachment&&!uploadFiles.current.has(item.key)&&<label className="reselect-file">원본 다시 선택<input type="file" onChange={e=>{const file=e.target.files?.[0];if(!file)return;try{validateFile(file);if(fileName(file.name)!==item.attachment!.name||file.size!==item.attachment!.size)throw Error('같은 원본 파일을 선택해 주세요.');uploadFiles.current.set(item.key,file);setOutboxVersion(v=>v+1)}catch(err){setError((err as Error).message)}}}/></label>}{item.status==='failed'&&<><button className="retry-button" disabled={busy||delivering} onClick={()=>void retry(item.key)}>재전송</button><button disabled={delivering} onClick={async()=>{try{if(item.attachment)await cancelPendingUpload(item.attachment);outbox.remove(item.key)}catch(e){setError((e as Error).message)}}}>취소·목록에서 제거</button></>}</article>})}</div>
 {!atBottom&&room&&<button className="latest-message" onClick={()=>{if(messageList.current)messageList.current.scrollTop=messageList.current.scrollHeight;setAtBottom(true);setJumpId('')}}>새 메시지 · 맨 아래로 ↓</button>}
 {readError&&<p className="notice" role="status">{readError}</p>}{error&&<p className="notice" role="alert">{error}</p>}{selected.length>0&&<SelectedFiles files={selected} onRemove={i=>{const next=selected.filter((_,n)=>n!==i);setSelected(next);pendingFiles.current.set(room,next)}}/>}
 {reply&&<div className="reply-compose"><span>답장: {reply.body.slice(0,100)}</span><button aria-label="답장 취소" onClick={()=>setReply(null)}>×</button></div>}
 <form className="composer" onSubmit={send}><input ref={fileInput} className="sr-only" type="file" multiple aria-label="사진 또는 파일 선택" onChange={e=>{chooseFiles(Array.from(e.target.files??[]));e.target.value=''}}/><button type="button" className="attach-button" disabled={!room||busy} title="사진·파일, 공개투표, 예약메시지" aria-label="대화에 추가" onClick={()=>setComposerTools('menu')}><Icon name="plus"/></button><textarea ref={textarea} id="message" aria-label="메시지" value={body} onChange={e=>writeBody(e.target.value)} maxLength={4000} disabled={!room} placeholder="메시지 입력" rows={1} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();chooseFiles(files)}}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&layout==='desktop'&&enterSend){e.preventDefault();if(!busy)e.currentTarget.form?.requestSubmit()}}}/><button className="primary-button" disabled={!room||(!body.trim()&&!selected.length)||busy||delivering}><span>전송</span><Icon name="send" size={16}/></button></form>{selected.length>0&&<small className="attachment-policy">파일당 300MB · 새 파일 30일 보관 · 순서대로 전송</small>}
 </main></>;
}

