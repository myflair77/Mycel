export function canMarkRead(room:string,conversationVisible:boolean,pageVisible:boolean,focused:boolean){
 return Boolean(room)&&conversationVisible&&pageVisible&&focused;
}

// Never acknowledge a later send response before missing incoming rows load.
export function contiguousReadPosition(messages:{room_id:string;sequence:number}[],room:string,startSequence=0){
 let cursor=startSequence;
 for(const message of messages){
  if(message.room_id!==room||message.sequence<=startSequence)continue;
  if(message.sequence===cursor+1)cursor=message.sequence;
  else if(message.sequence>cursor+1)break;
 }
 return cursor;
}
