import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
it('calls the calendar RPC on Worker runtimes without AbortSignal.timeout',async()=>{
 const source=['worker/files.mjs','worker/calendar-plan.mjs','worker/calendar-mcp.mjs'].map(p=>readFileSync(p,'utf8')).join('\n');
 const worker=await import(/* @vite-ignore */ 'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const original=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 const request=vi.fn(async(_url:string,init:RequestInit)=>{
  if(init.redirect==='error')throw new TypeError('Unsupported redirect mode: error');
  expect(init.redirect).toBe('manual');
  return Response.json({direction:'both'});
 });
 vi.stubGlobal('fetch',request);
 Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 try{
  for(const name of ['calendar_list','calendar_get_sync_status']){
   const response=await worker.calendarMcp(new Request('https://example.invalid/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'test-user'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{}}})}),{CALENDAR_MCP_SECRET:'ab'.repeat(32)});
   const result=await response.json();expect(result.result.isError).toBeUndefined();expect(JSON.parse(result.result.content[0].text)).toEqual({direction:'both'});
  }
  expect(request).toHaveBeenCalledTimes(2);
 }finally{if(original)Object.defineProperty(AbortSignal,'timeout',original);vi.unstubAllGlobals()}
});

it('rejects redirects without following them or exposing credentials',async()=>{
 const source=['worker/files.mjs','worker/calendar-plan.mjs','worker/calendar-mcp.mjs'].map(p=>readFileSync(p,'utf8')).join('\n');
 const worker=await import(/* @vite-ignore */ 'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const request=vi.fn(async(_url:string,init:RequestInit)=>{expect(init.redirect).toBe('manual');return new Response('',{status:302,headers:{Location:'https://example.invalid/other'}})});
 vi.stubGlobal('fetch',request);const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{
  const response=await worker.calendarMcp(new Request('https://example.invalid/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'test-user'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'calendar_list',arguments:{}}})}),{CALENDAR_MCP_SECRET:'ab'.repeat(32)});
  const result=await response.json();expect(result.result.isError).toBe(true);expect(request).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain('example.invalid/other');
 }finally{log.mockRestore();vi.unstubAllGlobals()}
});
