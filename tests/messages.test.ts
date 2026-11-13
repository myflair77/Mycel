import {it,expect} from 'vitest';import {mergeMessages,type ChatMessage} from '../src/features/messages/model';
const m=(id:string,sequence:number)=>({id,sequence,room_id:'r',sender_id:'u',body:id,created_at:'2026-11-13T00:00:00Z'} as ChatMessage);
it('deduplicates ack, realtime, and reconnect results in server order',()=>{expect(mergeMessages([m('b',2)],[m('a',1),m('b',2)]).map(x=>x.id)).toEqual(['a','b'])});
