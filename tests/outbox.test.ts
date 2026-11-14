import {it,expect,vi} from 'vitest';
import {Outbox} from '../src/features/messages/outbox';
import type {ChatMessage} from '../src/features/messages/model';
function storage(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)}}}
function saved(key:string):ChatMessage{return {id:'message',room_id:'room',sender_id:'alice',body:'hello',sequence:1,created_at:new Date().toISOString(),idempotency_key:key}}
it('retries an uncertain response using the original key and locks concurrent clicks',async()=>{
 const box=new Outbox(storage(),'alice',()=>{});const item=box.enqueue('room','hello');
 await box.send(item.key,async()=>{throw new Error('response lost')});expect(box.items[0].status).toBe('failed');
 let finish!:(m:ChatMessage)=>void;const deliver=vi.fn(()=>new Promise<ChatMessage>(resolve=>finish=resolve));
 const first=box.send(item.key,deliver);await box.send(item.key,deliver);expect(deliver).toHaveBeenCalledTimes(1);expect(deliver.mock.calls[0]).toEqual([expect.objectContaining({key:item.key,body:'hello'})]);
 finish(saved(item.key));await first;expect(box.items).toEqual([]);
});
it('restores failed items after reload, isolates accounts, reconciles only own server messages',async()=>{
 const store=storage();const box=new Outbox(store,'alice',()=>{});const item=box.enqueue('room','hello');
 const reload=new Outbox(store,'alice',()=>{});expect(reload.items[0].key).toBe(item.key);expect(reload.items[0].status).toBe('failed');
 expect(new Outbox(store,'bob',()=>{}).items).toEqual([]);
 reload.reconcile([{...saved(item.key),sender_id:'bob'}]);expect(reload.items).toHaveLength(1);
 reload.reconcile([saved(item.key)]);expect(reload.items).toHaveLength(0);expect(new Outbox(store,'alice',()=>{}).items).toHaveLength(0);
});
it('does not resurrect a server-confirmed message when its original request later fails',async()=>{
 const box=new Outbox(storage(),'alice',()=>{});const item=box.enqueue('room','hello');let fail!:(e:Error)=>void;
 const sending=box.send(item.key,()=>new Promise((_,reject)=>fail=reject));box.reconcile([saved(item.key)]);fail(new Error('timeout'));await sending;expect(box.items).toEqual([]);
});
it('keeps other rooms intact and gives identical new messages distinct keys',()=>{
 const box=new Outbox(storage(),'alice',()=>{});const a=box.enqueue('room','hello'),b=box.enqueue('room2','hello');expect(a.key).not.toBe(b.key);box.reconcile([saved(a.key)]);expect(box.items.map(x=>x.key)).toEqual([b.key]);
});
