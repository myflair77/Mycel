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
},30000);
afterAll(async()=>{await db?.close()});



it('direct additions create a separate room and late joins cannot retrieve old history by any read path',async()=>{
 await asUser(b);expect((await db.query<any>('select body from public.messages where room_id=$1',[legacy])).rows[0].body).toBe('retained history');
 await db.exec('reset role');await db.query("insert into public.friendships(low_id,high_id,requested_by,status) values($1,$2,$1,'accepted'),($1,$3,$1,'accepted')",[a,b,c]);
 await asUser(a);const privateMessage=(await db.query<any>("select * from public.send_message($1,'private',gen_random_uuid())",[room])).rows[0];
 const separate=(await db.query<any>("select public.create_group_from_direct($1,gen_random_uuid(),'new',array[$2::uuid]) as id",[room,c])).rows[0].id;
 expect(separate).not.toBe(room);expect((await db.query('select * from public.messages where room_id=$1',[separate])).rows).toHaveLength(0);
 expect((await db.query('select * from public.messages where id=$1',[privateMessage.id])).rows).toHaveLength(1);
 await asUser(c);expect((await db.query('select * from public.messages where id=$1',[privateMessage.id])).rows).toHaveLength(0);
 await asUser(a);const group=(await db.query<any>("select public.create_group_chat(gen_random_uuid(),'history',array[$1::uuid]) as id",[b])).rows[0].id;
 const old=(await db.query<any>("select * from public.send_message($1,'old secret',gen_random_uuid())",[group])).rows[0];
 await db.query('select public.prepare_attachment($1,$2,$3,123,$4)',[group,id,'old.png','image/png']);
 const path='files/'+id+'/'+id+'/manifest.json',receipt=createHmac('sha256',Buffer.from('ab'.repeat(32),'hex')).update(id+':123:'+path).digest('hex');
 await db.query('select * from public.send_r2_attachment($1,$2,$3)',[id,path,receipt]);
 const post=(await db.query<any>("select * from public.save_room_post(gen_random_uuid(),$1,'old post','old body',array[$2::uuid],true,null)",[group,id])).rows[0];
 await db.query('select public.invite_group_members($1,array[$2::uuid])',[group,c]);
 await asUser(c);expect((await db.query('select * from public.messages where room_id=$1',[group])).rows).toHaveLength(0);
 expect((await db.query("select * from public.search_messages($1,'old')",[group])).rows).toHaveLength(0);
 expect((await db.query('select * from public.chat_attachments where id=$1',[id])).rows).toHaveLength(0);
 expect((await db.query<any>('select public.can_use_chat_file($1,false) as ok',[a+'/'+id])).rows[0].ok).toBe(false);
 expect((await db.query('select * from public.get_room_files($1)',[group])).rows).toHaveLength(0);
 expect((await db.query('select * from public.room_posts where id=$1',[post.id])).rows).toHaveLength(0);
 expect((await db.query<any>('select * from public.get_conversations()')).rows.find(x=>x.id===group).last_body).toBeNull();
 await expect(db.query('select public.prepare_message_reply(gen_random_uuid(),$1,$2)',[group,old.id])).rejects.toThrow(/원문/);
 await expect(db.query('select public.forward_message($1,$2,gen_random_uuid())',[old.id,separate])).rejects.toThrow(/접근/);
 await asUser(a);expect((await db.query('select * from public.messages where room_id=$1',[group])).rows).toHaveLength(3);
 expect((await db.query('select * from public.get_room_files($1)',[group])).rows).toHaveLength(1);
 const after=(await db.query<any>("select * from public.send_message($1,'after join',gen_random_uuid())",[group])).rows[0];
 await asUser(c);expect((await db.query<any>('select * from public.messages where room_id=$1',[group])).rows.map(m=>m.id)).toEqual([after.id]);
 await db.query('select public.mark_chat_read($1,$2)',[group,after.sequence]);
 expect((await db.query<any>('select * from public.get_chat_activity()')).rows.find(x=>x.room_id===group).unread_count).toBe(0);
 await asUser(a);await db.query('select public.forward_message($1,$2,gen_random_uuid())',[(await db.query<any>('select id from public.messages where attachment_id=$1',[id])).rows[0].id,group]);
 await asUser(c);expect((await db.query('select * from public.chat_attachments where id=$1',[id])).rows).toHaveLength(1); // Explicit re-share is a new visible message.
 await db.query('select public.leave_group_chat($1)',[group]);await asUser(a);await db.query('select public.invite_group_members($1,array[$2::uuid])',[group,c]);
 await asUser(c);expect((await db.query('select * from public.messages where room_id=$1',[group])).rows).toHaveLength(0);expect((await db.query('select * from public.chat_attachments where id=$1',[id])).rows).toHaveLength(0);
});
