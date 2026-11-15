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
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});



async function group(mode='regular',users=[b,c]){await asUser(a);return (await db.query<any>('select public.create_group_with_mode(gen_random_uuid(),$1,$2::uuid[],$3) as id',['team test',users,mode])).rows[0].id}
async function state(r:string){return (await db.query<any>('select public.get_group_state($1) as s',[r])).rows[0].s}
async function propose(r:string,mode='team',candidate:string|null=b){return (await db.query<any>("select public.propose_group_mode($1,gen_random_uuid(),$2,$3,'managers') as id",[r,mode,candidate])).rows[0].id}
async function vote(p:string,agree=true,owner=false){return (await db.query<any>('select public.vote_group_mode($1,$2,$3) as status',[p,agree,owner])).rows[0].status}
it('requires every current participant plus explicit owner acceptance and preserves history floors through both conversions',async()=>{
 const r=await group('regular',[b]);
 const old=(await db.query<any>("select * from public.send_message($1,'private before joining',gen_random_uuid())",[r])).rows[0];
 const attachment='10000000-0000-0000-0000-000000000020';
 await db.query('select public.prepare_attachment($1,$2,$3,123,$4)',[r,attachment,'old.png','image/png']);
 const path='files/'+attachment+'/'+attachment+'/manifest.json',receipt=createHmac('sha256',Buffer.from('ab'.repeat(32),'hex')).update(attachment+':123:'+path).digest('hex');
 await db.query('select public.send_r2_attachment($1,$2,$3)',[attachment,path,receipt]);
 await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);
 const p=await propose(r);expect(await vote(p)).toBe('pending');
 await asUser(b);await expect(vote(p)).rejects.toThrow(/방장/);expect(await vote(p,true,true)).toBe('pending');
 expect((await state(r)).mode).toBe('regular');
 await asUser(c);expect(await vote(p)).toBe('accepted');expect(await vote(p)).toBe('accepted');
 expect((await state(r)).owner_id).toBe(b);expect((await state(r)).mode).toBe('team');
 expect((await db.query('select * from public.messages where id=$1',[old.id])).rows).toHaveLength(0);
 expect((await db.query('select * from public.chat_attachments where id=$1',[attachment])).rows).toHaveLength(0);
 await asUser(a);expect((await db.query('select * from public.messages where id=$1',[old.id])).rows).toHaveLength(1);expect((await db.query('select * from public.chat_attachments where id=$1',[attachment])).rows).toHaveLength(1);
 const q=await propose(r,'regular',null);await vote(q);await asUser(b);await vote(q);await asUser(c);expect(await vote(q)).toBe('accepted');
 expect((await state(r)).mode).toBe('regular');expect((await state(r)).owner_id).toBeNull();
 expect((await db.query('select * from public.chat_attachments where id=$1',[attachment])).rows).toHaveLength(0);
});
it('rejects bypasses, protects team management and requires accepted ownership transfer before owner departure',async()=>{
 const r=await group('team');
 await asUser(b);await expect(db.query("select public.rename_group_chat($1,'hijack')",[r])).rejects.toThrow(/방장/);
 await expect(db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c])).rejects.toThrow(/방장/);
 await expect(db.query("select public.manage_team($1,'role',$2,'admin')",[r,b])).rejects.toThrow(/방장/);
 await expect(db.query("select public.rename_group_chat_base($1,'bypass')",[r])).rejects.toThrow(/permission/);
 await expect(db.query("update public.chat_rooms set group_mode='regular' where id=$1",[r])).rejects.toThrow();
 await expect(db.query("select public.save_room_post(gen_random_uuid(),$1,'notice','body','{}',true,null)",[r])).rejects.toThrow(/공지/);
 await db.query("select public.save_room_post(gen_random_uuid(),$1,'post','body','{}',false,null)",[r]);
 await asUser(a);await expect(db.query('select public.leave_group_chat($1)',[r])).rejects.toThrow(/방장/);
 await db.query("select public.manage_team($1,'role',$2,'admin')",[r,b]);
 await asUser(b);await db.query("select public.rename_group_chat($1,'allowed')",[r]);
 await expect(db.query("select public.manage_team($1,'kick',$2)",[r,a])).rejects.toThrow(/권한/);
 await asUser(a);await db.query("select public.manage_team($1,'offer_owner',$2)",[r,b]);
 await expect(db.query('select public.leave_group_chat($1)',[r])).rejects.toThrow(/방장/);
 await asUser(b);await db.query("select public.manage_team($1,'accept_owner')",[r]);expect((await state(r)).owner_id).toBe(b);
 await asUser(a);await db.query('select public.leave_group_chat($1)',[r]);
});
it('ends proposals on rejection, expiry or membership changes, freezes expulsions and keeps ballots private',async()=>{
 const r=await group('team');const p=await propose(r,'regular',null);await vote(p);
 await expect(db.query("select public.manage_team($1,'kick',$2)",[r,c])).rejects.toThrow(/투표/);
 await asUser(b);await expect(db.query('select * from public.room_mode_votes')).rejects.toThrow(/permission/);
 expect(await vote(p,false)).toBe('rejected');expect((await state(r)).mode).toBe('team');
 await expect(propose(r,'regular',null)).rejects.toThrow(/24시간/);
 const r2=await group();const p2=await propose(r2);await vote(p2);await asUser(c);await db.query('select public.leave_group_chat($1)',[r2]);
 await asUser(b);expect(await vote(p2,true,true)).toBe('invalidated');expect((await state(r2)).mode).toBe('regular');
 const r3=await group();const p3=await propose(r3);await db.exec('reset role');await db.query("update public.room_mode_proposals set expires_at=now()-interval '1 second' where id=$1",[p3]);await asUser(b);
 expect(await vote(p3,true,true)).toBe('expired');expect((await state(r3)).mode).toBe('regular');
});
it('creating a team from a direct conversation leaves the original messages and room unchanged',async()=>{
 await asUser(a);const m=(await db.query<any>("select * from public.send_message($1,'direct only',gen_random_uuid())",[room])).rows[0];
 const r=(await db.query<any>("select public.create_group_with_mode(gen_random_uuid(),'new team',array[$1::uuid],'team',$2) as id",[c,room])).rows[0].id;
 expect(r).not.toBe(room);expect((await state(r)).mode).toBe('team');expect((await db.query('select * from public.messages where room_id=$1',[r])).rows).toHaveLength(0);
 expect((await db.query('select * from public.messages where id=$1',[m.id])).rows).toHaveLength(1);
 await asUser(c);expect((await db.query('select * from public.messages where id=$1',[m.id])).rows).toHaveLength(0);
});
