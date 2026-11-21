import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('Auth email guard rolls back confirmed/stale changes, preserves account identity, and limits RPC access',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key,email text,updated_at timestamptz,email_confirmed_at timestamptz,phone_confirmed_at timestamptz,encrypted_password text,raw_app_meta_data jsonb);
 create table public.profiles(id uuid references auth.users,username text);
 insert into auth.users values('00000000-0000-0000-0000-000000000001','old@example.com','2026-11-21T00:00:00Z',null,null,'unchanged-hash','{"provider":"email"}');
 insert into public.profiles values('00000000-0000-0000-0000-000000000001','same_username');`);
 await db.exec(readFileSync(new URL('../migrations/0033_signup_email_change.sql',import.meta.url),'utf8'));
 const marker={email:'old@example.com',updated_at:'2026-11-21T00:00:00Z'};
 const change=()=>db.transaction(async tx=>{
  // Match GoTrue Admin API: email write precedes app_metadata within one transaction.
  await tx.exec("update auth.users set email='new@example.com',updated_at=now()");
  await tx.query("update auth.users set raw_app_meta_data=raw_app_meta_data||$1::jsonb",[JSON.stringify({mycel_pending_email_change:marker})]);
 });
 await db.exec("update auth.users set email_confirmed_at=now()");
 await expect(change()).rejects.toThrow(/Pending signup changed/);
 expect((await db.query<any>('select email from auth.users')).rows[0].email).toBe('old@example.com');
 await db.exec("update auth.users set email_confirmed_at=null,updated_at='2026-11-21T00:00:01Z'");
 await expect(change()).rejects.toThrow(/Pending signup changed/);
 await db.exec("update auth.users set updated_at='2026-11-21T00:00:00Z'");
 await change();
 const u=(await db.query<any>('select * from auth.users')).rows[0];
 expect(u.email).toBe('new@example.com');expect(u.email_confirmed_at).toBeNull();expect(u.encrypted_password).toBe('unchanged-hash');expect(u.raw_app_meta_data).toEqual({provider:'email'});
 expect((await db.query<any>('select username from public.profiles')).rows[0].username).toBe('same_username');
 const scopes=['a'.repeat(64),'b'.repeat(64)];
 await db.exec('set role anon');
 await expect(db.query('select public.claim_signup_email_change($1)',[scopes])).rejects.toThrow(/permission/);
 await expect(db.query('select * from public.signup_email_limits')).rejects.toThrow(/permission/);
 await db.exec('reset role;set role service_role');
 expect((await db.query<any>('select public.claim_signup_email_change($1) as ok',[scopes])).rows[0].ok).toBe(true);
 expect((await db.query<any>('select public.claim_signup_email_change($1) as ok',[scopes])).rows[0].ok).toBe(false);
 }finally{await db.close()}
},30000);

