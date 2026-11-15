export interface ChatMessage {id:string;room_id:string;sender_id:string;body:string;sequence:number;created_at:string;idempotency_key?:string;attachment_id?:string|null;reply_to?:string|null;forwarded?:boolean;edited_at?:string|null;deleted_at?:string|null;updated_at?:string;post_id?:string|null}
export function mergeMessages(previous:ChatMessage[],incoming:ChatMessage[]):ChatMessage[]{
 const byId=new Map(previous.map(message=>[message.id,message]));
 for(const message of incoming) byId.set(message.id,message);
 return [...byId.values()].sort((a,b)=>a.sequence-b.sequence);
}
