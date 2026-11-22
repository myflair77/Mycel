// Wait for the editor to consume the IME commit before inserting an atom.
// A bounded wait cancels safely instead of changing a still-composing range.
export function settleMentionInput(state:()=>{composing:boolean;revision:unknown},ready:()=>void,expired:()=>void){
 const started=Date.now();let quietSince=started,previous=state().revision,cancelled=false;
 const timer=setInterval(()=>{if(cancelled)return;const current=state(),now=Date.now();
  if(current.composing||current.revision!==previous){quietSince=now;previous=current.revision}
  if(!current.composing&&now-quietSince>=80){clearInterval(timer);ready()}
  else if(now-started>=1500){clearInterval(timer);expired()}
 },20);
 return ()=>{cancelled=true;clearInterval(timer)};
}
