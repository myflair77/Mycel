import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {it,expect} from 'vitest';
function worker(unsupported=false){
 const handlers:Record<string,(e:any)=>void>={};const notifications:any[]=[];const badges:number[]=[];const storage=new Map<string,any>([['user','recipient']]);
 const context=createContext({importScripts:()=>{},self:{navigator:unsupported?{}:{setAppBadge:async(n:number)=>badges.push(n),clearAppBadge:async()=>badges.push(0)},clients:{matchAll:async()=>[]},addEventListener:(type:string,handler:any)=>handlers[type]=handler,registration:{showNotification:async(title:string,options:any)=>{const i=options.tag?notifications.findIndex(n=>n.tag===options.tag):-1;const n={title,...options};if(i<0)notifications.push(n);else notifications[i]=n},getNotifications:async()=>notifications}},URL,storage});
 runInContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 runInContext("setting=async(key,value)=>{if(value!==undefined)storage.set(key,value);return storage.get(key)}",context);
 async function emit(type:string,event:any){let done:any;handlers[type]({...event,waitUntil:(p:any)=>done=p});await done}
 let id=0;
 async function push(extra:any={}){await emit('push',{data:{json:()=>({userId:'recipient',roomId:'same-room',tag:'push-'+(++id),unreadCount:id,badgeAt:id,...extra})}})}
 return {notifications,badges,push,emit};
}
it('keeps same-room messages separate but coalesces delivery retries',async()=>{const w=worker();await w.push();await w.push();await w.push();await w.push({tag:'push-3',unreadCount:3,badgeAt:3});expect(w.notifications).toHaveLength(3);expect(w.notifications.every(n=>n.body==='새 메시지가 도착했습니다.')).toBe(true)});
it('updates exact badge with no open windows and rejects stale snapshots',async()=>{const w=worker();await w.push({unreadCount:8,badgeAt:100});await w.push({unreadCount:7,badgeAt:90});await w.push({unreadCount:0,badgeAt:110});expect(w.badges).toEqual([8,8,0])});
it('does not show or badge another account notification',async()=>{const w=worker();await w.push({userId:'another-user'});expect(w.notifications).toHaveLength(0);expect(w.badges).toHaveLength(0)});
it('still notifies without badge API and ignores invalid badge counts',async()=>{const w=worker(true);await w.push();expect(w.notifications).toHaveLength(1);const other=worker();await other.push({unreadCount:-1});expect(other.badges).toHaveLength(0);expect(other.notifications).toHaveLength(1)});
it('prevents late push from overwriting a newer foreground read snapshot',async()=>{const w=worker();await w.emit('message',{data:{type:'BADGE_SNAPSHOT',userId:'recipient',unreadCount:0,badgeAt:200},ports:[]});await w.push({badgeAt:100,unreadCount:3});expect(w.badges).toEqual([0,0])});
it('reports mode, closed-window support and notification count',async()=>{const w=worker();await w.push();let status:any;await w.emit('message',{data:{type:'PUSH_STATUS'},ports:[{postMessage:(s:any)=>status=s}]});expect(status).toEqual({mode:'per-message-v1',backgroundBadge:true,count:1})});

it('preserves notifications and numeric badge when rebinding the same account',async()=>{const w=worker();await w.push({unreadCount:3});await w.emit('message',{data:{type:'PUSH_USER',userId:'recipient'},ports:[]});expect(w.notifications).toHaveLength(1);expect(w.badges).toEqual([3])});
