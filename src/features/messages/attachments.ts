import {uploadR2} from './r2';

import type {ChatMessage} from './model';
export const MAX_FILE_SIZE=300*1024*1024;
export type Attachment={id:string;room_id:string;sender_id:string;name:string;size:number;mime:string;path:string;expires_at?:string|null;original_deleted_at?:string|null;r2_key?:string|null};
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
export function validateFile(file:Pick<File,'size'>){if(file.size===0)throw Error('빈 파일은 보낼 수 없습니다.');if(file.size>MAX_FILE_SIZE)throw Error('파일은 최대 300MB까지 보낼 수 있습니다.')}
export async function bounded<T>(request:Promise<T>,milliseconds=30000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([request,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('응답 시간이 초과되었습니다. 연결 확인 후 재전송해 주세요.')),milliseconds)})])}finally{clearTimeout(timer)}
}
// The attachment UUID is also the immutable object name and message retry key.
export async function deliverAttachment(a:Attachment,file:File|undefined,stage:(text:string)=>void):Promise<ChatMessage>{
 if(!navigator.onLine)throw Error('인터넷 연결 후 재전송해 주세요.');
 if(file){validateFile(file);if(file.size!==a.size||await fileMime(file)!==a.mime)throw Error('처음 선택한 원본 파일을 다시 선택해 주세요.')}
 return uploadR2(a,file,stage);
}
export async function prepareDownload(data:Blob,a:Pick<Attachment,'name'|'size'>){
 if(data.size!==Number(a.size))throw Error('파일 크기가 일치하지 않습니다. 다시 다운로드해 주세요.');
 const mime=await fileMime(data);
 const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp'};
 let name=fileName(a.name);const ext=extensions[mime];
 if(ext&&!new RegExp(ext==='jpg'?'\\.(jpe?g|jfif)$':'\\.'+ext+'$','i').test(name))name+='.'+ext;
 return {name,blob:new Blob([data],{type:mime})};
}
