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
