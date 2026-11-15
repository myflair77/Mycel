import {useEffect,useState} from 'react';
import {sendOutside,canShareFile} from './share';
import {downloadAttachment} from '../messages/r2';
import {prepareDownload,type Attachment} from '../messages/attachments';
export function ExternalShare({text,attachment}:{text:string;attachment:Attachment|null}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;if(attachment){setBusy(true);void downloadAttachment(attachment).then(b=>prepareDownload(b,attachment)).then(p=>{if(active)setFile(new File([p.blob],p.name,{type:p.blob.type!=='application/octet-stream'?p.blob.type:({'pdf':'application/pdf','txt':'text/plain','csv':'text/csv','zip':'application/zip','mp4':'video/mp4','mp3':'audio/mpeg','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'} as Record<string,string>)[p.name.split('.').pop()!.toLowerCase()]||p.blob.type}))}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)})}return()=>{active=false}},[attachment?.id]);
 const supported=attachment?!!file&&canShareFile(file):!!navigator.share;
 async function share(){if(sharing)return;setSharing(true);setError('');try{await sendOutside(file?{files:[file]}:{text})}catch{setError('공유창을 열지 못했습니다. 복사 또는 다운로드를 이용해 주세요.')}finally{setSharing(false)}}
 async function copy(){try{await navigator.clipboard.writeText(text)}catch{setError('아래 내용을 선택해 복사해 주세요.')}}
 function save(){if(!file)return;const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000)}
 return <div className="external-share"><p>{attachment?attachment.name:'메시지 내용을 다른 앱으로 공유합니다.'}</p>{busy?<p role="status">공유할 원본 파일을 준비하고 있습니다…</p>:<><button className="primary-button" disabled={!supported||sharing} onClick={()=>void share()}>공유창 열기</button>{!supported&&<p>이 브라우저 또는 파일 형식은 시스템 공유를 지원하지 않습니다.</p>}{attachment?<button disabled={!file} onClick={save}>파일 다운로드</button>:<><button onClick={()=>void copy()}>텍스트 복사</button><textarea readOnly aria-label="공유할 텍스트" value={text} onFocus={e=>e.target.select()}/></>}</>}{error&&<p role="alert">{error}</p>}</div>
}
