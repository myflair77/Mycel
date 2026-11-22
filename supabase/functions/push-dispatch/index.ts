import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import webpush from 'npm:web-push@3.6.7';
import {timingSafeEqual} from 'node:crypto';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const {data:config,error}=await admin.from('push_config').select('*').eq('id',true).single();
 if(error||!config)return new Response('Not configured',{status:503});
 const supplied=new TextEncoder().encode(req.headers.get('x-push-secret')??'');
 const expected=new TextEncoder().encode(config.webhook_secret);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return new Response('Unauthorized',{status:401});
 const {data:jobs,error:claimError}=await admin.rpc('claim_push_jobs');
 if(claimError)return new Response('Queue unavailable',{status:503});
 const results=await Promise.all((jobs??[]).map(async(job:any)=>{
  try{
   if(job.skip){await admin.from('push_jobs').update({status:'skipped'}).eq('id',job.id);return 'skipped'}
   const url=new URL(job.endpoint);
   if(url.protocol!=='https:'||!(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)$/).test(url.hostname))throw new Error('Invalid endpoint');
   const {data:badge,error:badgeError}=await admin.rpc('push_badge_snapshot',{p_user:job.user_id});
   if(badgeError||!badge)throw new Error('Badge snapshot unavailable');
   const details=webpush.generateRequestDetails({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify({title:'Mycel',body:job.notification_kind==='date'?'설정한 날짜 리마인더입니다.':job.mention_id?'노트에서 나를 언급했습니다.':'새 메시지가 도착했습니다.',roomId:job.room_id,mentionId:job.mention_id??undefined,userId:job.user_id,tag:'push-'+job.id,unreadCount:badge.unreadCount,badgeAt:badge.badgeAt}),{TTL:86400,urgency:'normal',vapidDetails:{subject:'https://web-messenger-jbh.myflair.chatgpt.site',publicKey:config.public_key,privateKey:config.private_key}});
   const response=await fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(8000)});
   if(response.status===404||response.status===410){await admin.from('push_devices').delete().eq('id',job.device_id);return 'expired'}
   if(!response.ok)throw new Error('Provider rejected');
   await admin.from('push_jobs').update({status:'sent'}).eq('id',job.id);return 'sent';
  }catch{
   await admin.from('push_jobs').update({status:job.attempts>=6?'failed':'pending',next_attempt:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000).toISOString()}).eq('id',job.id);return 'retry';
  }
 }));
 return Response.json({processed:results.length,sent:results.filter(x=>x==='sent').length});
});
