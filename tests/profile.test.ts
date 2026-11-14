import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('profile changes preserve UUID, friendship and messages; restrict names and unauthorized writes',async()=>{
 const db=new PGlite();const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 const read=(file:string)=>readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8');
 await db.exec(read('0001_supabase_chat.sql').replace('alter publication supabase_realtime add table public.messages;',''));
 for(const [id,name] of [[a,'alice'],[b,'bob']])await db.query('insert into auth.users values($1,$2)',[id,JSON.stringify({username:name,display_name:name})]);
 const as=async(id:string)=>{await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])};
 await as(a);const room=(await db.query<any>("select public.open_direct_chat('bob') as v")).rows[0].v;
 await db.query("select public.send_message($1,'preserved',gen_random_uuid())",[room]);
 await db.exec('reset role');await db.exec(read('0002_friends.sql'));await db.exec(read('0014_account_profile.sql'));
 const rpc=async(sql:string,args:any[]=[]) => (await db.query<any>(sql,args)).rows[0].v;
 await as(a);await rpc('select public.request_friend($1) as v',[b]);await as(b);await rpc('select public.respond_friend($1,true) as v',[a]);await as(a);
 expect((await rpc("select public.update_my_profile('새 닉네임','Alice_New') as v")).profile.id).toBe(a);
 expect((await rpc("select public.update_my_profile(null,'bob') as v")).error).toBeTruthy();
 expect((await rpc("select public.update_my_profile(null,'second_name') as v")).error).toMatch(/30일/);
 expect((await rpc("select public.update_my_profile('',null) as v")).error).toBeTruthy();
 expect((await rpc("select public.update_my_profile('nickname only',null) as v")).profile.username).toBe('alice_new');
 await expect(db.query("update public.profiles set username='forged'")).rejects.toThrow(/permission/);
 await expect(db.query('select * from public.retired_usernames')).rejects.toThrow(/permission/);
 await as(b);
 expect(await rpc("select public.open_direct_chat('alice_new') as v")).toBe(room);
 expect((await db.query('select * from public.messages')).rows).toHaveLength(1);
 expect((await rpc('select public.list_social() as v')).relations[0].username).toBe('alice_new');
 expect((await rpc("select public.check_username('alice') as v")).available).toBe(false);
 await db.exec('reset role');
 await expect(db.query('insert into auth.users values($1,$2)',['00000000-0000-0000-0000-000000000003',JSON.stringify({username:'alice',display_name:'impostor'})])).rejects.toThrow(/아이디/);
 await db.exec("update public.profiles set username_changed_at=now()-interval '31 days';update public.retired_usernames set reserved_until=now()-interval '1 day'");
 await as(a);expect((await rpc("select public.update_my_profile(null,'alice') as v")).profile.username).toBe('alice');
 await db.exec('reset role;set role anon');
 await expect(rpc("select public.check_username('bob') as v")).rejects.toThrow(/permission/);
 await expect(rpc("select public.update_my_profile('x',null) as v")).rejects.toThrow(/permission/);
 }finally{await db.close()}
},30000);
