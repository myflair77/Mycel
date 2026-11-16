type BadgeNavigator={setAppBadge?:(count?:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};
// Serialize updates so an older async operation cannot overwrite a newer count.
let pending:Promise<void>=Promise.resolve();
export function syncUnreadBadge(count:number,target:BadgeNavigator=navigator):Promise<void>{
 const value=Math.max(0,Math.floor(Number.isFinite(count)?count:0));
 pending=pending.catch(()=>{}).then(async()=>{
  try{if(value===0)await target.clearAppBadge?.();else await target.setAppBadge?.(value)}catch{/* Badge settings must never interrupt chat. */}
 });
 return pending;
}
export async function syncServerBadge(snapshot:{userId:string;unreadCount:number;badgeAt:number}){
 if('serviceWorker' in navigator){
  try{
   const reg=await navigator.serviceWorker.getRegistration('/');
   if(reg?.active){
    const result=await new Promise<{matched:boolean;applied?:boolean;unreadCount?:number}>((resolve)=>{
     const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve({matched:false})},3000);
     channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data??{matched:false})};
     reg.active!.postMessage({type:'BADGE_SNAPSHOT',...snapshot},[channel.port2]);
    });
    if(result.matched){if(!result.applied)await syncUnreadBadge(result.unreadCount??snapshot.unreadCount);return;}
   }
  }catch{}
 }
 await syncUnreadBadge(snapshot.unreadCount);
}
