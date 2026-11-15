// Shared by the service worker and app. Incoming content stays on this device.
(function(root){
 const MAX=300*1024*1024, TTL=24*3600000;
 function normalize(form){
  const text=['title','text','url'].map(k=>String(form.get(k)||'').trim()).filter((v,i,a)=>v&&a.indexOf(v)===i).join('\n');
  const files=form.getAll('files').filter(f=>typeof f!=='string'&&f.size);
  if(!text&&!files.length)throw Error('공유할 내용이 없습니다.');
  if(text.length>4000)throw Error('공유 텍스트는 4,000자까지 받을 수 있습니다.');
  if(files.length>10||files.reduce((n,f)=>n+f.size,0)>MAX)throw Error('공유는 최대 10개, 합계 300MB까지 받을 수 있습니다. 큰 파일은 메신저에서 직접 첨부해 주세요.');
  return {id:crypto.randomUUID(),created:Date.now(),text,files,keys:Array.from({length:files.length+1},()=>crypto.randomUUID()),done:[],owner:null,room:null};
 }
 function transact(fn){return new Promise((resolve,reject)=>{
  const open=indexedDB.open('weano-share-inbox',1);open.onupgradeneeded=()=>open.result.createObjectStore('shares',{keyPath:'id'});open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('shares','readwrite'),s=tx.objectStore('shares');let result,problem;
   const all=s.getAll();all.onsuccess=()=>{try{const valid=all.result.filter(x=>Date.now()-x.created<TTL);all.result.filter(x=>Date.now()-x.created>=TTL).forEach(x=>s.delete(x.id));result=fn(s,valid)}catch(e){problem=e;tx.abort()}};
   tx.oncomplete=()=>{db.close();resolve(result)};tx.onabort=tx.onerror=()=>{db.close();reject(problem||tx.error||Error('임시 저장소에 접근하지 못했습니다.'))};
  };
 })}
 root.WeanoShareStore={normalize,
  list:()=>transact((_s,rows)=>rows.sort((a,b)=>a.created-b.created)),
  put:job=>transact((s,rows)=>{if(rows.length>=3||rows.reduce((n,j)=>n+j.files.reduce((m,f)=>m+f.size,0),0)+job.files.reduce((n,f)=>n+f.size,0)>MAX)throw Error('받은 공유를 먼저 전송하거나 취소해 주세요.');s.put(job);return job}),
  claim:(id,owner,room,text)=>transact((s,rows)=>{const j=rows.find(x=>x.id===id);if(!j)throw Error('공유 내용이 만료되었거나 처리되었습니다.');if(j.owner&&(j.owner!==owner||j.room!==room))throw Error('이미 다른 계정 또는 대화에서 처리 중인 공유입니다.');if(!j.owner){j.owner=owner;j.room=room;j.text=text;s.put(j)}return j}),
  mark:(id,index)=>transact((s,rows)=>{const j=rows.find(x=>x.id===id);if(j){j.done=[...new Set([...j.done,index])];s.put(j)}}),
  remove:id=>transact(s=>s.delete(id))
 };
})(globalThis);
