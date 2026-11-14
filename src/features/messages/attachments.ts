import {supabase} from '../../services/supabase';
import type {ChatMessage} from './model';
export const MAX_FILE_SIZE=10*1024*1024;
export type Attachment={id:string;room_id:string;sender_id:string;name:string;size:number;mime:string;path:string};
export function fileName(name:string){return name.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,180)||'파일'}
export function fileSize(size:number){return size>=1048576?(size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(size/1024))+' KB'}
export async function fileMime(file:Blob){
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return 'image/png';
 const ascii=new TextDecoder().decode(bytes);
 if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'))return 'image/gif';
 if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return 'image/webp';
 return 'application/octet-stream';
}
export function validateFile(file:Pick<File,'size'>){if(file.size===0)throw Error('빈 파일은 보낼 수 없습니다.');if(file.size>MAX_FILE_SIZE)throw Error('파일은 최대 10MB까지 보낼 수 있습니다.')}
export async function bounded<T>(request:Promise<T>,milliseconds=30000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([request,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('응답 시간이 초과되었습니다. 연결 확인 후 재전송해 주세요.')),milliseconds)})])}finally{clearTimeout(timer)}
}
// The attachment UUID is also the immutable object name and message retry key.
export async function deliverAttachment(a:Attachment,file:File|undefined,stage:(text:string)=>void):Promise<ChatMessage>{
 if(!navigator.onLine)throw Error('인터넷 연결 후 재전송해 주세요.');
 stage('업로드 준비 중…');
 const prepared=await supabase!.rpc('prepare_attachment',{p_room:a.room_id,p_id:a.id,p_name:a.name,p_size:a.size,p_mime:a.mime}).abortSignal(AbortSignal.timeout(15000));
 if(prepared.error)throw prepared.error;
 stage('업로드 확인 중…');
 // A committed upload can be retried after reload, without selecting its file again.
 const existing=await bounded(supabase!.storage.from('chat-files').info(a.path));
 if(existing.error){
  if(!file)throw Error('파일을 다시 선택한 후 재전송해 주세요.');
  stage('업로드 중…');
  if(await fileMime(file)!==a.mime)throw Error('처음 선택한 원본 파일을 다시 선택해 주세요.');
  const uploaded=await bounded(supabase!.storage.from('chat-files').upload(a.path,new Blob([file],{type:a.mime}),{upsert:false,contentType:a.mime,cacheControl:'0'}),120000);
  if(uploaded.error){
   // Upload response may have been lost; the server verifies size and type on commit.
   const check=await bounded(supabase!.storage.from('chat-files').info(a.path));
   if(check.error)throw uploaded.error;
  }
 }
 stage('메시지 전송 중…');
 const sent=await supabase!.rpc('send_attachment',{p_id:a.id}).abortSignal(AbortSignal.timeout(15000));
 if(sent.error)throw sent.error;return sent.data as ChatMessage;
}
