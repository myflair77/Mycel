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
 await db.exec(readFileSync(new URL('../migrations/0028_page_interactions.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0029_page_document.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0030_personal_conversations.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0034_resource_reads.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0035_resource_message_links.sql',import.meta.url),'utf8'));
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});
async function unread(r:string|null){return (await db.query<any>('select public.workspace_unread($1) as items',[r])).rows[0].items as {id:string;kind:string;version:number}[]}
async function get(id:string,r:string|null){return (await db.query<any>('select public.workspace_get($1,$2) as doc',[id,r])).rows[0].doc}
async function mark(id:string,v:number,r:string|null){return db.query('select public.workspace_mark_read($1,$2,$3)',[id,v,r])}
it('counts each unseen item once and persists exact read versions without clearing later edits',async()=>{
 await asUser(a);const n=crypto.randomUUID();await db.query("select public.create_space_item($1,'note','Note','{\"allow_edit\":true}',$2)",[n,room]);
 expect((await unread(room)).some(i=>i.id===n)).toBe(false);
 await asUser(b);expect((await unread(room)).filter(i=>i.id===n)).toHaveLength(1);const initial=await get(n,room);
 // Opening through the ordinary RPC alone does not acknowledge background/API reads.
 expect((await unread(room)).some(i=>i.id===n)).toBe(true);
 await asUser(a);await db.query("select public.workspace_save($1,$2,'Changed',$3)",[n,initial.item.version,initial.item.body]);
 await asUser(b);await mark(n,initial.item.version,room);expect((await unread(room)).some(i=>i.id===n)).toBe(true);
 const next=await get(n,room);await mark(n,next.item.version,room);await mark(n,initial.item.version,room);expect((await unread(room)).some(i=>i.id===n)).toBe(false);
 await asUser(a);await asUser(b);expect((await unread(room)).some(i=>i.id===n)).toBe(false);
 await expect(mark(n,999,room)).rejects.toThrow(/버전/);
 // Own edit is not an unread alert for the author, but is one for the other participant.
 await db.query("select public.workspace_save($1,$2,'Bob edit',$3)",[n,next.item.version,next.item.body]);expect((await unread(room)).some(i=>i.id===n)).toBe(false);
 await asUser(a);expect((await unread(room)).filter(i=>i.id===n)).toHaveLength(1);
});
it('separates accounts/scopes and excludes inaccessible or trashed resources',async()=>{
 await asUser(a);const n=crypto.randomUUID();await db.query("select public.workspace_create($1,'event','Event',$2)",[n,{start:'2026-11-22T09:00',end:'2026-11-22T10:00'}]);
 await db.query("select public.workspace_share($1,$2,'read')",[n,room]);
 await asUser(b);expect((await unread(room)).some(i=>i.id===n)).toBe(true);expect((await unread(null)).some(i=>i.id===n)).toBe(false);
 await db.query('select public.workspace_library_set($1,true)',[n]);const d=await get(n,room);await mark(n,d.item.version,room);
 expect((await unread(null)).some(i=>i.id===n)).toBe(true);await mark(n,d.item.version,null);expect((await unread(null)).some(i=>i.id===n)).toBe(false);
 await asUser(c);expect((await unread(room)).some(i=>i.id===n)).toBe(false);await expect(mark(n,d.item.version,room)).rejects.toThrow(/권한/);
 await asUser(a);await db.query('select public.workspace_trash($1,$2,true)',[n,d.item.version]);await asUser(b);expect((await unread(room)).some(i=>i.id===n)).toBe(false);
 await expect(db.query('select * from public.workspace_reads')).rejects.toThrow(/permission/);
 await db.exec('reset role;set role anon');await expect(db.query('select public.workspace_unread(null)')).rejects.toThrow(/permission/);
});
it('does not disclose shared items to participants joining after their share sequence',async()=>{
 await asUser(a);const r=(await db.query<any>("select public.create_group_with_mode(gen_random_uuid(),'Room',array[$1::uuid],'regular') as id",[b])).rows[0].id;
 const n=crypto.randomUUID();await db.query("select public.workspace_create($1,'note','Private until shared','{}')",[n]);await db.query("select public.workspace_share($1,$2,'read')",[n,r]);await db.query('select public.invite_group_members($1,array[$2::uuid])',[r,c]);
 await asUser(c);expect(await unread(r)).toEqual([]);await expect(mark(n,1,r)).rejects.toThrow(/권한/);
 await asUser(b);expect((await unread(r)).some(i=>i.id===n)).toBe(true);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'read',true)",[n,r]);await asUser(b);expect(await unread(r)).toEqual([]);
});

it('links original shares and copied notes to the exact document and preserves permissions',async()=>{
 await asUser(a);const n=crypto.randomUUID(),copy=crypto.randomUUID();await db.query("select public.workspace_create($1,'note','Linked note','{}')",[n]);await db.query("select public.workspace_share($1,$2,'read')",[n,room]);
 let m=(await db.query<any>('select * from public.messages where room_id=$1 and workspace_item_id=$2',[room,n])).rows;expect(m).toHaveLength(1);expect(m[0].workspace_item_kind).toBe('note');
 await db.query('select public.workspace_copy_with_link($1,$2,$3)',[n,copy,room]);await db.query('select public.workspace_copy_with_link($1,$2,$3)',[n,copy,room]);
 m=(await db.query<any>('select * from public.messages where room_id=$1 and workspace_item_id=$2',[room,copy])).rows;expect(m).toHaveLength(1);
 await asUser(b);expect((await get(n,room)).permission).toBe(1);expect((await get(copy,room)).item.title).toContain('Linked note');
 await asUser(a);await db.query("select public.workspace_share($1,$2,'read',true)",[n,room]);await asUser(b);await expect(get(n,room)).rejects.toThrow(/권한/);
});

it('enforces all three sharing levels on independent copies, including regular-room members',async()=>{
 await asUser(a);const n=crypto.randomUUID();await db.query("select public.workspace_create($1,'note','Original','{}')",[n]);
 for(const [permission,level] of [['read',1],['comment',2],['edit',3]] as const){await asUser(a);const copy=crypto.randomUUID();await db.query('select public.workspace_copy_with_link($1,$2,$3,$4)',[n,copy,room,permission]);await asUser(b);const d=await get(copy,room);expect(d.permission).toBe(level);
 const comment=()=>db.query("select public.workspace_comment($1,$2,gen_random_uuid(),'Comment')",[copy,room]);const edit=()=>db.query("select public.workspace_save($1,$2,'Edited','{}')",[copy,d.item.version]);
 if(level===1)await expect(comment()).rejects.toThrow(/권한/);else await comment();if(level<3)await expect(edit()).rejects.toThrow(/권한/);else await edit();
 }
});
