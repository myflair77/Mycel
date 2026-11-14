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
it('enforces real SQL permissions, ordering and retry semantics',async()=>{
 await asUser(a);
 const room=(await db.query<{id:string}>("select public.open_direct_chat('bob') as id")).rows[0].id;
 const saved=(await db.query<{id:string;sequence:number}>("select * from public.send_message($1,'hello',$2)",[room,'10000000-0000-0000-0000-000000000001'])).rows[0];
 expect(Number(saved.sequence)).toBe(1);
 const retry=(await db.query<{id:string}>("select * from public.send_message($1,'hello',$2)",[room,'10000000-0000-0000-0000-000000000001'])).rows[0];expect(retry.id).toBe(saved.id);
 await expect(db.query("select * from public.send_message($1,'changed',$2)",[room,'10000000-0000-0000-0000-000000000001'])).rejects.toThrow(/Idempotency/);
 await db.exec('reset role;');
 await db.exec(readFileSync(new URL('../migrations/0002_friends.sql',import.meta.url),'utf8'));
 await asUser(a);
 const again=(await db.query<{id:string}>("select * from public.send_message($1,'hello',$2)",[room,'10000000-0000-0000-0000-000000000001'])).rows[0];expect(again.id).toBe(saved.id);
 await asUser(b);
 expect((await db.query<{id:string}>("select public.open_direct_chat('alice') as id")).rows[0].id).toBe(room);
 expect((await db.query('select * from public.messages')).rows).toHaveLength(1);
 await expect(db.query("insert into public.messages(room_id,sender_id,body,idempotency_key,sequence) values($1,$2,'forged',gen_random_uuid(),9)",[room,a])).rejects.toThrow(/permission/);
 await asUser(c);
 expect((await db.query('select * from public.messages')).rows).toHaveLength(0);
 expect((await db.query('select * from public.chat_rooms')).rows).toHaveLength(0);
 await expect(db.query("select public.send_message($1,'forbidden',gen_random_uuid())",[room])).rejects.toThrow(/access denied/);
 await db.exec('reset role;set role anon;');
 await expect(db.query('select * from public.messages')).rejects.toThrow(/permission/);
});
