// @ts-nocheck
// Auth admin credentials stay inside Supabase's Edge environment, never Sites/client.
const SITE='https://web-messenger-jbh.myflair.chatgpt.site';
const validEmail=(v)=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const digest=async(v)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
export async function signupEmail(request,env,fetcher=fetch){
 const headers={'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==SITE)return reply({error:'Origin denied'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Invalid content type'},400);
 let target=null,newEmail='',changed=false;
 const adminKey=env.SUPABASE_SERVICE_ROLE_KEY,url=env.SUPABASE_URL,key=env.SUPABASE_ANON_KEY;
 const api=(path,method,body,admin=false,token=null)=>fetcher(url+path,{
  method,redirect:'manual',headers:{apikey:admin?adminKey:key,Authorization:'Bearer '+(token||(admin?adminKey:key)),'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)
 });
 const eligible=(u)=>u&&!u.email_confirmed_at&&!u.phone_confirmed_at&&!u.is_anonymous
  &&(!u.banned_until||Date.parse(u.banned_until)<=Date.now())&&u.identities?.length===1&&u.identities[0].provider==='email';
 const unavailable=()=>reply({error:'이메일 변경을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
 try{
  if(!url||!adminKey||!key)return unavailable();
  const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid request'},400);
  let total=0,parts=[];for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2048){await reader.cancel();return reply({error:'Request too large'},413)}parts.push(value)}
  const buf=new Uint8Array(total);let offset=0;for(const part of parts){buf.set(part,offset);offset+=part.length}
  const input=JSON.parse(new TextDecoder().decode(buf)),email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  newEmail=typeof input.newEmail==='string'?input.newEmail.trim().toLowerCase():'';
  if(!validEmail(email)||!validEmail(newEmail)||email===newEmail||typeof input.password!=='string'||input.password.length<8||input.password.length>128)return reply({error:'기존 이메일, 새 이메일과 가입 비밀번호를 확인해 주세요.'},400);
  // Both the source account and destination mailbox are bounded, including direct calls.
  const quota=await api('/rest/v1/rpc/claim_signup_email_change','POST',{p_scopes:await Promise.all([digest(email),digest(newEmail)])},true);
  if(!quota.ok)return unavailable();
  if(await quota.json()!==true)return reply({error:'60초 이상 기다린 뒤 다시 시도해 주세요. 변경은 시간당 최대 5회 가능합니다.'},429);
  const listed=await api('/auth/v1/admin/users?filter='+encodeURIComponent(email)+'&page=1&per_page=50','GET',undefined,true);
  if(!listed.ok)return unavailable();
  target=(await listed.json()).users?.find(u=>u.email?.toLowerCase()===email);
  const denied=()=>reply({error:'기존 이메일과 가입 비밀번호를 확인해 주세요. 인증을 완료한 계정은 로그인 후 설정에서 이메일을 변경해 주세요.'},400);
  if(!target?.id)return denied();
  const detail=await api('/auth/v1/admin/users/'+target.id,'GET',undefined,true);
  if(!detail.ok)return unavailable();
  target=await detail.json();
  if(target.email?.toLowerCase()!==email||!eligible(target)||!target.updated_at)return denied();
  // GoTrue checks the password BEFORE returning email_not_confirmed.
  const login=await api('/auth/v1/token?grant_type=password','POST',{email,password:input.password});
  const proof=await login.json().catch(()=>({}));
  if(login.ok&&proof.access_token){await api('/auth/v1/logout?scope=local','POST',undefined,false,proof.access_token);return denied()}
  if(login.status===429)return reply({error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
  if(login.status!==400||proof.error_code!=='email_not_confirmed'&&proof.code!=='email_not_confirmed')return denied();
  const updated=await api('/auth/v1/admin/users/'+target.id,'PUT',{
   email:newEmail,email_confirm:false,
   app_metadata:{mycel_pending_email_change:{email:target.email,updated_at:target.updated_at}}
  },true);
  if(!updated.ok)return reply({error:'변경할 수 없습니다. 다른 계정에서 사용하는 이메일이거나 계정 상태가 바뀌었습니다. 이메일을 확인하고 다시 시도해 주세요.'},409);
  const user=await updated.json();
  if(user.id!==target.id||user.email?.toLowerCase()!==newEmail)return unavailable();
  changed=true;
  const mail=await api('/auth/v1/resend?redirect_to='+encodeURIComponent(SITE),'POST',{type:'signup',email:newEmail});
  return reply({emailChanged:true,email:newEmail,mailSent:mail.ok});
 }catch{
  // A lost Admin response must not falsely tell the user the old address is current.
  if(target&&!changed){try{const check=await api('/auth/v1/admin/users/'+target.id,'GET',undefined,true);if(check.ok){const u=await check.json();changed=u.id===target.id&&u.email?.toLowerCase()===newEmail}}catch{}}
  if(changed)return reply({emailChanged:true,email:newEmail,mailSent:false});
  return unavailable();
 }
}
if(typeof Deno!=='undefined')Deno.serve(r=>signupEmail(r,{
 SUPABASE_URL:Deno.env.get('SUPABASE_URL'),SUPABASE_ANON_KEY:Deno.env.get('SUPABASE_ANON_KEY'),SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}));

