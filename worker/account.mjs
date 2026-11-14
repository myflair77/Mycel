import {mac} from './files.mjs';
const ACCOUNT_SB='https://xpbfgppttnqmpevpumhd.supabase.co';
const ACCOUNT_PK='sb_publishable_A85gZipL6sx9y5F0FqQ4fQ_KiElgMOV';
const accountJson=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function accountQuota(env,scope,max,cooldown=60000,now=Date.now()){
 const key='account-quota/'+await mac(env.R2_RECEIPT_KEY,scope);
 for(let i=0;i<5;i++){
  const old=await env.BUCKET.get(key),state=old?await old.json():null;
  const fresh=!state||now-state.start>=3600000;
  if(state&&(now-state.last<cooldown||(!fresh&&state.count>=max)))return false;
  const next={start:fresh?now:state.start,last:now,count:fresh?1:state.count+1};
  const result=await env.BUCKET.put(key,JSON.stringify(next),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'}});
  if(result)return true;
 }
 return false;
}
export async function accountApi(request,env){
 if(request.method!=='POST')return accountJson({error:'Method not allowed'},405);
 const origin=new URL(request.url).origin;
 if(request.headers.get('Origin')!==origin)return accountJson({error:'Origin denied'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return accountJson({error:'Invalid content type'},400);
 try{
  if(!env.BUCKET||!env.R2_RECEIPT_KEY)throw Error('Unavailable');
  const reader=request.body?.getReader();if(!reader)return accountJson({error:'Invalid request'},400);
  let total=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>2048){await reader.cancel();return accountJson({error:'Request too large'},413)}parts.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length}
  const {email:raw,kind}=JSON.parse(new TextDecoder().decode(bytes)),email=typeof raw==='string'?raw.trim().toLowerCase():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['password','username'].includes(kind))return accountJson({error:'올바른 이메일을 입력해 주세요.'},400);
  // Cloudflare supplies this header. Never trust caller-provided X-Forwarded-For.
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  if(!await accountQuota(env,'ip:'+ip,20,3000)||!await accountQuota(env,'email:'+email,5))return accountJson({error:'요청이 많습니다. 60초 이상 기다린 뒤 다시 시도해 주세요.'},429);
  const path=kind==='password'?'recover':'otp';
  const response=await fetch(ACCOUNT_SB+'/auth/v1/'+path+'?redirect_to='+encodeURIComponent(origin),{method:'POST',headers:{apikey:ACCOUNT_PK,'Content-Type':'application/json'},body:JSON.stringify({email,...(kind==='username'?{create_user:false}:{})}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(response.status===429)return accountJson({error:'메일 발송 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.'},429);
  // Missing accounts and disabled automatic signup must not reveal membership.
  if(!response.ok&&!['user_not_found','signup_disabled','otp_disabled'].includes(data.code))return accountJson({error:'현재 안내 메일을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  return accountJson({ok:true,message:'등록된 이메일이라면 안내를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.'});
 }catch{return accountJson({error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503)}
}
