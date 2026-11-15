import {useEffect,useRef,useState} from 'react';
import {ActionDialog} from '../messages/ActionDialog';
import {SearchInput} from '../../components/SearchInput';
import {supabase} from '../../services/supabase';
import {deliverAttachment,fileName,fileMime,fileSize,validateFile} from '../messages/attachments';
import type {Conversation} from '../messages/useConversations';
import {shareStore,type SharedItem} from './share';
function Preview({file}:{file:File}){const [url,setUrl]=useState('');useEffect(()=>{if(!file.type.startsWith('image/'))return;const u=URL.createObjectURL(file);setUrl(u);return()=>URL.revokeObjectURL(u)},[file]);return <div className="shared-file">{url&&<img src={url} alt="공유받은 사진"/>}<span>{file.name}<small>{fileSize(file.size)}</small></span></div>}
export function ShareInbox({userId,rooms,onSent}:{userId:string;rooms:Conversation[];onSent:(room:string)=>void}){
 const [job,setJob]=useState<SharedItem|null>(null),[text,setText]=useState(''),[room,setRoom]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stage,setStage]=useState(''),[discard,setDiscard]=useState(false);const lock=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;const load=()=>{if(lock.current)return;void shareStore.list().then(rows=>{if(!live.current)return;const next=rows.find(j=>!j.owner||j.owner===userId)??null;setJob(old=>{if(old?.id===next?.id)return old;setText(next?.text??'');setRoom(next?.room??'');setDiscard(false);return next})}).catch(()=>{if(live.current)setError('공유 임시 저장소에 접근하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')})};load();window.addEventListener('focus',load);return()=>{live.current=false;window.removeEventListener('focus',load)}},[userId]);
 async function finish(){if(!job)return;await shareStore.remove(job.id);setJob(null);setError('');const url=new URL(location.href);url.searchParams.delete('share');url.searchParams.delete('shareError');history.replaceState(history.state,'',url.pathname+url.search);window.dispatchEvent(new Event('focus'))}
 async function send(){if(!job||lock.current||!room)return;lock.current=true;setBusy(true);setError('');try{
  const item=await shareStore.claim(job.id,userId,room,text.trim());if(!live.current)return;setJob(item);setText(item.text);setRoom(item.room!);
  const auth=await supabase!.auth.getSession();if(auth.data.session?.user.id!==userId)throw Error('로그인 계정이 변경되었습니다. 다시 확인해 주세요.');
  if(item.text&&!item.done.includes(0)){setStage('텍스트 전송 중…');const r=await supabase!.rpc('send_message',{p_room:room,p_body:item.text,p_key:item.keys[0]}).abortSignal(AbortSignal.timeout(15000));if(r.error)throw r.error;await shareStore.mark(item.id,0)}
  for(let i=0;i<item.files.length;i++){if(item.done.includes(i+1))continue;if(!live.current)throw Error('전송이 중단되었습니다. 다시 열어 재전송해 주세요.');const file=item.files[i];validateFile(file);const id=item.keys[i+1];await deliverAttachment({id,room_id:room,sender_id:userId,name:fileName(file.name),size:file.size,mime:await fileMime(file),path:userId+'/'+id},file,s=>{if(live.current)setStage((i+1)+' / '+item.files.length+' · '+s)},()=>!live.current);await shareStore.mark(item.id,i+1)}
  await finish();onSent(room);
 }catch(e){if(live.current)setError((e as Error).message||'전송하지 못했습니다. 같은 대화로 재전송할 수 있습니다.')}finally{lock.current=false;if(live.current){setBusy(false);setStage('');window.dispatchEvent(new Event('focus'))}}}
 if(!job)return error?<div className="share-status" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>:null;
 return <ActionDialog title="공유받은 내용 보내기" onClose={()=>{if(!busy)setDiscard(true)}}><p className="muted">현재 계정으로 전송합니다. 전송을 누르기 전에는 파일을 업로드하지 않습니다.</p>
 {discard?<><p>공유받은 내용을 취소할까요? 이미 전송된 메시지는 유지됩니다.</p><button disabled={busy} onClick={()=>void finish().catch(e=>setError(e.message))}>공유 취소</button><button onClick={()=>setDiscard(false)}>계속 작성</button></>:<>
 <label>텍스트·설명<textarea maxLength={4000} value={text} disabled={busy||!!job.owner} onChange={e=>setText(e.target.value)}/></label><div className="shared-files">{job.files.map((f,i)=><Preview key={i} file={f}/>)}</div>
 <label>보낼 대화</label><SearchInput placeholder="대화 이름 검색" aria-label="공유받은 내용을 보낼 대화 검색" value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')}/>
 <div className="share-room-list">{rooms.filter(r=>(r.peer?.display_name??'').toLowerCase().includes(query.toLowerCase())).map(r=><button key={r.id} disabled={busy||!!job.owner} aria-pressed={room===r.id} onClick={()=>setRoom(r.id)}>{r.direct_key.startsWith('self:')?'나와의 대화':r.peer?.display_name??'대화'}{room===r.id?' ✓':''}</button>)}</div>
 {!rooms.some(r=>r.direct_key==='self:'+userId)&&<button disabled={busy||!!job.owner} onClick={()=>void supabase!.rpc('open_self_chat').then(({data,error})=>{if(error)setError(error.message);else{setRoom(data);onSent(data)}})}>나와의 대화 선택</button>}
 <p className="muted">새 파일은 전송 후 30일 보관됩니다. 미전송 공유는 이 기기에 최대 24시간 보관됩니다.</p>
 <button className="primary-button" disabled={busy||!room||(!text.trim()&&!job.files.length)} onClick={()=>void send()}>{busy?'전송 중…':job.owner?'같은 대화로 재전송':'선택한 대화로 전송'}</button><button disabled={busy} onClick={()=>setDiscard(true)}>취소</button>
 </>}{stage&&<p role="status">{stage}</p>}{error&&<p role="alert">{error}</p>}</ActionDialog>
}
