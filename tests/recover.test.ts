import {it,expect} from 'vitest';
import {recoverMessages} from '../src/features/messages/recover';
import {mergeMessages,type ChatMessage} from '../src/features/messages/model';
const rows=Array.from({length:205},(_,i):ChatMessage=>({id:String(i+1),room_id:'room',sender_id:'peer',body:'hello',sequence:i+1,created_at:'2026-01-01'}));
it('resumes after an interrupted page without losing or duplicating offline messages',async()=>{
 let cursor=0;let messages:ChatMessage[]=[];
 const commit=(page:ChatMessage[],next:number)=>{messages=mergeMessages(messages,page);cursor=next};
 await expect(recoverMessages(cursor,async c=>{if(c===100)throw Error('offline');return rows.slice(c,c+100)},commit,()=>false)).rejects.toThrow('offline');
 expect(cursor).toBe(100);
 // A realtime/send response may already have put a later message in the UI.
 messages=mergeMessages(messages,[rows[204]]);
 await recoverMessages(cursor,async c=>rows.slice(c,c+100),commit,()=>false);
 expect(cursor).toBe(205);expect(messages).toHaveLength(205);expect(messages.map(x=>x.sequence)).toEqual(rows.map(x=>x.sequence));
});
it('ignores in-flight responses after switching rooms',async()=>{
 let stopped=false,committed=false;
 await recoverMessages(0,async()=>{stopped=true;return rows.slice(0,2)},()=>{committed=true},()=>stopped);
 expect(committed).toBe(false);
});
