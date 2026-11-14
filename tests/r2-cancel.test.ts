import {it,expect,vi,afterEach} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn(()=>({abortSignal:()=>Promise.resolve({data:{},error:null})})));
vi.mock('../src/services/supabase',()=>({supabase:{rpc,auth:{getSession:async()=>({data:{session:{access_token:'token'}}})},from:()=>({select:()=>({eq:()=>({abortSignal:()=>({maybeSingle:async()=>({data:null,error:null})})})})})}}));
import {uploadR2} from '../src/features/messages/r2';
afterEach(()=>vi.unstubAllGlobals());
it('cancels between parts, cleans pending chunks, clears resume state, never commits',async()=>{
 const data=new Map<string,string>();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>data.get(k),setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});
 let cancel=false;const calls:string[]=[];vi.stubGlobal('fetch',async(url:string,options:any)=>{calls.push(url);if(url.endsWith('/start'))return Response.json({ticket:'signed',chunkSize:4});if(url.includes('/part')){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await options.body.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');cancel=true;return Response.json({key:'part',size:4,hash})}if(url.endsWith('/cancel'))return Response.json({cancelled:true});throw Error('unexpected commit')});
 const file=new File(['12345678'],'a.bin');await expect(uploadR2({id:'a',room_id:'r',sender_id:'s',path:'s/a',name:'a.bin',size:8,mime:'application/octet-stream'},file,()=>{},()=>cancel)).rejects.toThrow(/취소/);
 expect(calls.filter(x=>x.includes('/part'))).toHaveLength(1);expect(calls.some(x=>x.endsWith('/finish'))).toBe(false);expect(calls.at(-1)).toContain('/cancel');expect(data.size).toBe(0);
});
