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
 await db.exec(readFileSync(new URL('../migrations/0025_workspace.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0026_spaces.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../migrations/0027_page_blocks.sql',import.meta.url),'utf8'));
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});



async function group(mode='regular',users=[b,c]){await asUser(a);return (await db.query<any>('select public.create_group_with_mode(gen_random_uuid(),$1,$2::uuid[],$3) as id',['team test',users,mode])).rows[0].id}
async function state(r:string){return (await db.query<any>('select public.get_group_state($1) as s',[r])).rows[0].s}
async function propose(r:string,mode='team',candidate:string|null=b){return (await db.query<any>("select public.propose_group_mode($1,gen_random_uuid(),$2,$3,'managers') as id",[r,mode,candidate])).rows[0].id}
async function vote(p:string,agree=true,owner=false){return (await db.query<any>('select public.vote_group_mode($1,$2,$3) as status',[p,agree,owner])).rows[0].status}
async function toolsState(r:string){return (await db.query<any>('select public.get_room_tools($1) as s',[r])).rows[0].s}

async function create(kind='note'){const id=crypto.randomUUID();await db.query('select public.workspace_create($1,$2,$3,$4)',[id,kind,'Document',kind==='event'?{start:'2026-11-16T10:00',end:'2026-11-16T11:00'}:{}]);return id}
async function doc(id:string,r:string|null=null){return (await db.query<any>('select public.workspace_get($1,$2) s',[id,r])).rows[0].s}
it('enforces sharing, room history, revocation and preserves original data',async()=>{
 const r=await group('team',[b]);const n=await create();await db.query("select public.workspace_share($1,$2,'read')",[n,r]);await asUser(b);expect((await doc(n,r)).permission).toBe(1);await expect(db.query("select public.workspace_save($1,1,'bad','{}')",[n])).rejects.toThrow(/권한/);await expect(db.query("select * from public.workspace_items")).rejects.toThrow(/permission/);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'edit')",[n,r]);await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);await asUser(c);await expect(doc(n,r)).rejects.toThrow(/권한/);
 await asUser(b);const d=await doc(n,r);await db.query("select public.workspace_save($1,$2,'Changed','{}')",[n,d.item.version]);await asUser(a);await db.query("select public.workspace_share($1,$2,'read',true)",[n,r]);await asUser(b);await expect(doc(n,r)).rejects.toThrow(/권한/);await asUser(a);expect((await doc(n)).item.title).toBe('Changed');
});
it('handles independent blocks, same-block conflicts, permanent history and restore',async()=>{
 await asUser(a);const n=await create(),x=crypto.randomUUID(),y=crypto.randomUUID();await db.query("select public.note_block_save($1,$2,0,'text',$3)",[n,x,{text:'one'}]);await db.query("select public.note_block_save($1,$2,0,'text',$3)",[n,y,{text:'two'}]);await db.query("select public.note_block_save($1,$2,1,'text',$3)",[n,x,{text:'edited'}]);await expect(db.query("select public.note_block_save($1,$2,1,'text',$3)",[n,x,{text:'lost'}])).rejects.toThrow(/충돌/);
 let d=await doc(n);expect(d.blocks).toHaveLength(2);expect(d.history).toHaveLength(4);await db.query('select public.workspace_restore($1,$2,$3)',[n,d.history[1].id,d.item.version]);d=await doc(n);expect(d.blocks[0].content.text).toBe('one');expect(d.history).toHaveLength(5);
 await db.query('select public.workspace_trash($1,$2,true)',[n,d.item.version]);d=await doc(n);expect(d.item.trashed).toBe(true);await db.query('select public.workspace_trash($1,$2,false)',[n,d.item.version]);expect((await doc(n)).history).toHaveLength(7);
});
it('isolates room comments and prevents forged authors and cross-room replies',async()=>{
 const r=await group('team',[b]);const n=await create();await db.query("select public.workspace_share($1,$2,'comment')",[n,r]);await asUser(b);const cmt=crypto.randomUUID();await db.query("select public.workspace_comment($1,$2,$3,'hello')",[n,r,cmt]);expect((await doc(n,r)).comments).toHaveLength(1);await asUser(a);expect((await doc(n)).comments).toHaveLength(0);await expect(db.query("select public.workspace_comment($1,$2,$3,'forged',1)",[n,r,cmt])).rejects.toThrow(/작성자/);
});
it('retains past calendar events and validates edit versions',async()=>{
 await asUser(a);const n=await create('event'),d=await doc(n);await db.query('select public.workspace_save($1,$2,$3,$4)',[n,d.item.version,'Past event',{start:'2020-01-01T10:00',end:'2020-01-01T11:00',cancelled:true}]);expect((await doc(n)).item.body.cancelled).toBe(true);await expect(db.query('select public.workspace_save($1,$2,$3,$4)',[n,d.item.version,'stale',{}])).rejects.toThrow(/다른 수정/);
});

it('creates an empty space with one canonical chat and retains space documents after author leaves',async()=>{
 await asUser(a);const r=(await db.query<any>("select public.create_space(gen_random_uuid(),'Space',array[]::uuid[]) id")).rows[0].id;
 await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,b]);await asUser(b);const n=crypto.randomUUID();await db.query("select public.create_space_item($1,'note','Shared','{}',$2)",[n,r]);await db.query('select public.leave_group_chat($1)',[r]);await expect(doc(n,r)).rejects.toThrow(/권한/);await asUser(a);expect((await doc(n,r)).permission).toBe(4);
 await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);await asUser(c);expect((await doc(n,r)).permission).toBe(2);expect((await doc(n,r)).history).toHaveLength(0);
});

it('rejects malformed calendar and table content and keeps comment revisions',async()=>{
 await asUser(a);await expect(db.query("select public.workspace_create(gen_random_uuid(),'event','invalid','{}')")).rejects.toThrow(/일정/);
 const n=await create();await expect(db.query("select public.note_block_save($1,gen_random_uuid(),0,'table','{\"rows\":42}')",[n])).rejects.toThrow(/표/);
 const cmt=crypto.randomUUID();await db.query("select public.workspace_comment($1,null,$2,'first')",[n,cmt]);await db.query("select public.workspace_comment($1,null,$2,'second',1)",[n,cmt]);const h=(await db.query<any>('select public.workspace_comment_revisions($1) h',[cmt])).rows[0].h;expect(h.map((v:any)=>v.body)).toEqual(['second','first']);
});
it('prevents permission escalation and keeps a space copy independent from the original',async()=>{
 await asUser(a);const r=(await db.query<any>("select public.create_space(gen_random_uuid(),'Copy space',array[]::uuid[]) id")).rows[0].id;
 await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,b]);const n=await create(),copy=crypto.randomUUID();await db.query('select public.workspace_copy($1,$2,$3)',[n,copy,r]);let d=await doc(copy,r);await db.query('select public.workspace_save($1,$2,$3,$4)',[copy,d.item.version,'Space copy',{allow_edit:true}]);await asUser(b);d=await doc(copy,r);expect(d.permission).toBe(3);await expect(db.query('select public.workspace_save($1,$2,$3,$4)',[copy,d.item.version,'Escalation',{allow_edit:false}])).rejects.toThrow(/관리자/);await db.query('select public.workspace_save($1,$2,$3,$4)',[copy,d.item.version,'Edited',{allow_edit:true}]);await asUser(a);expect((await doc(n)).item.title).toBe('Document');await expect(db.query("select public.workspace_share($1,$2,'read')",[copy,r])).rejects.toThrow(/공간 소유/);
});

it('inserts adjacent blocks and preserves IDs and history',async()=>{await asUser(a);const n=await create(),x=crypto.randomUUID(),y=crypto.randomUUID(),z=crypto.randomUUID();await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[n,x,{text:'first'}]);await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[n,y,{text:'last'}]);await db.query("select public.page_block_insert($1,$2,$3,'heading',$4)",[n,z,x,{text:'middle'}]);const d=await doc(n);expect(d.blocks.map((v:any)=>v.id)).toEqual([x,z,y]);const h=(await db.query<any>('select public.workspace_history_view($1,$2) h',[n,d.history[0].id])).rows[0].h;expect(h.blocks.map((v:any)=>v.id)).toEqual([x,z,y]);await asUser(b);await expect(db.query("select public.page_block_insert($1,gen_random_uuid(),null,'text',$2)",[n,{text:'bad'}])).rejects.toThrow(/권한/);});
