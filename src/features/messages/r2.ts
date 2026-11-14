import {supabase} from '../../services/supabase';
import type {Attachment} from './attachments';
import type {ChatMessage} from './model';
async function headers(){const {data,error}=await supabase!.auth.getSession();if(error||!data.session)throw Error('다시 로그인해 주세요.');return {Authorization:'Bearer '+data.session.access_token}}
async function api(id:string,action:string,options:RequestInit={}){const r=await fetch('/api/files/'+id+action,{...options,headers:{...await headers(),...options.headers},signal:AbortSignal.timeout(120000)});if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.error||'파일 전송에 실패했습니다.')}return r}
export async function downloadAttachment(a:Attachment){return (await api(a.id,'')).blob()}
type Part={key:string;size:number;hash:string};
export async function uploadR2(a:Attachment,file:File|undefined,stage:(text:string)=>void):Promise<ChatMessage>{
 const prepared=await supabase!.rpc('prepare_attachment',{p_room:a.room_id,p_id:a.id,p_name:a.name,p_size:a.size,p_mime:a.mime}).abortSignal(AbortSignal.timeout(15000));if(prepared.error)throw prepared.error;
 // Reconcile a commit whose response was lost before retrying the upload.
 const sent=await supabase!.from('messages').select('*').eq('attachment_id',a.id).abortSignal(AbortSignal.timeout(15000)).maybeSingle();if(sent.error)throw sent.error;if(sent.data)return sent.data;
 const savedKey='r2-upload:'+a.sender_id+':'+a.id;let state:{ticket:string;chunkSize:number;parts:Part[];created:number}|null=null;
 try{state=JSON.parse(sessionStorage.getItem(savedKey)||'null')}catch{}
 if(state&&Date.now()-state.created>23*3600000){state=null;sessionStorage.removeItem(savedKey)}
 if(!state){if(!file)throw Error('원본 파일을 다시 선택해 주세요.');const start=await(await api(a.id,'/start',{method:'POST'})).json();state={...start,parts:[],created:Date.now()}}
 const current=state!;const count=Math.ceil(a.size/current.chunkSize);
 for(let i=0;i<count;i++){
  if(!file){if(current.parts[i])continue;throw Error('원본 파일을 다시 선택해 주세요.')}
  const chunk=file.slice(i*current.chunkSize,(i+1)*current.chunkSize);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await chunk.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
  if(current.parts[i]){if(current.parts[i].hash!==hash)throw Error('처음 선택한 원본 파일을 다시 선택해 주세요.');continue}
  stage('업로드 중… '+Math.floor(i/count*100)+'%');
  const part=await(await api(a.id,'/part?index='+i,{method:'PUT',headers:{'X-Upload-Ticket':current.ticket,'Content-Type':'application/octet-stream'},body:chunk})).json();if(part.hash!==hash)throw Error('파일 검증에 실패했습니다.');current.parts[i]=part;sessionStorage.setItem(savedKey,JSON.stringify(current));
 }
 stage('파일 검증·메시지 전송 중…');const result=await(await api(a.id,'/finish',{method:'POST',headers:{'X-Upload-Ticket':current.ticket,'Content-Type':'application/json'},body:JSON.stringify({parts:current.parts})})).json();sessionStorage.removeItem(savedKey);return result;
}
