import {it,expect,vi,afterEach} from 'vitest';
// @ts-expect-error Worker JavaScript is exercised directly.
import {accountApi,accountQuota} from '../worker/account.mjs';
class Bucket{values=new Map<string,any>();version=0;async get(k:string){const v=this.values.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.body)}:null}async put(k:string,body:string,o:any){const old=this.values.get(k);if(o.onlyIf.etagDoesNotMatch==='*'&&old||o.onlyIf.etagMatches&&old?.etag!==o.onlyIf.etagMatches)return null;const v={body,etag:String(++this.version)};this.values.set(k,v);return v}}
const env=()=>({BUCKET:new Bucket(),R2_RECEIPT_KEY:'ab'.repeat(32)});
const req=(email='nobody@example.com',kind='username')=>new Request('https://example.com/api/account/recover',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({email,kind})});
afterEach(()=>vi.unstubAllGlobals());
it('rate limits use atomic writes, normalize identities and never store raw identifiers',async()=>{
 const e=env();expect((await Promise.all(Array.from({length:8},()=>accountQuota(e,'email:private@example.com',5,60000,100000)))).filter(Boolean)).toHaveLength(1);
 expect(await accountQuota(e,'email:private@example.com',5,60000,160001)).toBe(true);
 expect(JSON.stringify([...e.BUCKET.values])).not.toContain('private@example.com');
});
it('lookup never signs up and conceals missing users; cooldown enforced',async()=>{
 const fetcher=vi.fn(async()=>Response.json({code:'signup_disabled'},{status:422}));vi.stubGlobal('fetch',fetcher);const e=env();
 const r=await accountApi(req(),e);expect(r.status).toBe(200);expect((await r.json()).ok).toBe(true);
 const args=fetcher.mock.calls[0] as any;expect(JSON.parse(args[1].body).create_user).toBe(false);expect(args[0]).toContain('redirect_to=https%3A%2F%2Fexample.com');
 expect((await accountApi(req('NOBODY@example.com'),e)).status).toBe(429);
});
it('rejects cross origin and fails visibly on mail service errors',async()=>{
 const r=req();r.headers.set('Origin','https://attacker.example');expect((await accountApi(r,env())).status).toBe(403);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({code:'unexpected_failure'},{status:500})));
 expect((await accountApi(req('valid@example.com','password'),env())).status).toBe(503);
});
