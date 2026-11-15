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
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});



async function group(mode='regular',users=[b,c]){await asUser(a);return (await db.query<any>('select public.create_group_with_mode(gen_random_uuid(),$1,$2::uuid[],$3) as id',['team test',users,mode])).rows[0].id}
async function state(r:string){return (await db.query<any>('select public.get_group_state($1) as s',[r])).rows[0].s}
async function propose(r:string,mode='team',candidate:string|null=b){return (await db.query<any>("select public.propose_group_mode($1,gen_random_uuid(),$2,$3,'managers') as id",[r,mode,candidate])).rows[0].id}
async function vote(p:string,agree=true,owner=false){return (await db.query<any>('select public.vote_group_mode($1,$2,$3) as status',[p,agree,owner])).rows[0].status}
async function historyProposal(r:string){return (await db.query<any>('select public.propose_history_invitation($1,gen_random_uuid(),array[$2::uuid]) as id',[r,c])).rows[0].id}
async function historyVote(p:string,agree=true){return (await db.query<any>('select public.vote_history_invitation($1,$2) as s',[p,agree])).rows[0].s}
async function finish(p:string,cancel=false){return (await db.query<any>('select public.finish_history_invitation($1,$2) as s',[p,cancel])).rows[0].s}
it('grants only the approved invitees old messages, files and posts after unanimous consent and explicit owner completion',async()=>{
 const r=await group('team',[b]);
 const old=(await db.query<any>("select * from public.send_message($1,'before admission',gen_random_uuid())",[r])).rows[0];
 const attachment='10000000-0000-0000-0000-000000000081';
 await db.query('select public.prepare_attachment($1,$2,$3,123,$4)',[r,attachment,'old.png','image/png']);
 const path='files/'+attachment+'/'+attachment+'/manifest.json',receipt=createHmac('sha256',Buffer.from('ab'.repeat(32),'hex')).update(attachment+':123:'+path).digest('hex');
 await db.query('select public.send_r2_attachment($1,$2,$3)',[attachment,path,receipt]);
 const post=(await db.query<any>("select * from public.save_room_post(gen_random_uuid(),$1,'notice','old content',array[$2::uuid],true,null)",[r,attachment])).rows[0];
 const p=await historyProposal(r);expect(await historyVote(p)).toBe('pending');await expect(finish(p)).rejects.toThrow(/전원/);
 await asUser(c);expect((await db.query('select * from public.messages where id=$1',[old.id])).rows).toHaveLength(0);await expect(historyVote(p)).rejects.toThrow(/권한/);
 await asUser(b);expect(await historyVote(p)).toBe('approved');await expect(finish(p)).rejects.toThrow(/방장/);
 await asUser(c);expect((await db.query('select * from public.chat_attachments where id=$1',[attachment])).rows).toHaveLength(0);
 await asUser(a);expect(await finish(p)).toBe('accepted');expect(await finish(p)).toBe('accepted');
 await asUser(c);expect((await db.query('select * from public.messages where id=$1',[old.id])).rows).toHaveLength(1);expect((await db.query('select * from public.chat_attachments where id=$1',[attachment])).rows).toHaveLength(1);expect((await db.query('select * from public.room_posts where id=$1',[post.id])).rows).toHaveLength(1);
 const member=(await state(r)).members.find((m:any)=>m.id===c);expect(Number(member.joined_sequence)).toBeGreaterThan(Number(old.sequence));expect(member.read_sequence).toBe(member.joined_sequence);
 await db.exec('reset role');await db.query('update public.chat_attachments set original_deleted_at=now() where id=$1',[attachment]);await asUser(c);expect((await db.query<any>('select original_deleted_at from public.chat_attachments where id=$1',[attachment])).rows[0].original_deleted_at).toBeTruthy();
 await db.query('select public.leave_group_chat($1)',[r]);await asUser(a);await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);await asUser(c);expect((await db.query('select * from public.messages where id=$1',[old.id])).rows).toHaveLength(0);
});
it('preserves default late-join restrictions and denies ordinary members, direct-table bypasses and regular rooms',async()=>{
 const r=await group('team',[b]);await db.query("select public.send_message($1,'old',gen_random_uuid())",[r]);
 await asUser(b);await expect(historyProposal(r)).rejects.toThrow(/방장/);await expect(db.query('select * from public.room_history_votes')).rejects.toThrow(/permission/);await expect(db.query('update public.chat_members set visible_after_sequence=0 where room_id=$1',[r])).rejects.toThrow();
 await asUser(a);await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);await asUser(c);expect((await db.query('select * from public.messages where room_id=$1',[r])).rows).toHaveLength(0);
 const regular=await group('regular',[b]);await expect(historyProposal(regular)).rejects.toThrow(/팀채팅/);
});
it('rejects cancelled, rejected and expired grants and keeps repeat ballots idempotent',async()=>{
 const r=await group('team',[b]),p=await historyProposal(r);expect(await historyVote(p)).toBe('pending');expect(await historyVote(p)).toBe('pending');expect((await state(r)).history_proposal.agreed).toBe(1);
 await asUser(b);expect(await historyVote(p,false)).toBe('rejected');await asUser(a);expect(await finish(p)).toBe('rejected');await expect(historyProposal(r)).rejects.toThrow(/24시간/);
 const r2=await group('team',[b]),p2=await historyProposal(r2);expect(await finish(p2,true)).toBe('cancelled');expect(await historyVote(p2)).toBe('cancelled');
 const r3=await group('team',[b]),p3=await historyProposal(r3);await historyVote(p3);await asUser(b);await historyVote(p3);await db.exec('reset role');await db.query("update public.room_history_proposals set expires_at=now()-interval '1 second' where id=$1",[p3]);await asUser(a);expect(await finish(p3)).toBe('expired');expect((await state(r3)).members).toHaveLength(2);
});
it('invalidates approval on accepted ownership transfer, membership or policy changes',async()=>{
 const r=await group('team',[b]),p=await historyProposal(r);await historyVote(p);await asUser(b);await historyVote(p);await asUser(a);await db.query("select public.manage_team($1,'offer_owner',$2)",[r,b]);expect((await state(r)).history_proposal.status).toBe('invalidated');await asUser(b);await db.query("select public.manage_team($1,'accept_owner')",[r]);expect((await state(r)).owner_id).toBe(b);await asUser(a);await expect(finish(p)).rejects.toThrow(/방장/);
 const r2=await group('team',[b]),p2=await historyProposal(r2);await historyVote(p2);await db.query("select public.manage_team($1,'policy',null,'all')",[r2]);expect((await state(r2)).history_proposal.status).toBe('invalidated');
 const r3=await group('team',[b]),p3=await historyProposal(r3);await asUser(b);await db.query('select public.leave_group_chat($1)',[r3]);await asUser(a);expect(await finish(p3)).toBe('invalidated');
});
it('rechecks friendships and rolls back failed final invitations without widening access',async()=>{
 const r=await group('team',[b]),p=await historyProposal(r);await historyVote(p);await asUser(b);await historyVote(p);await db.exec('reset role');await db.query("update public.friendships set status='rejected' where low_id=$1 and high_id=$2",[a,c]);await asUser(a);await expect(finish(p)).rejects.toThrow(/친구/);expect((await state(r)).history_proposal.status).toBe('approved');expect((await state(r)).members).toHaveLength(2);
 await db.exec('reset role');await db.query("update public.friendships set status='accepted' where low_id=$1 and high_id=$2",[a,c]);
});
