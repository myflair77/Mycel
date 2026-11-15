import type {Attachment} from './attachments';
import type {ChatMessage} from './model';
export type Outgoing={key:string;room:string;body:string;createdAt:string;status:'sending'|'failed';error:string;attachment?:Attachment;replyTo?:string};
export class Outbox {
 items:Outgoing[]=[];
 private active=new Set<string>();
 constructor(private storage:Pick<Storage,'getItem'|'setItem'>,private userId:string,private changed:()=>void,private scope=''){
  try{const rows=JSON.parse(storage.getItem(this.storageKey)??'[]');
   if(Array.isArray(rows))this.items=rows.filter(x=>x&&typeof x.key==='string'&&typeof x.room==='string'&&typeof x.body==='string'&&typeof x.createdAt==='string').map(x=>({...x,status:'failed',error:'전송 결과를 확인해 주세요. 재전송해도 중복 저장되지 않습니다.'}));
  }catch{/* Unavailable storage must not prevent chatting. */}
 }
 private get storageKey(){return 'messenger-outbox:'+this.userId+this.scope}
 private emit(){try{this.storage.setItem(this.storageKey,JSON.stringify(this.items))}catch{}this.changed()}
 enqueue(room:string,body:string,attachment?:Attachment,replyTo?:string){const item:Outgoing={key:attachment?.id??crypto.randomUUID(),room,body,attachment,replyTo,createdAt:new Date().toISOString(),status:'sending',error:''};this.items=[...this.items,item];this.emit();return item}
 remove(key:string){if(this.active.has(key))return;this.items=this.items.filter(x=>x.key!==key);this.emit()}
 reconcile(rows:ChatMessage[]){const keys=new Set(rows.filter(x=>x.sender_id===this.userId).map(x=>x.idempotency_key));const remaining=this.items.filter(x=>!keys.has(x.key));if(remaining.length!==this.items.length){this.items=remaining;this.emit()}}
 async send(key:string,deliver:(item:Outgoing)=>Promise<ChatMessage>){
  const item=this.items.find(x=>x.key===key);if(!item||this.active.has(key))return;
  this.active.add(key);this.items=this.items.map(x=>x.key===key?{...x,status:'sending',error:''}:x);this.emit();
  try{const saved=await deliver(item);this.items=this.items.filter(x=>x.key!==key);this.emit();return saved}
  catch(e){const message=typeof (e as {message?:unknown})?.message==='string'?(e as {message:string}).message:'네트워크 상태를 확인해 주세요.';this.items=this.items.map(x=>x.key===key?{...x,status:'failed',error:message}:x);this.emit()}
  finally{this.active.delete(key)}
 }
}
