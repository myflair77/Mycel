import {useEffect,useRef,useState} from 'react';
import {appendView,initialView,viewUrl,saveBeforeNavigation,type ResourceView,type ViewEntry} from './viewHistory';
export function useViewHistory(onChange:(view:ResourceView)=>void){
 const [entry,setEntry]=useState(()=>({view:initialView(location.search),index:0}));
 const entries=useRef<ViewEntry[]>([{view:entry.view,scroll:0,bottom:true}]),current=useRef(0),session=useRef(crypto.randomUUID()),callback=useRef(onChange),busy=useRef(false),skipPop=useRef(false),restoring=useRef(false);callback.current=onChange;
 const scrollElement=()=>document.querySelector<HTMLElement>(entries.current[current.current].view.tab==='chat'?'.message-list':'.conversation-resource-library');
 const capture=()=>{if(restoring.current)return;const el=scrollElement();if(el){const v=entries.current[current.current];v.scroll=el.scrollTop;v.bottom=el.scrollHeight-el.clientHeight-el.scrollTop<100}};
 const state=(index:number)=>({...history.state,mycelView:{session:session.current,index},weanoRoom:entries.current[index].view.room,weanoOverlay:false,mycelComments:false});
 function apply(index:number){restoring.current=true;current.current=index;setEntry({view:entries.current[index].view,index});callback.current(entries.current[index].view)}
 const closeOverlay=()=>{const dialog=document.querySelector<HTMLDialogElement>('dialog[open]');if(dialog){dialog.dispatchEvent(new Event('cancel',{cancelable:true}));return true}const details=document.querySelector<HTMLDetailsElement>('.document-more[open],.comment-more[open]');if(details){details.open=false;return true}const event=new Event('mycel-close-overlays',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented};
 useEffect(()=>{history.replaceState(state(0),'',viewUrl(entries.current[0].view));if(entries.current[0].view.room)callback.current(entries.current[0].view);
 const pop=async(e:PopStateEvent)=>{if(skipPop.current){skipPop.current=false;return}const target=e.state?.mycelView;if(!target||target.session!==session.current||!entries.current[target.index])return;if(target.index===current.current){closeOverlay();return}capture();const previous=current.current;
 if(busy.current){skipPop.current=true;history.go(previous-target.index);return}busy.current=true;try{if(!await saveBeforeNavigation()){skipPop.current=true;history.go(previous-target.index);return}apply(target.index)}finally{busy.current=false}};
 const scroll=(e:Event)=>{if(e.target===scrollElement())capture()};window.addEventListener('popstate',pop);document.addEventListener('scroll',scroll,true);return()=>{window.removeEventListener('popstate',pop);document.removeEventListener('scroll',scroll,true)};
 },[]);
 async function navigate(view:ResourceView){if(busy.current||JSON.stringify(view)===JSON.stringify(entry.view))return;busy.current=true;try{if(!await saveBeforeNavigation())return;capture();entries.current=appendView(entries.current,current.current,view);const index=entries.current.length-1;history.pushState(state(index),'',viewUrl(view));apply(index)}finally{busy.current=false}}
 function step(delta:number){if(closeOverlay()||busy.current)return;if(current.current+delta<0||current.current+delta>=entries.current.length)return;capture();history.go(delta)}
 return {finishRestoration:()=>{restoring.current=false},view:entry.view,index:entry.index,navigate,back:()=>step(-1),forward:()=>step(1),canBack:entry.index>0,canForward:entry.index<entries.current.length-1,snapshot:entries.current[entry.index]};
}
