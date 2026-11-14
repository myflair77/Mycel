const DB='web-messenger-push';
function setting(key,value){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('settings',value===undefined?'readonly':'readwrite');const store=tx.objectStore('settings');const op=value===undefined?store.get(key):store.put(value,key);let result;op.onsuccess=()=>{result=op.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)}}})}
function binding(value){return setting('user',value)}
let work=Promise.resolve();
function serialize(task){const next=work.catch(()=>{}).then(task);work=next;return next}
async function updateBadge(payload){
 const count=payload.unreadCount,at=payload.badgeAt;
 if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(at)||at<=0)return false;
 const previous=await setting('badge');
 if(previous?.userId===payload.userId&&previous.badgeAt>at)return false;
 try{
  if(count===0)await self.navigator.clearAppBadge?.();else await self.navigator.setAppBadge?.(count);
  await setting('badge',{userId:payload.userId,badgeAt:at,unreadCount:count});
 }catch{/* An unavailable badge must not suppress message notifications. */}
 return true;
}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 if(event.data?.type==='PUSH_STATUS')event.waitUntil(serialize(async()=>{
  const notifications=await self.registration.getNotifications();
  event.ports[0]?.postMessage({mode:'per-message-v1',backgroundBadge:true,count:notifications.length});
 }));
 if(event.data?.type==='BADGE_SNAPSHOT')event.waitUntil(serialize(async()=>{
  const user=await binding();const matched=Boolean(user&&user===event.data.userId);
  if(matched)await updateBadge(event.data);
  event.ports[0]?.postMessage({matched});
 }));
 if(event.data?.type==='PUSH_USER')event.waitUntil(serialize(async()=>{
  await binding(event.data.userId??'');await setting('badge',null);
  try{await self.navigator.clearAppBadge?.()}catch{}
  const notifications=await self.registration.getNotifications();notifications.forEach(n=>n.close());
  event.ports[0]?.postMessage({ok:true});
 }));
});
self.addEventListener('push',event=>event.waitUntil(serialize(async()=>{
 let payload;try{payload=event.data.json()}catch{return}
 const user=await binding();if(!user||user!==payload.userId)return;
 // Stable per-delivery job tag prevents retry duplicates while preserving separate messages.
 const tag=typeof payload.tag==='string'&&payload.tag.startsWith('push-')?payload.tag:undefined;
 await updateBadge(payload);
 await self.registration.showNotification('WebMessenger',{body:'새 메시지가 도착했습니다.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag,data:{roomId:payload.roomId}});
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 windows.forEach(client=>client.postMessage({type:'BADGE_REFRESH'}));
})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const room=event.notification.data?.roomId;
 if(typeof room!=='string'||!/^[0-9a-f-]{36}$/i.test(room))return;
 const url=new URL('/?room='+encodeURIComponent(room),self.location.origin).href;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const client=windows.find(c=>new URL(c.url).origin===self.location.origin);
 if(client){await client.navigate(url);await client.focus()}else await self.clients.openWindow(url);
})())});
