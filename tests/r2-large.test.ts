import {it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {fileApi,CHUNK,MAX} from '../worker/files.mjs';
it('streams a full 300MiB through all 75 chunks with matching SHA256; rejects 300MiB+1',async()=>{
 const id='30000000-0000-0000-0000-000000000001';const a:any={id,name:'300MiB.bin',size:300*1024*1024,mime:'application/octet-stream',room_id:'r',path:'a/'+id};const objects=new Map<string,any>();const expected=createHash('sha256');
 const env={R2_RECEIPT_KEY:'cd'.repeat(32),BUCKET:{async put(key:string,value:any,options:any={}){if(objects.has(key)&&options.onlyIf)return null;objects.set(key,{bytes:typeof value==='string'?new TextEncoder().encode(value):value,customMetadata:options.customMetadata});return{}},async head(key:string){const o=objects.get(key);return o?{size:o.bytes.length,customMetadata:o.customMetadata}:null},async list(){return{objects:[...objects].map(([key,o])=>({key,size:o.bytes.length,customMetadata:o.customMetadata}))}},async get(key:string){const o=objects.get(key);return o?{json:async()=>JSON.parse(new TextDecoder().decode(o.bytes)),body:new ReadableStream({start(c){c.enqueue(o.bytes);c.close()}})}:null}}};
 vi.stubGlobal('fetch',async(url:string,options:any)=>{if(url.includes('chat_attachments'))return Response.json([a]);if(url.includes('prepare_attachment'))return Response.json(a);if(url.includes('send_r2_attachment')){a.r2_key=JSON.parse(options.body).p_key;return Response.json({id:'message'})}throw Error(url)});
 try{const call=(suffix:string,method='GET',body:any=null,headers:any={})=>fileApi(new Request('https://test.local/api/files/'+id+suffix,{method,body,headers:{Authorization:'Bearer valid',...headers}}),env);
 expect(MAX).toBe(a.size);a.size++;expect((await call('/start','POST')).status).toBe(413);a.size--;
 const start=await(await call('/start','POST')).json(),headers={'X-Upload-Ticket':start.ticket},parts=[];
 for(let i=0;i<75;i++){const bytes=new Uint8Array(CHUNK).fill(i);expected.update(bytes);const r=await call('/part?index='+i,'PUT',bytes,headers);expect(r.status).toBe(200);parts.push(await r.json())}
 const response=await call('/finish','POST',JSON.stringify({parts}),headers);expect(response.status).toBe(200);
 const output=await call('');expect(output.status).toBe(200);const reader=output.body!.getReader(),actual=createHash('sha256');let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;actual.update(value)}expect(size).toBe(300*1024*1024);expect(actual.digest('hex')).toBe(expected.digest('hex'));
 }finally{vi.unstubAllGlobals();objects.clear()}
},60000);
