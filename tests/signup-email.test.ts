import {it,expect,vi} from 'vitest';
// @ts-expect-error Deno entrypoint is also a transport-injectable handler for tests.
import {signupEmail} from '../supabase/functions/signup-email/index.ts';
const site='https://web-messenger-jbh.myflair.chatgpt.site';
const env={SUPABASE_URL:'https://auth.example',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-only'};
const user={id:'00000000-0000-0000-0000-000000000001',email:'old@example.com',updated_at:'2026-11-21T00:00:00Z',email_confirmed_at:null,phone_confirmed_at:null,is_anonymous:false,banned_until:null,identities:[{provider:'email'}]};
const req=(body:any={},origin=site)=>new Request(site+'/functions/v1/signup-email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,newEmail:'new@example.com',password:'validpassword',...body})});
function transport(options:{confirmed?:boolean;wrong?:boolean;quota?:boolean;collision?:boolean;mailFail?:boolean;updateLost?:boolean;quotaFail?:boolean}={}){
 let changed=false;
 return vi.fn(async(url:any,init?:any)=>{
  if(url.includes('claim_signup'))return Response.json(options.quota!==false,{status:options.quotaFail?503:200});
  if(url.includes('/admin/users?'))return Response.json({users:[{...user,identities:undefined,...(options.confirmed?{email_confirmed_at:'2026-11-21T01:00:00Z'}:{})}]});
  if(url.includes('/token?'))return Response.json({error_code:options.wrong?'invalid_credentials':'email_not_confirmed'},{status:400});
  if(url.includes('/admin/users/')&&init.method==='PUT'){changed=!options.collision;if(options.updateLost)throw Error('network');return Response.json({...user,email:'new@example.com'},{status:options.collision?422:200})}
  if(url.includes('/admin/users/')&&init.method==='GET')return Response.json({...user,email:changed?'new@example.com':user.email,...(options.confirmed?{email_confirmed_at:'2026-11-21T01:00:00Z'}:{})});
  if(url.includes('/resend?'))return Response.json({},{status:options.mailFail?429:200});
  throw Error('Unexpected request');
 });
}
it('preserves the same UUID, username/profile and confirmation requirement via Auth API',async()=>{
 const f=transport(),r=await signupEmail(req(),env,f);expect(await r.json()).toEqual({emailChanged:true,email:'new@example.com',mailSent:true});
 const calls=f.mock.calls as any[];
 const write=calls.find((c:any)=>c[1].method==='PUT');expect(write[0].endsWith('/'+user.id)).toBe(true);
 const body=JSON.parse(write[1].body);expect(body.email_confirm).toBe(false);expect(body.password).toBeUndefined();expect(body.user_metadata).toBeUndefined();
 expect(body.app_metadata.mycel_pending_email_change).toEqual({email:user.email,updated_at:user.updated_at});
 expect(calls.filter((c:any)=>c[0].includes('/signup'))).toHaveLength(0);
 expect(calls.find((c:any)=>c[0].includes('/resend'))[1].headers.apikey).toBe('public');
 expect(await (await signupEmail(req(),env,transport())).text()).not.toContain('server-only');
});
it.each([{confirmed:true},{wrong:true}])('rejects confirmed accounts / wrong passwords without mutation: %j',async options=>{
 const f=transport(options);expect((await signupEmail(req(),env,f)).status).toBe(400);
 expect(f.mock.calls.some((c:any)=>c[1].method==='PUT'||c[0].includes('/resend'))).toBe(false);
});
it('cannot bypass rate limits or a missing DB migration',async()=>{
 for(const options of [{quota:false},{quotaFail:true}]){const f=transport(options);expect((await signupEmail(req(),env,f)).status).toBe(options.quotaFail?503:429);expect(f).toHaveBeenCalledTimes(1)}
});
it('rejects foreign origins and malformed inputs before any backend requests',async()=>{
 const f=transport();expect((await signupEmail(req({},'https://attacker.example'),env,f)).status).toBe(403);
 for(const body of [{newEmail:user.email},{password:'short'},{newEmail:'invalid'}])expect((await signupEmail(req(body),env,f)).status).toBe(400);
 expect(f).not.toHaveBeenCalled();
});
it('does not resend or claim success on a collision/guard rejection',async()=>{
 const f=transport({collision:true});expect((await signupEmail(req(),env,f)).status).toBe(409);expect(f.mock.calls.some((c:any)=>c[0].includes('/resend'))).toBe(false);
});
it('reports changed address even when mail sending fails or update response is lost',async()=>{
 for(const options of [{mailFail:true},{updateLost:true}])expect(await (await signupEmail(req(),env,transport(options))).json()).toEqual({emailChanged:true,email:'new@example.com',mailSent:false});
});
it('limits streamed bodies and excludes passwords/raw emails from quota state',async()=>{
 const f=transport();expect((await signupEmail(req({padding:'a'.repeat(3000)}),env,f)).status).toBe(413);expect(f).not.toHaveBeenCalled();
 await signupEmail(req(),env,f);const scopes=JSON.parse(f.mock.calls[0][1].body).p_scopes;expect(scopes).toHaveLength(2);for(const hash of scopes)expect(hash).toMatch(/^[a-f0-9]{64}$/);
});

