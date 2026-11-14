import type {ChatMessage} from './model';
// Commit each successful page, so a later network failure resumes from that page.
export async function recoverMessages(cursor:number,fetchPage:(cursor:number)=>Promise<ChatMessage[]>,commit:(rows:ChatMessage[],cursor:number)=>void,stopped:()=>boolean){
 while(!stopped()){
  const rows=await fetchPage(cursor);if(stopped())return;
  if(rows.length){cursor=rows[rows.length-1].sequence;commit(rows,cursor)}
  if(rows.length<100)return;
 }
}
