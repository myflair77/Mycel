import {downloadAttachment} from './r2';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
import {fileSize,prepareDownload,type Attachment} from './attachments';
export function AttachmentMessage({id}:{id:string}){
 const [attachment,setAttachment]=useState<Attachment|null>(null),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [zoom,setZoom]=useState(1);const pan=useRef<{x:number;y:number;left:number;top:number}|null>(null);
 const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[]);const expired=Boolean(attachment?.expires_at&&Date.parse(attachment.expires_at)<=now);
 const host=useRef<HTMLDivElement>(null);const viewer=useRef<HTMLDialogElement>(null);
 const isImage=Boolean(attachment&&['image/jpeg','image/png','image/gif','image/webp'].includes(attachment.mime));
 useEffect(()=>{if(expired)viewer.current?.close()},[expired]);
 useEffect(()=>{
  let stopped=false,objectUrl='';const controller=new AbortController();
  async function load(){
   setError('');
   try{
    const result=await supabase!.from('chat_attachments').select('*').eq('id',id).abortSignal(controller.signal).single();
    if(result.error)throw result.error;if(stopped)return;const a=result.data as Attachment;setAttachment(a);
    if((!a.expires_at||Date.parse(a.expires_at)>Date.now())&&['image/jpeg','image/png','image/gif','image/webp'].includes(a.mime)){
     const download=await downloadAttachment(a);if(stopped)return;
     objectUrl=URL.createObjectURL(new Blob([download],{type:a.mime}));setUrl(objectUrl);requestAnimationFrame(()=>{const article=host.current?.closest('article');const list=article?.parentElement;if(article&&list?.lastElementChild===article)list.scrollTop=list.scrollHeight});
    }
   }catch{if(!stopped)setError('파일을 불러오지 못했습니다.')}
  }
  // Avoid downloading every historic image just by entering a long conversation.
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void load()}},{rootMargin:'200px'});
  if(host.current)observer.observe(host.current);
  return()=>{stopped=true;controller.abort();observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[id,reload]);
 async function download(){if(!attachment||busy)return;setBusy(true);setError('');try{
  const result=await downloadAttachment(attachment);
  // Arbitrary documents are downloads, never rendered as active HTML/SVG in our origin.
  const file=await prepareDownload(result,attachment);
  const objectUrl=URL.createObjectURL(file.blob);
  const a=document.createElement('a');a.href=objectUrl;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
 }catch{setError('다운로드하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 const expiry=attachment?.expires_at?new Date(attachment.expires_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}):null;
 const downloadIcon=<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v13m-5-5 5 5 5-5M4 20h16"/></svg>;
 return <div className={'attachment-card '+(isImage?'image-attachment':'file-attachment')} ref={host}>
 {isImage&&!expired?<>{url?<button type="button" className="image-preview" aria-label="사진 크게 보기" onClick={()=>{setZoom(1);viewer.current?.showModal()}}><img src={url} alt={attachment?.name??'첨부 사진'} onLoad={e=>e.currentTarget.dispatchEvent(new Event('weano-media-ready',{bubbles:true}))}/></button>:<span className="attachment-placeholder">사진 불러오는 중…</span>}
 <dialog ref={viewer} className="image-viewer" onClick={e=>{if(e.target===e.currentTarget)viewer.current?.close()}}><div className="image-viewer-content"><header><span>{attachment?.name}</span><button type="button" aria-label="사진 축소" onClick={()=>setZoom(z=>Math.max(.5,z-.25))}>−</button><button type="button" aria-label="사진 확대" onClick={()=>setZoom(z=>Math.min(4,z+.25))}>＋</button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" disabled={busy||expired} onClick={()=>void download()} aria-label="사진 저장">{downloadIcon}</button><button type="button" autoFocus onClick={()=>viewer.current?.close()} aria-label="닫기">✕</button></header>{url&&<div className="image-pan" onPointerDown={e=>{if(e.pointerType==='mouse'){e.currentTarget.setPointerCapture(e.pointerId);pan.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop}}}} onPointerMove={e=>{if(pan.current&&e.currentTarget.hasPointerCapture(e.pointerId)){e.currentTarget.scrollLeft=pan.current.left+pan.current.x-e.clientX;e.currentTarget.scrollTop=pan.current.top+pan.current.y-e.clientY}}} onPointerUp={()=>{pan.current=null}}><img draggable={false} style={{width:(zoom*100)+'%',maxWidth:'none',maxHeight:'none'}} src={url} alt={attachment?.name??'첨부 사진'}/></div>}<footer>{expiry&&<small>유효기간: ~{expiry}</small>}{busy&&<small role="status">저장 중…</small>}{error&&<small role="alert">{error}</small>}</footer></div></dialog></>:
 <div className="file-summary"><div className="file-description"><strong>{attachment?.name??'첨부 파일'}</strong>{attachment&&<><small className={expired?'expiry-warning':''}>{expired?'보관 기간 만료':expiry?'유효기간: ~'+expiry:'유효기간: 제한 없음'}</small><small>용량: {fileSize(attachment.size)}</small></>}</div>{attachment&&<button className="file-download" type="button" onClick={()=>void download()} disabled={busy||expired} aria-label={busy?'저장 중':attachment.name+' 다운로드'} title="저장">{busy?<span>…</span>:downloadIcon}</button>}</div>}
 {error&&<div className="attachment-error" role="status">{error} <button type="button" onClick={()=>setReload(v=>v+1)}>다시 시도</button></div>}
 </div>;
}