import {useEffect,useRef,useState} from 'react';
import {startTabDrag} from './tabDrag';
export type ResourceTab='chat'|'event'|'note';
const defaults:ResourceTab[]=['chat','event','note'];
export function normalizeResourceOrder(value:unknown):ResourceTab[]{const valid=Array.isArray(value)?value.filter((v):v is ResourceTab=>defaults.includes(v)):[];return [...new Set([...valid,...defaults])]}
export function resourceOrderKey(userId:string){return 'mycel-resource-tab-order:'+userId}
function read(userId:string){try{return normalizeResourceOrder(JSON.parse(localStorage.getItem(resourceOrderKey(userId))??'null'))}catch{return [...defaults]}}
export function ResourceTabs({userId,active,onSelect,counts}:{userId:string;active:ResourceTab;onSelect:(t:ResourceTab)=>void;counts:Record<ResourceTab,number>}){
 const [preference,setPreference]=useState(()=>({userId,order:read(userId)})),[announcement,setAnnouncement]=useState('');const cancel=useRef<(()=>void)|undefined>(undefined);
 const order=preference.userId===userId?preference.order:read(userId);
 useEffect(()=>{setPreference({userId,order:read(userId)});const sync=(e:StorageEvent)=>{if(e.key===resourceOrderKey(userId))setPreference({userId,order:read(userId)})};window.addEventListener('storage',sync);return()=>{window.removeEventListener('storage',sync);cancel.current?.()}},[userId]);
 const label=(id:ResourceTab)=>id==='chat'?'대화':id==='event'?'일정':'노트';
 const move=(from:string,to:string)=>{const next=[...order],a=next.indexOf(from as ResourceTab),b=next.indexOf(to as ResourceTab);if(a<0||b<0||a===b)return;next.splice(b,0,next.splice(a,1)[0]);setPreference({userId,order:next});try{localStorage.setItem(resourceOrderKey(userId),JSON.stringify(next))}catch{}setAnnouncement(label(from as ResourceTab)+' 탭을 '+(b+1)+'번째로 이동했습니다.')};
 return <div className="conversation-resource-tabs" role="tablist" aria-label="공간 자료" onPointerDown={e=>{cancel.current?.();cancel.current=startTabDrag(e.nativeEvent,e.currentTarget,move)}}>{order.map(t=><button key={t} data-reorder-id={t} role="tab" aria-selected={active===t} title="드래그로 순서 변경 · Alt+좌우 방향키" onClick={()=>onSelect(t)} onKeyDown={e=>{if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const i=order.indexOf(t)+(e.key==='ArrowRight'?1:-1);if(order[i])move(t,order[i])}}}>{label(t)}{counts[t]>0&&<span className="resource-count" aria-label={'확인할 '+counts[t]+'개'}>{Math.min(99,counts[t])}{counts[t]>99?'+':''}</span>}</button>)}<span className="tab-reorder-announcement" role="status">{announcement}</span></div>
}
