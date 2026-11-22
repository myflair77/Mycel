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
 await db.exec(readFileSync(new URL('../migrations/0036_child_notes.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0037_note_files.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0038_synced_blocks.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0039_block_actions.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0040_note_mentions.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../migrations/0041_mention_notifications.sql',import.meta.url),'utf8'));
 await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted'),($2,$3,$2,'accepted')",[a,b,c]);
},30000);
afterAll(async()=>{await db?.close()});
async function unread(r:string|null){return (await db.query<any>('select public.workspace_unread($1) as items',[r])).rows[0].items as {id:string;kind:string;version:number}[]}
async function get(id:string,r:string|null){return (await db.query<any>('select public.workspace_get($1,$2) as doc',[id,r])).rows[0].doc}
async function mark(id:string,v:number,r:string|null){return db.query('select public.workspace_mark_read($1,$2,$3)',[id,v,r])}

const childBlocks=(id:string,block=crypto.randomUUID())=>[{id:block,kind:'text',content:{text:'하위 노트',_rich:{type:'childNote',attrs:{id:block,noteId:id}}}}];
it('creates atomically, retries once, inherits revocation, preserves tree copies and trash batches',async()=>{
 await asUser(a);const root=crypto.randomUUID(),child=crypto.randomUUID(),grand=crypto.randomUUID();
 await db.query("select public.create_space_item($1,'note','Root','{}',null)",[root]);
 await db.query("select public.workspace_share($1,$2,'edit')",[root,room]);
 await asUser(b);const rootDoc=await get(root,room),blocks=childBlocks(child);
 const create=()=>db.query<any>('select public.workspace_child_create($1,$2,$3,$4) v',[root,child,rootDoc.item.version,blocks]);
 const v=(await create()).rows[0].v;expect((await create()).rows[0].v).toBe(v);
 expect((await get(child,room)).permission).toBe(3);
 expect((await get(child,room)).ancestors.map((x:any)=>x.id)).toEqual([root]);
 await expect(db.query("select public.workspace_share($1,$2,'edit')",[child,room])).rejects.toThrow(/상위/);
 await db.query('select public.workspace_child_create($1,$2,$3,$4)',[child,grand,1,childBlocks(grand)]);
 await expect(db.query('select public.workspace_child_move($1,$2,$3)',[child,grand,2])).rejects.toThrow(/자기 자신/);
 const copy=crypto.randomUUID();await db.query('select public.workspace_copy($1,$2,null)',[root,copy]);
 const copied=await get(copy,null),copiedChild=copied.children[0].id;expect(copiedChild).not.toBe(child);expect(copied.blocks[0].content._rich.attrs.noteId).toBe(copiedChild);expect((await get(copiedChild,null)).permission).toBe(4);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'edit',true)",[root,room]);
 await asUser(b);await expect(get(child,room)).rejects.toThrow(/접근/);await expect(get(grand,room)).rejects.toThrow(/접근/);expect((await get(copy,null)).permission).toBe(4);
 await asUser(a);let d=await get(grand,null);await db.query('select public.workspace_trash($1,$2,true)',[grand,d.item.version]);d=await get(root,null);await db.query('select public.workspace_trash($1,$2,true)',[root,d.item.version]);d=await get(root,null);await db.query('select public.workspace_trash($1,$2,false)',[root,d.item.version]);expect((await get(child,null)).item.trashed).toBe(false);expect((await get(grand,null)).item.trashed).toBe(true);
 const bad=crypto.randomUUID();await expect(db.query('select public.workspace_child_create($1,$2,$3,$4)',[root,bad,0,childBlocks(bad)])).rejects.toThrow(/変更|변경/);await expect(get(bad,null)).rejects.toThrow(/접근/);
 await db.exec('reset role;set role authenticated');await expect(db.query('select * from public.note_file_links')).rejects.toThrow(/permission/);
});
it('keeps note files private until receipt, inherits access, and copied files survive original revocation',async()=>{
 await asUser(a);const root=crypto.randomUUID(),file=crypto.randomUUID();await db.query("select public.create_space_item($1,'note','Files','{}',null)",[root]);
 await db.query('select public.prepare_note_file($1,$2,$3,12,$4)',[root,file,'test.png','image/png']);await db.query("select public.workspace_share($1,$2,'read')",[root,room]);
 await asUser(b);await expect(db.query('select public.get_note_file($1,$2)',[root,file])).rejects.toThrow(/완료/);await expect(db.query('select public.prepare_note_file($1,$2,$3,12,$4)',[root,crypto.randomUUID(),'bad.png','image/png'])).rejects.toThrow(/편집/);
 await asUser(a);const key='notes/'+file+'/'+file+'/manifest.json',receipt=createHmac('sha256',Buffer.from('ab'.repeat(32),'hex')).update(file+':12:'+key).digest('hex');
 await expect(db.query('select public.finish_note_file($1,$2,$3,$4)',[root,file,key,'bad'])).rejects.toThrow(/검증/);await db.query('select public.finish_note_file($1,$2,$3,$4)',[root,file,key,receipt]);
 await asUser(b);expect((await db.query<any>('select public.get_note_file($1,$2) f',[root,file])).rows[0].f.r2_key).toBe(key);const copy=crypto.randomUUID();await db.query('select public.workspace_copy($1,$2,null)',[root,copy]);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'read',true)",[root,room]);await asUser(b);await expect(db.query('select public.get_note_file($1,$2)',[root,file])).rejects.toThrow(/접근/);expect((await db.query<any>('select public.get_note_file($1,$2) f',[copy,file])).rows[0].f.r2_key).toBe(key);
 await asUser(c);await expect(db.query('select public.get_note_file($1,$2)',[copy,file])).rejects.toThrow(/접근/);
});

it('shares synchronized content with dual permissions, idempotency, permanent history and conflict protection',async()=>{
 await asUser(a);const source=crypto.randomUUID(),target=crypto.randomUUID(),sync=crypto.randomUUID(),blockId=crypto.randomUUID();
 await db.query("select public.create_space_item($1,'note','Sync source','{}',null)",[source]);await db.query("select public.create_space_item($1,'note','Sync target','{}',null)",[target]);
 const doc=(text:string)=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
 const blocks=[{id:blockId,kind:'text',content:{text:'동기화 블록',_rich:{type:'syncedBlock',attrs:{id:blockId,syncId:sync}}}}];
 await db.query('select public.note_sync_create($1,$2,1,$3,$4)',[source,sync,blocks,doc('Original')]);
 await db.query('select public.note_sync_link($1,$2)',[target,sync]);
 const mutation=crypto.randomUUID();await db.query('select public.note_sync_save($1,$2,1,$3,$4)',[target,sync,mutation,doc('Changed')]);await db.query('select public.note_sync_save($1,$2,1,$3,$4)',[target,sync,mutation,doc('Changed')]);
 expect((await db.query<any>('select public.note_sync_get($1,$2) s',[source,sync])).rows[0].s.content).toEqual(doc('Changed'));
 await expect(db.query('select public.note_sync_save($1,$2,1,$3,$4)',[source,sync,crypto.randomUUID(),doc('Stale')])).rejects.toThrow(/다른 곳/);
 expect((await db.query<any>('select public.note_sync_history($1,$2) h',[source,sync])).rows[0].h).toHaveLength(2);
 await db.query("select public.workspace_share($1,$2,'edit')",[target,room]);await asUser(b);await expect(db.query('select public.note_sync_get($1,$2)',[target,sync])).rejects.toThrow(/권한/);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'read')",[source,room]);await asUser(b);expect((await db.query<any>('select public.note_sync_get($1,$2) s',[target,sync])).rows[0].s.permission).toBe(1);
 await expect(db.query('select public.note_sync_save($1,$2,2,$3,$4)',[target,sync,crypto.randomUUID(),doc('Denied')])).rejects.toThrow(/권한/);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'read',true)",[source,room]);await asUser(b);await expect(db.query('select public.note_sync_get($1,$2)',[target,sync])).rejects.toThrow(/권한/);
 await asUser(a);await expect(db.query('select public.note_sync_save($1,$2,2,$3,$4)',[target,sync,crypto.randomUUID(),{type:'doc',content:[{type:'syncedBlock',attrs:{syncId:sync}}]}])).rejects.toThrow(/다른 동기화/);
 const copy=crypto.randomUUID();await db.query('select public.workspace_copy($1,$2,null)',[source,copy]);expect((await db.query<any>('select public.note_sync_get($1,$2) s',[copy,sync])).rows[0].s.content).toEqual(doc('Changed'));
});

it('stamps real block edits and moves atomically with file links, durable identity and replay protection',async()=>{
 await asUser(a);const source=crypto.randomUUID(),target=crypto.randomUUID(),block=crypto.randomUUID(),file=crypto.randomUUID(),mutation=crypto.randomUUID();
 for(const id of [source,target])await db.query("select public.create_space_item($1,'note','Move test','{}',null)",[id]);
 await db.query("select public.prepare_note_file($1,$2,'photo.png',10,'image/png')",[source,file]);
 const blocks=[{id:block,kind:'text',content:{text:'photo',_rich:{type:'noteFile',attrs:{id:block,fileId:file,mime:'image/png'}}}}];
 await db.query('select public.page_document_save($1,1,$2,$3)',[source,crypto.randomUUID(),blocks]);
 const info=async()=> (await db.query<any>('select public.page_block_info($1) i',[block])).rows[0].i;
 const first=await info();expect(first.editor).toBe('alice');expect(first.edited_at).toBeTruthy();
 await db.query('select public.page_document_save($1,2,$2,$3)',[source,crypto.randomUUID(),blocks]);expect((await info()).edited_at).toEqual(first.edited_at);
 await asUser(b);await expect(db.query('select public.page_block_info($1)',[block])).rejects.toThrow(/권한/);
 await expect(db.query('select public.page_block_move($1,$2,$3,3,1,$4)',[source,target,block,mutation])).rejects.toThrow(/권한/);
 await asUser(a);await expect(db.query('select public.page_block_move($1,$2,$3,2,1,$4)',[source,target,block,mutation])).rejects.toThrow(/다른 수정/);
 expect((await get(source,null)).blocks).toHaveLength(1);expect((await get(target,null)).blocks).toHaveLength(0);
 const move=()=>db.query('select public.page_block_move($1,$2,$3,3,1,$4)',[source,target,block,mutation]);await move();await move();
 expect((await get(source,null)).blocks).toHaveLength(0);expect((await get(target,null)).blocks[0].id).toBe(block);expect((await info()).note_id).toBe(target);expect((await info()).edited_at).toEqual(first.edited_at);
 expect((await db.query<any>('select public.get_note_file($1,$2) f',[target,file])).rows[0].f.id).toBe(file);
 blocks[0].content._rich.attrs={...blocks[0].content._rich.attrs,width:60} as any;await db.query('select public.page_document_save($1,2,$2,$3)',[target,crypto.randomUUID(),blocks]);expect((await info()).edited_at).not.toEqual(first.edited_at);
});
it('does not broaden comment audiences during a block move',async()=>{
 await asUser(a);const source=crypto.randomUUID(),target=crypto.randomUUID(),block=crypto.randomUUID();for(const id of [source,target])await db.query("select public.create_space_item($1,'note','Comment move','{}',null)",[id]);
 await db.query('select public.page_document_save($1,1,$2,$3)',[source,crypto.randomUUID(),[{id:block,kind:'text',content:{text:'Commented'}}]]);
 await db.query('select public.workspace_comment($1,null,$2,$3,0,null,$4,false,false)',[source,crypto.randomUUID(),'Private comment',block]);
 const src=await get(source,null);await expect(db.query('select public.page_block_move($1,$2,$3,$4,1,$5)',[source,target,block,src.item.version,crypto.randomUUID()])).rejects.toThrow(/공개 범위/);expect((await get(source,null)).blocks).toHaveLength(1);expect((await get(target,null)).blocks).toHaveLength(0);
});

it('limits mention candidates to the note publication and current members',async()=>{
 await asUser(a);const root=crypto.randomUUID(),other=crypto.randomUUID(),child=crypto.randomUUID();
 await db.query("select public.create_space_item($1,'note','Mention root','{}',null)",[root]);
 await db.query("select public.create_space_item($1,'note','Secret other','{}',null)",[other]);
 await db.query("select public.workspace_share($1,$2,'edit')",[root,room]);
 const before=await get(root,room);await db.query('select public.workspace_child_create($1,$2,$3,$4)',[root,child,before.item.version,childBlocks(child)]);
 const lookup=async(note:string,r:string|null,q='')=>(await db.query<any>('select public.page_mention_targets($1,$2,$3) as d',[note,r,q])).rows[0].d;
 const results=await lookup(child,room);expect(results.people.map((x:any)=>x.id).sort()).toEqual([a,b]);expect(results.notes.map((x:any)=>x.id)).toEqual(expect.arrayContaining([root,child]));expect(results.notes.map((x:any)=>x.id)).not.toContain(other);
 await expect(lookup(other,room)).rejects.toThrow(/공간/);
 await asUser(c);await expect(lookup(root,room)).rejects.toThrow(/권한/);
 await asUser(b);expect((await lookup(root,room,'Mention')).notes.map((x:any)=>x.id)).toEqual([root]);
 await asUser(a);await db.query("select public.workspace_share($1,$2,'edit',true)",[root,room]);await asUser(b);await expect(lookup(root,room)).rejects.toThrow(/권한/);
 await db.exec('reset role;set role anon');await expect(db.query('select public.page_mention_targets($1)',[root])).rejects.toThrow(/permission denied/);
});

const mentionBlock=(block:string,mid:string,target=b,scope=room)=>[{id:block,kind:'text',content:{text:'@bob',_rich:{type:'paragraph',attrs:{id:block},content:[{type:'pageMention',attrs:{kind:'person',target,label:'bob',mentionId:mid,roomId:scope}}]}}}];
it('notifies once after a saved mention, resolves current position, and isolates inboxes',async()=>{
 await asUser(a);const note=crypto.randomUUID(),block=crypto.randomUUID(),mid=crypto.randomUUID(),mutation=crypto.randomUUID();
 await db.query("select create_space_item($1,'note','Mention note','{}',null)",[note]);await db.query("select workspace_share($1,$2,'read')",[note,room]);
 const doc=await get(note,room);const blocks=mentionBlock(block,mid);
 const save=()=>db.query('select page_document_save($1,$2,$3,$4)',[note,doc.item.version,mutation,blocks]);await save();await save();
 await asUser(b);let inbox=(await db.query<any>('select note_mentions_inbox() v')).rows[0].v;expect(inbox.filter((x:any)=>x.id===mid)).toHaveLength(1);expect(inbox.find((x:any)=>x.id===mid).read_at).toBeNull();
 const opened=(await db.query<any>('select note_mention_open($1)v',[mid])).rows[0].v;expect(opened).toMatchObject({note_id:note,room_id:room,block_id:block,mention_id:mid});
 await asUser(c);expect((await db.query<any>('select note_mentions_inbox() v')).rows[0].v).not.toContainEqual(expect.objectContaining({id:mid}));await expect(db.query('select note_mention_open($1)',[mid])).rejects.toThrow(/권한/);
 await asUser(a);const now=await get(note,room);await db.query('select page_document_save($1,$2,$3,$4)',[note,now.item.version,crypto.randomUUID(),[]]);await asUser(b);await expect(db.query('select note_mention_open($1)',[mid])).rejects.toThrow(/삭제/);
});
it('rejects forged recipients/scopes and stale saves without generating notifications',async()=>{
 await asUser(a);const note=crypto.randomUUID(),block=crypto.randomUUID(),mid=crypto.randomUUID();await db.query("select create_space_item($1,'note','Scope','{}',null)",[note]);await db.query("select workspace_share($1,$2,'read')",[note,room]);const doc=await get(note,room);
 await expect(db.query('select page_document_save($1,999,$2,$3)',[note,crypto.randomUUID(),mentionBlock(block,mid)])).rejects.toThrow();
 await db.query('select page_document_save($1,$2,$3,$4)',[note,doc.item.version,crypto.randomUUID(),mentionBlock(block,mid,c)]);
 await asUser(c);expect((await db.query<any>('select note_mentions_inbox() v')).rows[0].v.some((x:any)=>x.id===mid)).toBe(false);
 await asUser(a);expect((await db.query<any>('select auth.uid() v')).rows[0].v).toBe(a);
 await db.exec('reset role');expect((await db.query<any>('select count(*)::int n from note_mention_notifications where id=$1',[mid])).rows[0].n).toBe(0);
 await db.exec('set role anon');await expect(db.query('select note_mentions_inbox()')).rejects.toThrow();await asUser(a);
});
it('queues private mention pushes, cancels after revocation, and restores actor context',async()=>{
 await db.exec('reset role');const device=crypto.randomUUID();await db.query("insert into push_devices(id,user_id,endpoint,p256dh,auth)values($1,$2,'https://fcm.googleapis.com/mention-test','key','auth')",[device,b]);
 await asUser(a);const note=crypto.randomUUID(),block=crypto.randomUUID(),mid=crypto.randomUUID();await db.query("select create_space_item($1,'note','Push','{}',null)",[note]);await db.query("select workspace_share($1,$2,'read')",[note,room]);const doc=await get(note,room);await db.query('select page_document_save($1,$2,$3,$4)',[note,doc.item.version,crypto.randomUUID(),mentionBlock(block,mid)]);expect((await db.query<any>('select auth.uid() v')).rows[0].v).toBe(a);
 await db.exec('reset role;set role service_role');const jobs=(await db.query<any>('select claim_push_jobs() v')).rows[0].v;expect(jobs.find((j:any)=>j.mention_id===mid)).toMatchObject({skip:false,user_id:b});
 await db.exec('reset role');await db.query('delete from workspace_shares where item_id=$1',[note]);await db.query("update push_jobs set next_attempt=now()where mention_id=$1",[mid]);await db.exec('set role service_role');const retry=(await db.query<any>('select claim_push_jobs() v')).rows[0].v;expect(retry.find((j:any)=>j.mention_id===mid).skip).toBe(true);
 await asUser(b);await expect(db.query('select note_mention_open($1)',[mid])).rejects.toThrow(/권한/);await asUser(a);
});
it('notifies synchronized mentions only while the reference and source remain accessible',async()=>{
 await asUser(a);const note=crypto.randomUUID(),sync=crypto.randomUUID(),block=crypto.randomUUID(),mid=crypto.randomUUID();
 await db.query("select create_space_item($1,'note','Synced mention','{}',null)",[note]);await db.query("select workspace_share($1,$2,'read')",[note,room]);const doc=await get(note,room);
 const refs=[{id:block,kind:'text',content:{text:'sync',_rich:{type:'syncedBlock',attrs:{id:block,syncId:sync}}}}];
 await db.query('select note_sync_create($1,$2,$3,$4,$5)',[note,sync,doc.item.version,refs,{type:'doc',content:[{type:'paragraph'}]}]);
 const content={type:'doc',content:[mentionBlock(block,mid)[0].content._rich]},mutation=crypto.randomUUID();
 await db.query('select note_sync_save($1,$2,1,$3,$4)',[note,sync,mutation,content]);await db.query('select note_sync_save($1,$2,1,$3,$4)',[note,sync,mutation,content]);
 await asUser(b);expect((await db.query<any>('select note_mentions_inbox() v')).rows[0].v.filter((n:any)=>n.id===mid)).toHaveLength(1);expect((await db.query<any>('select note_mention_open($1) v',[mid])).rows[0].v.block_id).toBe(block);
 await asUser(a);const latest=await get(note,room);await db.query('select page_document_save($1,$2,$3,$4)',[note,latest.item.version,crypto.randomUUID(),[]]);await asUser(b);await expect(db.query('select note_mention_open($1)',[mid])).rejects.toThrow(/삭제/);
});
it('does not notify self mentions or legacy mentions without a notification identity',async()=>{
 await asUser(a);const note=crypto.randomUUID(),block=crypto.randomUUID(),mid=crypto.randomUUID();await db.query("select create_space_item($1,'note','No surprise notifications','{}',null)",[note]);await db.query("select workspace_share($1,$2,'read')",[note,room]);let doc=await get(note,room);
 await db.query('select page_document_save($1,$2,$3,$4)',[note,doc.item.version,crypto.randomUUID(),mentionBlock(block,mid,a)]);doc=await get(note,room);const legacy=mentionBlock(block,'');await db.query('select page_document_save($1,$2,$3,$4)',[note,doc.item.version,crypto.randomUUID(),legacy]);await db.exec('reset role');expect((await db.query<any>('select count(*)::int n from note_mention_notifications where note_id=$1',[note])).rows[0].n).toBe(0);await asUser(a);
});