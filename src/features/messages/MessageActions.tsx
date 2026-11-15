import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
import {ActionDialog} from './ActionDialog';
import {SearchInput} from '../../components/SearchInput';
import {AttachmentMessage} from './AttachmentMessage';
import {downloadAttachment} from './r2';
import {prepareDownload,fileSize,type Attachment} from './attachments';
import type {ChatMessage} from './model';
import type {Conversation} from './useConversations';
export function MessageActions({message,userId,isSelf,rooms,starred,position,onReply,onPost,onChanged,onClose}:{message:ChatMessage;userId:string;isSelf:boolean;rooms:Conversation[];starred:boolean;position:{x:number;y:number};onReply:(m:ChatMessage)=>void;onPost:(m:ChatMessage,notice:boolean)=>void;onChanged:()=>void;onClose:()=>void}){
 const [mode,setMode]=useState('menu'),[edit,setEdit]=useState(message.body),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attachment,setAttachment]=useState<Attachment|null>(null);const forwardKeys=useRef(new Map<string,string>());
 useEffect(()=>{let stop=false;if(message.attachment_id)void supabase!.from('chat_attachments').select('*').eq('id',message.attachment_id).single().then(({data,error})=>{if(!stop){setAttachment(data);if(error)setError('파일 정보를 확인하지 못했습니다.')}});return()=>{stop=true}},[message.id]);
 const own=message.sender_id===userId,canEdit=own&&!message.deleted_at&&(isSelf||Date.now()-Date.parse(message.created_at)<86400000),expired=!!attachment&&(!!attachment.original_deleted_at||!!attachment.expires_at&&Date.parse(attachment.expires_at)<=Date.now());
 async function run(action:()=>Promise<void>,close=true){if(busy)return;setBusy(true);setError('');try{await action();onChanged();if(close)onClose()}catch(e){setError((e as Error).message||'처리하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 async function rpc(name:string,args:Record<string,unknown>){const r=await supabase!.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(r.error)throw r.error;return r.data}
 async function flag(kind:string,value:boolean){await rpc('set_message_flag',{p_id:message.id,p_kind:kind,p_value:value});window.dispatchEvent(new Event('weano-message-flags'))}
 async function forward(room:string){let key=forwardKeys.current.get(room);if(!key){key=crypto.randomUUID();forwardKeys.current.set(room,key)}await rpc('forward_message',{p_id:message.id,p_room:room,p_key:key})}
 async function save(){if(!attachment)throw Error('파일 정보 확인 중입니다.');const file=await prepareDownload(await downloadAttachment(attachment),attachment);const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 const available=!message.deleted_at&&!expired&&(!message.attachment_id||!!attachment);
 return <ActionDialog title={mode==='menu'?'메시지':mode==='forward'?'전달할 대화 선택':mode==='edit'?'메시지 수정':mode==='delete'?'메시지 삭제':mode==='view'?'사진·파일':'메시지 정보'} position={mode==='menu'?position:undefined} onClose={onClose}>
 {mode==='menu'&&<div className="action-list">
 {!message.deleted_at&&<><button disabled={busy} onClick={()=>{onReply(message);onClose()}}>답장</button><button disabled={busy} onClick={()=>void run(async()=>{try{await navigator.clipboard.writeText(attachment?.name??message.body)}catch{setMode('copy');throw Error('아래 글을 선택해 복사해 주세요.')}})}>{message.attachment_id?'파일명 복사':'복사'}</button>{!message.attachment_id&&<button onClick={()=>setMode('copy')}>텍스트 선택</button>}
 {message.attachment_id&&<><button onClick={()=>setMode('view')}>사진·파일 보기</button><button disabled={busy||!available} onClick={()=>void run(save)}>다운로드{expired?' · 만료':''}</button></>}
 <button disabled={busy||!available} onClick={()=>setMode('forward')}>다른 대화로 전달</button>{!isSelf&&<button disabled={busy||!available} onClick={()=>void run(async()=>{const room=await rpc('open_self_chat',{});await forward(room)})}>나와의 대화로 보내기</button>}
 <button disabled={busy} onClick={()=>void run(()=>flag('starred',!starred))}>{starred?'중요 표시 해제':'중요 표시'}</button>
 <button disabled={busy||!available} onClick={()=>{onPost(message,true);onClose()}}>공지로 등록</button><button disabled={busy||!available} onClick={()=>{onPost(message,false);onClose()}}>게시글로 작성</button>
 {canEdit&&!message.attachment_id&&!message.post_id&&<button onClick={()=>setMode('edit')}>수정</button>}</>}
 <button onClick={()=>setMode('info')}>상세 정보</button><button className="danger" onClick={()=>setMode('delete')}>삭제·숨기기</button></div>}
 {mode==='copy'&&<textarea className="selectable-text" readOnly value={attachment?.name??message.body} onFocus={e=>e.target.select()} autoFocus aria-label="복사할 내용"/>}
 {mode==='edit'&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await rpc('edit_message',{p_id:message.id,p_body:edit,p_expected:message.updated_at})})}}><textarea autoFocus maxLength={4000} value={edit} onChange={e=>setEdit(e.target.value)} aria-label="수정할 메시지"/><button className="primary-button" disabled={busy||!edit.trim()}>수정 저장</button></form>}
 {mode==='delete'&&<div className="action-list"><p>숨기기는 내 계정의 모든 기기에 적용됩니다. 상대방의 대화는 유지됩니다.</p><button disabled={busy} onClick={()=>void run(()=>flag('hidden',true))}>내 목록에서 숨기기</button>{canEdit&&<><p>모두에게서 삭제하면 원래 위치에 삭제 안내가 남습니다. 이미 다운로드한 파일은 회수되지 않습니다.</p><button className="danger" disabled={busy} onClick={()=>void run(async()=>{await rpc('delete_message',{p_id:message.id})})}>{isSelf?'내 메모 삭제':'모두에게서 삭제'}</button></>}<button onClick={onClose}>취소</button></div>}
 {mode==='forward'&&<><SearchInput aria-label="전달할 대화 검색" placeholder="대화 이름 검색" value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')}/><p className="muted">파일을 전달해도 원래 만료일은 유지됩니다.</p><div className="action-list">{rooms.filter(r=>(r.peer?.display_name??'').includes(query)).map(r=><button disabled={busy} key={r.id} onClick={()=>void run(()=>forward(r.id))}>{r.peer?.display_name??'대화'}</button>)}</div></>}
 {mode==='view'&&message.attachment_id&&<AttachmentMessage id={message.attachment_id}/>}
 {mode==='info'&&<div className="message-info"><p>전송: {new Date(message.created_at).toLocaleString('ko-KR')}</p>{message.edited_at&&<p>수정: {new Date(message.edited_at).toLocaleString('ko-KR')}</p>}{attachment&&<><p>{attachment.name} · {fileSize(attachment.size)}</p><p>만료: {attachment.expires_at?new Date(attachment.expires_at).toLocaleString('ko-KR'):'제한 없음'}</p></>}</div>}
 {busy&&<p role="status">처리 중…</p>}{error&&<p role="alert">{error}</p>}
 </ActionDialog>
}
