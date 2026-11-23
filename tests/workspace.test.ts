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

it('atomically reorders columns and retains quoted comments after text edits',async()=>{
 await asUser(a);const n=await create(),x=crypto.randomUUID(),y=crypto.randomUUID(),comment=crypto.randomUUID();
 await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[n,x,{text:'안녕 😀 함께 일해요'}]);
 await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[n,y,{text:'second'}]);
 let d=await doc(n);const layout={[x]:{group:x,column:0,width:40},[y]:{group:x,column:1,width:60}};
 await db.query('select public.page_block_reorder($1,$2,$3,$4)',[n,d.item.version,[y,x],layout]);
 await expect(db.query('select public.page_block_reorder($1,$2,$3,$4)',[n,d.item.version,[x,y],{}])).rejects.toThrow(/다른 수정/);
 d=await doc(n);expect(d.blocks.map((b:any)=>b.id)).toEqual([y,x]);expect(d.blocks[1].content._layout.width).toBe(40);
 await expect(db.query('select public.page_block_reorder($1,$2,$3,$4)',[n,d.item.version,[x,x],{}])).rejects.toThrow(/목록/);
 await db.query('select public.page_quote_comment($1,null,$2,$3,$4,1,5,7,$5)',[n,comment,'의견입니다',x,'함께']);
 expect((await doc(n)).comments[0].anchor.quote).toBe('함께');
 await db.query("select public.note_block_save($1,$2,1,'text',$3)",[n,x,{text:'수정된 본문'}]);
 expect((await doc(n)).comments[0].anchor.quote).toBe('함께');
 await expect(db.query('select public.page_quote_comment($1,null,gen_random_uuid(),$2,$3,1,5,7,$4)',[n,'stale',x,'함께'])).rejects.toThrow(/변경/);
 await asUser(b);await expect(db.query('select public.page_block_reorder($1,1,$2,$3)',[n,[x,y],{}])).rejects.toThrow(/권한/);
});

it('saves a document atomically, retains comment anchors, IDs, history and retry identity',async()=>{
 await asUser(a);const n=await create(),x=crypto.randomUUID(),y=crypto.randomUUID(),cm=crypto.randomUUID(),mutation=crypto.randomUUID();
 await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[n,x,{text:'앞부분 댓글문장 뒷부분'}]);
 await db.query('select public.page_quote_comment($1,null,$2,$3,$4,1,4,8,$5)',[n,cm,'남겨둘 의견',x,'댓글문장']);
 let d=await doc(n);const input=[{id:x,kind:'text',content:{text:'앞부분 '}},{id:y,kind:'text',content:{text:'댓글문장 뒷부분'}}];
 await db.query('select public.page_document_save($1,$2,$3,$4)',[n,d.item.version,mutation,input]);
 let after=await doc(n);expect(after.blocks.map((b:any)=>b.id)).toEqual([x,y]);expect(after.comments[0].block_id).toBe(y);expect(after.comments[0].anchor.quote).toBe('댓글문장');
 await db.query('select public.page_document_save($1,$2,$3,$4)',[n,d.item.version,mutation,input]);
 expect((await doc(n)).history.length).toBe(after.history.length);
 await expect(db.query('select public.page_document_save($1,$2,gen_random_uuid(),$3)',[n,d.item.version,input])).rejects.toThrow(/다른 수정/);
 await expect(db.query('select public.page_document_save($1,$2,gen_random_uuid(),$3)',[n,after.item.version,[...input,input[0]]])).rejects.toThrow(/중복/);
 expect((await doc(n)).blocks).toEqual(after.blocks);
 await db.query('select public.page_document_save($1,$2,gen_random_uuid(),$3)',[n,after.item.version,[]]);
 after=await doc(n);expect(after.blocks.length).toBe(0);expect(after.comments[0].anchor.quote).toBe('댓글문장');
 await db.query('select public.workspace_restore($1,$2,$3)',[n,after.history[1].id,after.item.version]);expect((await doc(n)).blocks.length).toBe(2);
 await asUser(b);await expect(db.query('select public.page_document_save($1,1,gen_random_uuid(),$2)',[n,[]])).rejects.toThrow(/권한/);
});
it('rejects cross-page IDs and read-only document saves without modifying originals',async()=>{
 await asUser(a);const n=await create(),other=await create(),x=crypto.randomUUID();
 await db.query("select public.page_block_insert($1,$2,null,'text',$3)",[other,x,{text:'keep'}]);
 let d=await doc(n);await expect(db.query('select public.page_document_save($1,$2,gen_random_uuid(),$3)',[n,d.item.version,[{id:x,kind:'text',content:{text:'bad'}}]])).rejects.toThrow(/다른 페이지/);
 expect((await doc(other)).blocks[0].content.text).toBe('keep');
 const r=await group('team',[b]);await db.query("select public.workspace_share($1,$2,'read')",[n,r]);await asUser(b);d=await doc(n,r);
 await expect(db.query('select public.page_document_save($1,$2,gen_random_uuid(),$3)',[n,d.item.version,[]])).rejects.toThrow(/권한/);
});


it('moves resources to conversations without losing data and distinguishes library links from copies',async()=>{
 await db.exec('reset role');await db.exec(readFileSync(new URL('../migrations/0030_personal_conversations.sql',import.meta.url),'utf8'));
 await asUser(a);const resource='10000000-0000-0000-0000-000000000030',copy='10000000-0000-0000-0000-000000000031';
 await db.query("select public.create_space_item($1,'note','대화 페이지','{}',$2)",[resource,room]);
 expect((await db.query<any>('select public.workspace_permission($1) as p',[resource])).rows[0].p).toBe(4);
 await asUser(b);
 const list=async(r:string|null)=>(await db.query<any>("select public.workspace_list('note',$1) as x",[r])).rows[0].x;
 expect((await list(room)).some((x:any)=>x.id===resource)).toBe(true);
 expect((await list(null)).some((x:any)=>x.id===resource)).toBe(false);
 await db.query('select public.workspace_library_set($1,true)',[resource]);
 expect((await list(null)).some((x:any)=>x.id===resource)).toBe(true);
 await db.query('select public.workspace_copy($1,$2,null)',[resource,copy]);
 await db.query('select public.workspace_library_set($1,false)',[resource]);
 expect((await list(null)).some((x:any)=>x.id===resource)).toBe(false);
 expect((await list(null)).some((x:any)=>x.id===copy)).toBe(true);
 await asUser(c);await expect(db.query('select public.workspace_get($1)',[resource])).rejects.toThrow();
 await expect(db.query('select public.workspace_library_set($1,true)',[resource])).rejects.toThrow();
 await asUser(a);await expect(db.query("select public.create_space(gen_random_uuid(),'obsolete','{}')")).rejects.toThrow();
});

it('limits calendar lookup to personal events of their owner and omits meeting notes', async()=>{
 await db.exec('reset role');
 await db.exec(readFileSync(new URL('../migrations/0031_calendar_lookup.sql',import.meta.url),'utf8'));
 const event='20000000-0000-0000-0000-000000000031';
 await asUser(a);
 await db.query("select public.create_space_item($1,'event','calendar lookup',$2,null)",[event,JSON.stringify({start:'2026-11-21T09:00',end:'2026-11-21T10:00',meeting_notes:'private'})]);
 const lookup=()=>db.query("select * from public.calendar_get_event($1)",[event]);
 const result=await lookup();
 expect(result.rows[0]).toMatchObject({id:event,title:'calendar lookup',starts_local:'2026-11-21T09:00'});
 expect(JSON.stringify(result.rows)).not.toContain('private');
 await asUser(b);
 expect((await lookup()).rows).toEqual([]);
 await db.exec('reset role;set role anon');
 await expect(lookup()).rejects.toThrow(/permission denied/i);
});
it('pairs once, requires UI approval, preserves history, deduplicates and revokes',async()=>{
 await db.exec('reset role');
 await db.exec(readFileSync(new URL('../migrations/0032_calendar_connector.sql',import.meta.url),'utf8'));
 await asUser(a);
 const code=(await db.query<{value:string}>("select public.calendar_connect('primary','both') value")).rows[0].value;
 const secret='12'.repeat(32);
 await db.exec('reset role;set role anon');
 const pair=()=>db.query<{ok:boolean}>('select public.calendar_pair($1,$2) ok',[code,secret]);
 expect((await pair()).rows[0].ok).toBe(true);
 expect((await pair()).rows[0].ok).toBe(false);
 const call=async(tool:string,args:Record<string,unknown>)=>(await db.query<{v:any}>('select public.calendar_connector($1,$2,$3) v',[secret,tool,JSON.stringify(args)])).rows[0].v;
 const args={id:crypto.randomUUID(),request_id:crypto.randomUUID(),title:'sync',body:{start:'2026-11-21T09:00',end:'2026-11-21T10:00'}};
 const approve=async(req:string)=>{await asUser(a);await db.query('select public.calendar_approve($1)',[req]);await db.exec('reset role;set role anon');};
 expect((await call('calendar_create_event',args)).status).toBe('approval_required');
 expect(await call('calendar_get_event',{id:args.id})).toBeNull();
 await approve(args.request_id);
 expect((await call('calendar_create_event',args)).version).toBe(1);
 expect((await call('calendar_create_event',args)).version).toBe(1);
 const record={id:args.id,request_id:crypto.randomUUID(),version:1,google_id:'fixture',google_version:'v1'};
 await call('calendar_record_sync',record);
 expect((await call('calendar_get_event',{google_id:'fixture'})).id).toBe(args.id);
 const edit={id:args.id,request_id:crypto.randomUUID(),version:1,title:'edited'};
 await call('calendar_update_event',edit);await approve(edit.request_id);
 expect((await call('calendar_update_event',edit)).version).toBe(2);
 await expect(call('calendar_update_event',{...edit,request_id:crypto.randomUUID()})).rejects.toThrow();
 const del={id:args.id,request_id:crypto.randomUUID(),version:2};
 await call('calendar_delete_event',del);await approve(del.request_id);
 expect((await call('calendar_delete_event',del)).trashed).toBe(true);
 expect((await call('calendar_get_changes',{})).some((x:any)=>x.id===args.id&&x.trashed)).toBe(true);
 await asUser(a);await db.exec('select public.calendar_disconnect()');
 await db.exec('reset role;set role anon');
 await expect(call('calendar_list',{})).rejects.toThrow();
});
it('accepts table text anchors while rejecting wrong quotes, versions and unauthorized users',async()=>{
 await db.exec('reset role');await db.exec(readFileSync(new URL('../migrations/0044_table_inline_comments.sql',import.meta.url),'utf8'));
 await asUser(a);const n=await create(),x=crypto.randomUUID(),cm=crypto.randomUUID();
 await db.query("select public.page_block_insert($1,$2,null,'table',$3)",[n,x,{text:'A😀B\n한국어',rows:[['A😀B','한국어']]}]);
 await db.query('select public.page_quote_comment($1,null,$2,$3,$4,1,4,7,$5)',[n,cm,'표 문구 의견',x,'한국어']);expect((await doc(n)).comments[0].anchor.quote).toBe('한국어');
 await expect(db.query('select public.page_quote_comment($1,null,gen_random_uuid(),$2,$3,1,4,7,$4)',[n,'bad',x,'잘못됨'])).rejects.toThrow(/선택 문구/);
 await expect(db.query('select public.page_quote_comment($1,null,gen_random_uuid(),$2,$3,0,4,7,$4)',[n,'bad',x,'한국어'])).rejects.toThrow(/변경/);
 await asUser(b);await expect(db.query('select public.page_quote_comment($1,null,gen_random_uuid(),$2,$3,1,4,7,$4)',[n,'bad',x,'한국어'])).rejects.toThrow(/권한/);
 await db.exec('reset role;set role anon');await expect(db.query('select public.page_quote_comment($1,null,gen_random_uuid(),$2,$3,1,4,7,$4)',[n,'bad',x,'한국어'])).rejects.toThrow(/permission/);
});
