const SB='https://xpbfgppttnqmpevpumhd.supabase.co';
const PK='sb_publishable_A85gZipL6sx9y5F0FqQ4fQ_KiElgMOV';
export const CHUNK=4*1024*1024,MAX=300*1024*1024;
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export async function mac(secret,text){const key=await crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,enc.encode(text)))}
function fail(status,message){throw Object.assign(Error(message),{status})}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
async function sb(request,path,options={}){return fetch(SB+path,{...options,headers:{apikey:PK,Authorization:request.headers.get('Authorization'),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)})}
async function metadata(request,id,note){if(note){if(!/^Bearer [\w.-]+$/.test(request.headers.get('Authorization')||''))fail(401,'로그인해 주세요.');const r=await sb(request,'/rest/v1/rpc/get_note_file',{method:'POST',body:JSON.stringify({p_note:note,p_id:id})});if(!r.ok)fail(403,'파일 접근 권한이 없습니다.');return r.json()}if(!/^Bearer [\w.-]+$/.test(request.headers.get('Authorization')||''))fail(401,'로그인해 주세요.');const r=await sb(request,'/rest/v1/chat_attachments?id=eq.'+id+'&select=*');if(!r.ok)fail(401,'로그인을 확인해 주세요.');const [a]=await r.json();if(!a)fail(404,'파일에 접근할 수 없습니다.');return a}
async function writable(request,a){const r=await sb(request,'/rest/v1/rpc/'+(a.note_id?'prepare_note_file':'prepare_attachment'),{method:'POST',body:JSON.stringify({...(a.note_id?{p_note:a.note_id}:{p_room:a.room_id}),p_id:a.id,p_name:a.name,p_size:a.size,p_mime:a.mime})});if(!r.ok)fail(403,'파일 전송 권한이 없거나 차단 상태입니다.');if(a.r2_key)fail(409,'이미 전송한 파일입니다.')}
async function ticket(env,request,a){const raw=request.headers.get('X-Upload-Ticket')||'';if(raw.length>1500)fail(400,'Invalid ticket');const dot=raw.lastIndexOf('.'),payload=raw.slice(0,dot),sig=raw.slice(dot+1);if(!/^[a-f0-9]{64}$/.test(sig)||await mac(env.R2_RECEIPT_KEY,payload)!==sig)fail(403,'Invalid ticket');let t;try{t=JSON.parse(atob(payload))}catch{fail(400,'Invalid ticket')}if(t.id!==a.id||t.size!==Number(a.size)||t.expires<Date.now()||!new RegExp('^'+(a.note_id?'notes':'files')+'/'+a.id+'/[a-f0-9-]{36}$').test(t.prefix))fail(403,'업로드가 만료되었습니다. 다시 전송해 주세요.');return t}
async function smallJson(r){const text=await r.text();if(text.length>16000)fail(413,'Request too large');try{return JSON.parse(text)}catch{fail(400,'Invalid JSON')}}
export async function fileApi(request,env){try{
 const u=new URL(request.url);if(u.pathname==='/api/retention/run')return cleanup(request,env);const note=u.pathname.startsWith('/api/note-files/')?u.searchParams.get('note'):null;if(u.pathname.startsWith('/api/note-files/')&&!/^[a-f0-9-]{36}$/.test(note||''))fail(400,'노트를 확인해 주세요.');const match=/^\/api\/(?:files|note-files)\/([a-f0-9-]{36})(?:\/(start|part|finish|cancel))?$/.exec(u.pathname);if(!match)return json({error:'Not found'},404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==u.origin)fail(403,'Origin denied');
 if(!env.BUCKET||!env.R2_RECEIPT_KEY)fail(503,'파일 저장소를 준비하고 있습니다.');
 const a=await metadata(request,match[1],note),action=match[2];
 if(!action&&request.method==='GET'){
  if(a.expires_at&&Date.parse(a.expires_at)<=Date.now())fail(410,'보관 기간 30일이 만료된 파일입니다.');
  if(!a.r2_key&&a.note_id)fail(404,'아직 업로드 중인 파일입니다.');if(!a.r2_key){const r=await sb(request,'/storage/v1/object/authenticated/chat-files/'+a.path,{headers:{'Content-Type':'application/octet-stream'}});if(!r.ok)fail(404,'기존 파일을 불러오지 못했습니다.');return new Response(r.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(a.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
  const obj=await env.BUCKET.get(a.r2_key);if(!obj)fail(404,'파일을 찾을 수 없습니다.');const manifest=await obj.json();if(manifest.size!==Number(a.size))fail(500,'File integrity error');
  let index=0,reader=null;const stream=new ReadableStream({async pull(controller){try{while(true){if(!reader){if(index>=manifest.parts.length){controller.close();return}const part=await env.BUCKET.get(manifest.parts[index++].key);if(!part)throw Error('Missing part');reader=part.body.getReader()}const {done,value}=await reader.read();if(done){reader=null;continue}controller.enqueue(value);return}}catch(e){controller.error(e)}},async cancel(){await reader?.cancel()}});
  return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(a.size),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(a.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(Number(a.size)>MAX)fail(413,'파일은 최대 300MB까지 보낼 수 있습니다.');await writable(request,a);
 if(action==='start'&&request.method==='POST'){const prefix=a.note_id?'notes/':'files/';const root=prefix+a.id+'/'+a.id;const cancelled=await env.BUCKET.head(root+'/terminal');const t={id:a.id,size:Number(a.size),prefix:cancelled?.customMetadata?.mode==='cancel'?(prefix+a.id+'/'+crypto.randomUUID()):root,expires:Date.now()+86400000};const payload=btoa(JSON.stringify(t));return json({ticket:payload+'.'+await mac(env.R2_RECEIPT_KEY,payload),chunkSize:CHUNK})}
 const t=await ticket(env,request,a);
 const claim=async(mode)=>{await env.BUCKET.put(t.prefix+'/terminal',mode,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{mode}});const state=await env.BUCKET.head(t.prefix+'/terminal');if(state?.customMetadata?.mode!==mode)fail(409,'취소 또는 전송 확정이 이미 진행되었습니다. 결과를 확인해 주세요.')};
 if(action==='cancel'&&request.method==='POST'){if(await env.BUCKET.head(t.prefix+'/manifest.json'))fail(409,'전송 확정 중이거나 완료되었습니다. 결과를 확인해 주세요.');await claim('cancel');const keys=Array.from({length:Math.ceil(t.size/CHUNK)},(_,i)=>t.prefix+'/'+i);await env.BUCKET.delete(keys);return json({cancelled:true})}
 if(action==='part'&&request.method==='PUT'){
  if((await env.BUCKET.head(t.prefix+'/terminal'))?.customMetadata?.mode==='cancel')fail(409,'취소된 업로드입니다. 다시 전송해 주세요.');
  const index=Number(u.searchParams.get('index')),count=Math.ceil(t.size/CHUNK),expected=Math.min(CHUNK,t.size-index*CHUNK);
  if(!Number.isInteger(index)||index<0||index>=count)fail(400,'Invalid part');
  const reader=request.body?.getReader();if(!reader)fail(400,'Empty body');let total=0,items=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>expected){await reader.cancel();fail(413,'Part too large')}items.push(value)}if(total!==expected)fail(400,'Incomplete part');
  const bytes=new Uint8Array(total);let offset=0;for(const v of items){bytes.set(v,offset);offset+=v.length}const hash=hex(await crypto.subtle.digest('SHA-256',bytes)),key=t.prefix+'/'+index;
  await env.BUCKET.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{sha256:hash}});const saved=await env.BUCKET.head(key);if(!saved||saved.size!==total||saved.customMetadata?.sha256!==hash)fail(409,'처음 선택한 원본 파일을 다시 선택해 주세요.');return json({key,size:total,hash});
 }
 if(action==='finish'&&request.method==='POST'){
  const data=await smallJson(request),parts=data.parts;if(!Array.isArray(parts)||parts.length!==Math.ceil(t.size/CHUNK))fail(400,'Invalid manifest');
  const listed=await env.BUCKET.list({prefix:t.prefix+'/',limit:1000,include:['customMetadata']});const stored=new Map(listed.objects.map(o=>[o.key,o]));
  for(let i=0;i<parts.length;i++){const p=parts[i];if(p.key!==t.prefix+'/'+i||!(/^[a-f0-9]{64}$/).test(p.hash)||p.size!==Math.min(CHUNK,t.size-i*CHUNK))fail(400,'Invalid part');const h=stored.get(p.key);if(!h||h.size!==p.size||h.customMetadata?.sha256!==p.hash)fail(400,'Missing part')}
  await claim('finish');const key=t.prefix+'/manifest.json',body=JSON.stringify({size:t.size,parts,createdAt:new Date().toISOString()});
  const existing=await env.BUCKET.get(key);if(existing){const m=await existing.json();if(JSON.stringify(m.parts)!==JSON.stringify(parts))fail(409,'Upload conflict')}else{await env.BUCKET.put(key,body,{onlyIf:{etagDoesNotMatch:'*'}});const saved=await(await env.BUCKET.get(key)).json();if(JSON.stringify(saved.parts)!==JSON.stringify(parts))fail(409,'Upload conflict')}
  const receipt=await mac(env.R2_RECEIPT_KEY,a.id+':'+a.size+':'+key);const r=await sb(request,'/rest/v1/rpc/'+(a.note_id?'finish_note_file':'send_r2_attachment'),{method:'POST',body:JSON.stringify({...(a.note_id?{p_note:a.note_id}:{}),p_id:a.id,p_key:key,p_receipt:receipt})});if(!r.ok)fail(409,'전송을 완료하지 못했습니다. 재전송해 주세요.');return json(await r.json());
 }
 fail(405,'Method not allowed');
 }catch(e){return json({error:e.status?e.message:'파일 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'},e.status||500)}}

async function cleanup(request,env){
 if(request.method!=='POST'||!env.R2_RECEIPT_KEY||request.headers.get('X-Retention-Key')!==env.R2_RECEIPT_KEY)return json({error:'Access denied'},403);
 const rpc=async(name,body)=>{const r=await fetch(SB+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:PK,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Retention RPC failed');return r};
 try{const rows=await(await rpc('r2_cleanup_list',{p_mac:await mac(env.R2_RECEIPT_KEY,'retention-scan')})).json();let deleted=0;
 for(const a of rows){if(!new RegExp('^(?:files|notes)/'+a.id+'/[a-f0-9-]{36}/manifest.json$').test(a.r2_key))continue;
 const prefix=a.r2_key.slice(0,-'/manifest.json'.length),keys=Array.from({length:Math.ceil(Number(a.size)/CHUNK)},(_,i)=>prefix+'/'+i);keys.push(a.r2_key,prefix+'/terminal');await env.BUCKET.delete(keys);
 await rpc('r2_cleanup_done',{p_id:a.id,p_mac:await mac(env.R2_RECEIPT_KEY,'deleted:'+a.id)});deleted++}
 return json({deleted,pendingMore:rows.length===50});}catch{return json({error:'Retention cleanup failed; will retry'},503)}
}