const DB='web-messenger-push';
function binding(value){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('settings',value===undefined?'readonly':'readwrite');const store=tx.objectStore('settings');const op=value===undefined?store.get('user'):store.put(value,'user');op.onsuccess=()=>resolve(op.result);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error)}})}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='PUSH_USER')event.waitUntil((async()=>{await binding(event.data.userId??'');const notifications=await self.registration.getNotifications();notifications.forEach(n=>n.close());event.ports[0]?.postMessage({ok:true})})())});
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let payload;try{payload=event.data.json()}catch{return}
 const user=await binding();if(!user||user!==payload.userId)return;
 await self.registration.showNotification('WebMessenger',{body:'새 메시지가 도착했습니다.',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:payload.tag,data:{roomId:payload.roomId},renotify:true});
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const room=event.notification.data?.roomId;
 if(typeof room!=='string'||!/^[0-9a-f-]{36}$/i.test(room))return;
 const url=new URL('/?room='+encodeURIComponent(room),self.location.origin).href;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const client=windows.find(c=>new URL(c.url).origin===self.location.origin);
 if(client){await client.navigate(url);await client.focus()}else await self.clients.openWindow(url);
})())});
