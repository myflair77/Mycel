import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003';
async function asUser(id:string){await db.exec("reset role;set role authenticated;");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
 const migration=readFileSync(new URL('../migrations/0001_supabase_chat.sql',import.meta.url),'utf8');
 // PGlite validates PostgreSQL schema/RLS/RPCs; not Supabase replication or Auth.
 await db.exec(migration.replace('alter publication supabase_realtime add table public.messages;',''));
 for(const [id,username] of [[a,'alice'],[b,'bob'],[c,'carol']])await db.query('insert into auth.users values($1,$2)',[id,JSON.stringify({username,display_name:username})]);
},30000);
afterAll(async()=>{await db?.close()});

it('counts incoming messages, persists monotonic own receipts and isolates rooms',async()=>{
 await asUser(a);
 const room=(await db.query<{id:string}>("select public.open_direct_chat('bob') as id")).rows[0].id;
 await db.query("select public.send_message($1,'old history',gen_random_uuid())",[room]);
 await db.exec('reset role;');
 await db.exec(readFileSync(new URL('../migrations/0003_read_receipts.sql',import.meta.url),'utf8').replace('alter publication supabase_realtime add table public.chat_reads;',''));
 await asUser(a);
 const activity=async()=> (await db.query<{unread_count:number;peer_read_sequence:number}>('select * from public.get_chat_activity()')).rows;
 expect(Number((await activity())[0].unread_count)).toBe(0);
 await asUser(b);expect(Number((await activity())[0].unread_count)).toBe(1);
 await db.query('select public.mark_chat_read($1,1)',[room]);
 expect(Number((await activity())[0].unread_count)).toBe(0);
 await db.query('select public.mark_chat_read($1,0)',[room]);
 expect(Number((await db.query<{last_read_sequence:number}>('select last_read_sequence from public.chat_reads')).rows[0].last_read_sequence)).toBe(1);
 await expect(db.query('select public.mark_chat_read($1,999)',[room])).rejects.toThrow(/Invalid/);
 await expect(db.query('select public.mark_chat_read($1,-1)',[room])).rejects.toThrow(/Invalid/);
 await expect(db.query('select public.mark_chat_read($1,null)',[room])).rejects.toThrow(/Invalid/);
 await db.query("select public.send_message($1,'reply',gen_random_uuid())",[room]);
 expect(Number((await activity())[0].unread_count)).toBe(0);
 await asUser(a);
 expect(Number((await activity())[0].unread_count)).toBe(1);
 expect(Number((await activity())[0].peer_read_sequence)).toBe(1);
 await db.query('select public.mark_chat_read($1,2)',[room]);
 await asUser(c);
 expect(await activity()).toHaveLength(0);
 expect((await db.query('select * from public.chat_reads')).rows).toHaveLength(0);
 await expect(db.query('select public.mark_chat_read($1,1)',[room])).rejects.toThrow(/access denied/);
 await asUser(b);
 await expect(db.query('update public.chat_reads set last_read_sequence=99')).rejects.toThrow(/permission/);
 await expect(db.query('insert into public.chat_reads(room_id,user_id) values($1,$2)',[room,a])).rejects.toThrow(/permission/);
 expect(Number((await activity())[0].peer_read_sequence)).toBe(2);
 await db.exec('reset role;set role anon;');
 await expect(db.query('select public.get_chat_activity()')).rejects.toThrow(/permission/);
 await expect(db.query('select public.mark_chat_read($1,1)',[room])).rejects.toThrow(/permission/);
});
