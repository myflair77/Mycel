import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../services/supabase';
import {bounded,fileSize,prepareDownload,type Attachment} from './attachments';
export function AttachmentMessage({id}:{id:string}){
 const [attachment,setAttachment]=useState<Attachment|null>(null),[url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let stopped=false,objectUrl='';const controller=new AbortController();
  async function load(){
   setError('');
   try{
    const result=await supabase!.from('chat_attachments').select('*').eq('id',id).abortSignal(controller.signal).single();
    if(result.error)throw result.error;if(stopped)return;const a=result.data as Attachment;setAttachment(a);
    if(['image/jpeg','image/png','image/gif','image/webp'].includes(a.mime)){
     const download=await bounded(supabase!.storage.from('chat-files').download(a.path));if(download.error)throw download.error;if(stopped)return;
     objectUrl=URL.createObjectURL(new Blob([download.data],{type:a.mime}));setUrl(objectUrl);requestAnimationFrame(()=>{const article=host.current?.closest('article');const list=article?.parentElement;if(article&&list?.lastElementChild===article)list.scrollTop=list.scrollHeight});
    }
   }catch{if(!stopped)setError('파일을 불러오지 못했습니다.')}
  }
  // Avoid downloading every historic image just by entering a long conversation.
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void load()}},{rootMargin:'200px'});
  if(host.current)observer.observe(host.current);
  return()=>{stopped=true;controller.abort();observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[id,reload]);
 async function download(){if(!attachment||busy)return;setBusy(true);setError('');try{
  const result=await bounded(supabase!.storage.from('chat-files').download(attachment.path));if(result.error)throw result.error;
  // Arbitrary documents are downloads, never rendered as active HTML/SVG in our origin.
  const file=await prepareDownload(result.data,attachment);
  const objectUrl=URL.createObjectURL(file.blob);
  const a=document.createElement('a');a.href=objectUrl;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
 }catch{setError('다운로드하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 return <div className="attachment-card" ref={host}>{url&&<a href={url} target="_blank" rel="noopener noreferrer" aria-label="사진 크게 보기"><img src={url} alt={attachment?.name??'첨부 사진'}/></a>}<strong>{attachment?.name??'첨부 파일'}</strong>{attachment&&<><small>{fileSize(attachment.size)}</small><button type="button" onClick={()=>void download()} disabled={busy}>{busy?'다운로드 중…':'다운로드'}</button></>}{error&&<p role="status">{error} <button type="button" onClick={()=>setReload(v=>v+1)}>다시 불러오기</button></p>}</div>
}
