import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const required=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','TEST_A_EMAIL','TEST_A_PASSWORD','TEST_B_EMAIL','TEST_B_PASSWORD','TEST_A_USERNAME','TEST_B_USERNAME'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length){console.error('BLOCKED: missing configuration keys: '+missing.join(', '));process.exit(2)}
const client=()=>createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const a=client(),b=client(),anonymous=client();
const credentials=prefix=>({email:process.env[prefix+'_EMAIL'],password:process.env[prefix+'_PASSWORD']});
const must=result=>{if(result.error)throw new Error(result.error.message);return result.data};
let channel;
try{
 if(process.argv.includes('--signup')){
  for(const [c,prefix] of [[a,'TEST_A'],[b,'TEST_B']]){
   const data=must(await c.auth.signUp({...credentials(prefix),options:{data:{username:process.env[prefix+'_USERNAME'],display_name:'Beta '+prefix}}}));
   assert(data.user,'Signup must return a user');
   if(data.user.identities?.length===0)throw new Error('Signup did not establish a new identity; use fresh test accounts.');
   console.log(prefix+': signup accepted; email delivery and confirmation must be verified separately.');
  }
  console.log('Complete both email confirmations, then run without --signup. No admin confirmation bypass is used.');
 }else{
  const ua=must(await a.auth.signInWithPassword(credentials('TEST_A'))).user;
  const ub=must(await b.auth.signInWithPassword(credentials('TEST_B'))).user;
  assert.notEqual(ua.id,ub.id);assert(ua.email_confirmed_at&&ub.email_confirmed_at,'Both users must have confirmed email');
  console.log('PASS: independent confirmed user logins');
  const social=must(await a.rpc('list_social'));
  if(!social.relations.some(person=>person.id===ub.id&&person.status==='accepted')){
   const request=must(await a.rpc('request_friend',{p_peer:ub.id}));
   if(request.error)throw new Error(request.error);
   const response=must(await b.rpc('respond_friend',{p_peer:ua.id,p_accept:true}));
   if(response.error)throw new Error(response.error);
  }
  console.log('PASS: accepted friendship before opening a new conversation');
  const room=must(await a.rpc('open_direct_chat',{p_username:process.env.TEST_B_USERNAME}));
  assert.equal(room,must(await b.rpc('open_direct_chat',{p_username:process.env.TEST_A_USERNAME})));
  const key=randomUUID(),body='integration-'+key;
  let deliver;const received=new Promise(resolve=>{deliver=resolve});
  channel=b.channel('test-'+key).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room_id=eq.'+room},payload=>{if(payload.new.body===body)deliver(payload.new)});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Realtime subscribe timeout')),20000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(new Error(status))}})});
  const saved=must(await a.rpc('send_message',{p_room:room,p_body:body,p_key:key}));
  let receiveTimer;const event=await Promise.race([received,new Promise((_,reject)=>{receiveTimer=setTimeout(()=>reject(new Error('Realtime delivery timeout')),15000)})]).finally(()=>clearTimeout(receiveTimer));
  assert.equal(event.id,saved.id);console.log('PASS: persisted A message delivered to B by Realtime');
  const retry=must(await a.rpc('send_message',{p_room:room,p_body:body,p_key:key}));assert.equal(retry.id,saved.id);
  const rows=must(await b.from('messages').select('id').eq('id',saved.id));assert.equal(rows.length,1);
  const conflict=await a.rpc('send_message',{p_room:room,p_body:body+' changed',p_key:key});assert(conflict.error);
  console.log('PASS: idempotency retry and conflicting payload rejection');
  await b.removeChannel(channel);channel=null;must(await b.auth.signOut());
  const offline=must(await a.rpc('send_message',{p_room:room,p_body:'offline-'+key,p_key:randomUUID()}));
  must(await b.auth.signInWithPassword(credentials('TEST_B')));
  const restored=must(await b.from('messages').select('id,sequence').eq('room_id',room).gt('sequence',saved.sequence).order('sequence'));
  assert(restored.some(message=>message.id===offline.id));console.log('PASS: offline message restored after reauthentication');
  const forbidden=await anonymous.from('messages').select('id').eq('room_id',room);assert(forbidden.error||forbidden.data.length===0);
  const illegalInsert=await b.from('messages').insert({room_id:room,sender_id:ua.id,body:'forged',idempotency_key:randomUUID(),sequence:999});assert(illegalInsert.error);
  const badRoom=await b.rpc('send_message',{p_room:randomUUID(),p_body:'forbidden',p_key:randomUUID()});assert(badRoom.error);
  console.log('PASS: anonymous read, direct forged insert, and unavailable-room send rejected');
  console.log('PASS: two-account integration complete. Separate browser/Sites-origin and third-user room isolation tests still required.');
 }
}catch(error){console.error('FAIL: '+error.message);process.exitCode=1}
finally{if(channel)await b.removeChannel(channel);await Promise.all([a.removeAllChannels(),b.removeAllChannels(),anonymous.removeAllChannels()]);await Promise.all([a.auth.signOut(),b.auth.signOut()]);}
