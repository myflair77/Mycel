export type ResourceView={room:string;tab:'chat'|'event'|'note';item:string};
export type ViewEntry={view:ResourceView;scroll:number;bottom:boolean};
export function viewUrl(view:ResourceView){const q=new URLSearchParams(location.search);if(q.get('item')!==view.item){q.delete('block');q.delete('noteTab')}for(const k of ['room','tab','item'])q.delete(k);if(view.room){q.set('room',view.room);if(view.tab!=='chat')q.set('tab',view.tab);if(view.item)q.set('item',view.item)}return location.pathname+(q.size?'?'+q:'')}
export function initialView(search:string):ResourceView{const q=new URLSearchParams(search);const uuid=(v:string|null)=>v&&/^[a-f0-9-]{36}$/i.test(v)?v:'';return {room:uuid(q.get('room')),tab:q.get('tab')==='note'?'note':q.get('tab')==='event'?'event':'chat',item:uuid(q.get('item'))}}
export function appendView(entries:ViewEntry[],index:number,view:ResourceView){if(JSON.stringify(entries[index].view)===JSON.stringify(view))return entries;return [...entries.slice(0,index+1),{view,scroll:0,bottom:true}]}
export async function saveBeforeNavigation(){const tasks:Array<()=>Promise<boolean>>=[];window.dispatchEvent(new CustomEvent('mycel-before-navigation',{detail:tasks}));for(const save of tasks){try{if(!await save())return false}catch{return false}}return true}

// Coalesce clicks while a save is pending; the last destination wins.
export function createNavigationRequest<T>(prepare:()=>Promise<boolean>,commit:(target:T)=>void,failed:()=>void=()=>{}){
 let pending:{value:T}|null=null,running:Promise<void>|null=null;
 return (target:T)=>{pending={value:target};if(running)return running;
 const work=async()=>{try{if(!await prepare()){pending=null;failed();return}const next=pending;pending=null;if(next)commit(next.value)}catch{pending=null;failed()}};
 running=work().finally(()=>{running=null});return running;
 };
}
