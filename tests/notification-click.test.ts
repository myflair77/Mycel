import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {it,expect,vi} from 'vitest';
const origin='https://web-messenger-jbh.myflair.chatgpt.site';
const room='00000000-0000-0000-0000-000000000001';
async function click(clients:any[],data:any={roomId:room},enumerationFails=false){
 let handler:any;const close=vi.fn();const opened={focus:vi.fn(async()=>{})};const openWindow=vi.fn(async()=>opened);
 const context=createContext({URL,self:{location:{origin},clients:{matchAll:async()=>{if(enumerationFails)throw new Error('gone');return clients},openWindow},addEventListener:(name:string,fn:any)=>{if(name==='notificationclick')handler=fn}}});
 runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let done:any;handler({notification:{data,close},waitUntil:(p:any)=>done=p});await done;
 return {openWindow,close};
}
it('opens the conversation when all messenger windows are closed',async()=>{const r=await click([]);expect(r.openWindow).toHaveBeenCalledWith(origin+'/?room='+room);expect(r.close).toHaveBeenCalled()});
it('focuses the new WindowClient returned by navigation',async()=>{const result={focus:vi.fn(async()=>{})};const client={url:origin+'/',focus:vi.fn(async()=>{}),navigate:vi.fn(async()=>result)};const r=await click([client]);expect(client.focus).toHaveBeenCalledTimes(1);expect(result.focus).toHaveBeenCalledTimes(1);expect(r.openWindow).not.toHaveBeenCalled()});
it.each(['focus','navigate','null'])('falls back to opening a window after %s failure',async(failure)=>{const r=await click([{url:origin+'/',focus:async()=>{if(failure==='focus')throw new Error('stale')},navigate:async()=>{if(failure==='navigate')throw new Error('closed');return null}}]);expect(r.openWindow).toHaveBeenCalledWith(origin+'/?room='+room)});
it('opens home for missing or unsafe room data',async()=>{for(const data of [undefined,{roomId:'https://evil.example/'},{roomId:'------------------------------------'}]){const r=await click([],data??{});expect(r.openWindow).toHaveBeenCalledWith(origin+'/')}});
it('opens even when client enumeration fails',async()=>{const r=await click([],{},true);expect(r.openWindow).toHaveBeenCalledWith(origin+'/')});
it('does not reuse cross-origin or embedded windows',async()=>{const focus=vi.fn();const r=await click([{url:'https://other.example/',focus},{url:origin+'/',frameType:'nested',focus}]);expect(focus).not.toHaveBeenCalled();expect(r.openWindow).toHaveBeenCalled()});
