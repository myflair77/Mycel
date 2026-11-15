import {createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003';
const id='10000000-0000-0000-0000-000000000001';let room:string;let legacy:string;
async function asUser(id:string){await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(readFileSync(new URL('../migrations/0001_supabase_chat.sql',import.meta.url),'utf8').replace('alter publication supabase_realtime add table public.messages;',''));
 for(const [id,username] of [[a,'alice'],[b,'bob'],[c,'carol']])await db.query('insert into auth.users values($1,$2)',[id,JSON.stringify({username,display_name:username})]);
 await asUser(a);room=(await db.query<{id:string}>("select public.open_direct_chat('bob') as id")).rows[0].id;
 await db.exec('reset role');await db.exec(readFileSync(new URL('../migrations/0002_friends.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../migrations/0007_attachments.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0009_attachment_limit_50mb.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0010_r2_attachments.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0011_r2_retention.sql',import.meta.url),'utf8'));
 await db.exec('create role service_role bypassrls');
 for(const n of ['0003_read_receipts.sql','0004_web_push.sql','0008_conversation_management.sql'])await db.exec(readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8').replace('alter publication supabase_realtime add table public.chat_reads;',''));
 await db.exec(readFileSync(new URL('../migrations/0016_self_chat.sql',import.meta.url),'utf8'));
 await db.query('insert into public.r2_receipt_secret(key_hex) values($1)',['ab'.repeat(32)]);
 await db.exec(readFileSync(new URL('../migrations/0013_r2_limit_300mb.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0017_message_actions_board.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0018_group_chat.sql',import.meta.url),'utf8'));
 await db.query("insert into public.chat_rooms(direct_key,group_name,group_creator) values('group:legacy','legacy',$1)",[a]);
 legacy=(await db.query<any>("select id from public.chat_rooms where direct_key='group:legacy'")).rows[0].id;
 await db.query('insert into public.chat_members(room_id,user_id) values($1,$2),($1,$3)',[legacy,a,b]);
 await asUser(a);await db.query("select public.send_message($1,'retained history',gen_random_uuid())",[legacy]);
 await db.exec('reset role');
 await db.exec(readFileSync(new URL('../migrations/0019_group_history.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0020_team_chat.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0021_history_invitation.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0022_polls_scheduled.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0024_poll_options.sql',import.meta.url),'utf8'));
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});



async function group(mode='regular',users=[b,c]){await asUser(a);return (await db.query<any>('select public.create_group_with_mode(gen_random_uuid(),$1,$2::uuid[],$3) as id',['team test',users,mode])).rows[0].id}
async function state(r:string){return (await db.query<any>('select public.get_group_state($1) as s',[r])).rows[0].s}
async function propose(r:string,mode='team',candidate:string|null=b){return (await db.query<any>("select public.propose_group_mode($1,gen_random_uuid(),$2,$3,'managers') as id",[r,mode,candidate])).rows[0].id}
async function vote(p:string,agree=true,owner=false){return (await db.query<any>('select public.vote_group_mode($1,$2,$3) as status',[p,agree,owner])).rows[0].status}
async function toolsState(r:string){return (await db.query<any>('select public.get_room_tools($1) as s',[r])).rows[0].s}
it('supports public single-choice voting, changes, closing and membership visibility boundaries',async()=>{
 const r=await group('team',[b]),id='10000000-0000-0000-0000-000000000092',end=new Date(Date.now()+3600000).toISOString();
 await db.query('select public.create_chat_poll($1,$2,$3,$4,$5)',[id,r,'Lunch?',['A','B'],end]);await db.query('select public.create_chat_poll($1,$2,$3,$4,$5)',[id,r,'Lunch?',['A','B'],end]);expect((await toolsState(r)).polls).toHaveLength(1);
 await asUser(b);await db.query('select public.vote_chat_poll($1,1)',[id]);await db.query('select public.vote_chat_poll($1,2)',[id]);const p=(await toolsState(r)).polls[0];expect(p.votes).toHaveLength(1);expect(p.votes[0]).toMatchObject({user_id:b,name:'bob',choice:2});await expect(db.query('select public.close_chat_poll($1)',[id])).rejects.toThrow(/작성자/);
 await asUser(a);await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);await asUser(c);expect((await toolsState(r)).polls).toHaveLength(0);await expect(db.query('select public.vote_chat_poll($1,1)',[id])).rejects.toThrow(/권한/);
 await asUser(a);await db.query('select public.close_chat_poll($1)',[id]);await expect(db.query('select public.vote_chat_poll($1,1)',[id])).rejects.toThrow(/마감/);
});
it('keeps schedules private, allows optimistic edits and cancellation, and rejects worker access',async()=>{
 const r=await group('team',[b]),id='10000000-0000-0000-0000-000000000093',at=new Date(Date.now()+3600000).toISOString();
 await db.query('select public.save_scheduled_message($1,$2,$3,$4)',[id,r,'later',at]);const s=(await toolsState(r)).scheduled[0];await db.query('select public.save_scheduled_message($1,$2,$3,$4,$5)',[id,r,'edited',at,s.updated_at]);await expect(db.query('select public.save_scheduled_message($1,$2,$3,$4,$5)',[id,r,'stale',at,s.updated_at])).rejects.toThrow(/변경/);
 await asUser(b);expect((await toolsState(r)).scheduled).toHaveLength(0);await expect(db.query('select public.cancel_scheduled_message($1)',[id])).rejects.toThrow(/권한/);await expect(db.query('select public.run_scheduled_messages()')).rejects.toThrow(/permission/);await expect(db.query('select * from public.scheduled_messages')).rejects.toThrow(/permission/);
 await asUser(a);await db.query('select public.cancel_scheduled_message($1)',[id]);expect((await toolsState(r)).scheduled[0].status).toBe('cancelled');
});
it('delivers due schedules once without a browser, preserves attribution and fails safely after leaving',async()=>{
 const r=await group('regular',[b]),id='10000000-0000-0000-0000-000000000094',bad='10000000-0000-0000-0000-000000000095',at=new Date(Date.now()+3600000).toISOString();
 await db.query('select public.save_scheduled_message($1,$2,$3,$4)',[id,r,'server sent',at]);await asUser(b);await db.query('select public.save_scheduled_message($1,$2,$3,$4)',[bad,r,'must fail',at]);await db.query('select public.leave_group_chat($1)',[r]);await db.exec('reset role');await db.query("update public.scheduled_messages set send_at=now()-interval '1 minute' where id=any($1::uuid[])",[[id,bad]]);await db.query('select public.run_scheduled_messages()');await db.query('select public.run_scheduled_messages()');
 expect((await db.query<any>('select * from public.messages where idempotency_key=$1',[id])).rows).toHaveLength(1);expect((await db.query<any>('select sender_id from public.messages where idempotency_key=$1',[id])).rows[0].sender_id).toBe(a);expect((await db.query<any>('select status from public.scheduled_messages where id=$1',[bad])).rows[0].status).toBe('failed');expect((await db.query('select * from public.messages where idempotency_key=$1',[bad])).rows).toHaveLength(0);
});

it('hides anonymous voters from owner and participants and validates bounded multi-choice replacement',async()=>{
 const r=await group('team',[b]),id='10000000-0000-0000-0000-000000000096',end=new Date(Date.now()+3600000).toISOString();
 await db.query('select public.create_chat_poll($1,$2,$3,$4,$5,true,2)',[id,r,'Pick up to two',['A','B','C','D','E'],end]);
 await asUser(b);await db.query('select public.vote_chat_poll_choices($1,array[1,3])',[id]);
 let p=(await toolsState(r)).polls[0];expect(p.my_choices).toEqual([1,3]);expect(p.votes).toEqual([]);expect(p.counts).toEqual([1,0,1,0,0]);expect(p.voter_count).toBe(1);
 await expect(db.query('select public.vote_chat_poll_choices($1,array[1,2,3])',[id])).rejects.toThrow(/개수/);
 await expect(db.query('select public.vote_chat_poll_choices($1,array[1,1])',[id])).rejects.toThrow(/개수/);
 await expect(db.query('select * from public.chat_poll_votes')).rejects.toThrow(/permission/);
 await db.query('select public.vote_chat_poll_choices($1,array[2])',[id]);
 await asUser(a);p=(await toolsState(r)).polls[0];expect(p.votes).toEqual([]);expect(p.my_choices).toEqual([]);expect(p.counts).toEqual([0,1,0,0,0]);expect(JSON.stringify(p)).not.toContain(b);
 await db.query('select public.close_chat_poll($1)',[id]);await expect(db.query('select public.vote_chat_poll_choices($1,array[1])',[id])).rejects.toThrow(/마감/);
});
