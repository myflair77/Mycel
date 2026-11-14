import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {it,expect} from 'vitest';
function worker(){
 const handlers:Record<string,(e:any)=>void>={};const notifications:any[]=[];
 const context=createContext({self:{addEventListener:(type:string,handler:any)=>handlers[type]=handler,registration:{showNotification:async(title:string,options:any)=>{notifications.push({title,...options})},getNotifications:async()=>notifications}},URL});
 runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 runInContext("binding=async()=> 'recipient'",context);
 async function push(userId='recipient'){let done:Promise<void>|undefined;handlers.push({data:{json:()=>({userId,roomId:'same-room',tag:'room-same-room'})},waitUntil:(p:Promise<void>)=>done=p});await done}
 return {handlers,notifications,push};
}
it('keeps three same-room deliveries separate without exposing message content',async()=>{
 const w=worker();await w.push();await w.push();await w.push();
 expect(w.notifications).toHaveLength(3);
 for(const n of w.notifications){expect(n.tag).toBeUndefined();expect(n.renotify).toBeUndefined();expect(n.body).toBe('새 메시지가 도착했습니다.')}
});
it('does not show another account notification',async()=>{const w=worker();await w.push('another-user');expect(w.notifications).toHaveLength(0)});
it('reports the installed worker mode and retained notification count',async()=>{
 const w=worker();await w.push();await w.push();await w.push();let status:any;let done:any;
 w.handlers.message({data:{type:'PUSH_STATUS'},ports:[{postMessage:(s:any)=>status=s}],waitUntil:(p:any)=>done=p});await done;
 expect(status).toEqual({mode:'per-message-v1',count:3});
});
