import {useEffect,useRef} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

export function useBlockDrag(id:string,root:React.RefObject<HTMLElement|null>,onDrop?:(source:string,target:string,after:boolean,side:number)=>Promise<void>){
 const cleanup=useRef<()=>void>(()=>{}),suppress=useRef(false);
 useEffect(()=>()=>cleanup.current(),[]);
 function start(e:ReactPointerEvent<HTMLButtonElement>){
  if(!onDrop||e.button!==0)return;
  const node=root.current,list=node?.closest<HTMLElement>('[data-page-canvas]');if(!node||!list||list.querySelector('[data-dirty="true"]'))return;
  const initial=Array.from(list.querySelectorAll<HTMLElement>('[data-block-id]'));
  
  const x=e.clientX,y=e.clientY;let cy=y,cx=x,active=false,target=id,after=false,side=0,raf=0;
  const handle=e.currentTarget;handle.setPointerCapture(e.pointerId);
  let scroller:HTMLElement|null=list;
  while(scroller&&!(scroller.scrollHeight>scroller.clientHeight&&/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
  const startScroll=scroller?.scrollTop??0;const rects=new Map(initial.map(el=>[el,el.getBoundingClientRect()]));const rect=(el:HTMLElement)=>{const r=rects.get(el)!;const dy=startScroll-(scroller?.scrollTop??0);return {left:r.left,right:r.right,top:r.top+dy,bottom:r.bottom+dy,height:r.height}};
  const clearMarkers=()=>initial.forEach(el=>{el.classList.remove('drop-before','drop-after','drop-left','drop-right');if(el!==node)el.style.transform=''});
  const update=()=>{
   clearMarkers();const others=initial.filter(el=>el!==node);
   if(!others.length)return;
   let hit=others.reduce((best,el)=>{const r=rect(el),b=rect(best);const dist=(q:{top:number;bottom:number;left:number;right:number})=>Math.max(q.top-cy,0,cy-q.bottom)**2+Math.max(q.left-cx,0,cx-q.right)**2;return dist(r)<dist(b)?el:best},others[0]);
   const r=rect(hit);target=hit.dataset.blockId!;after=cy>r.top+r.height/2;
   side=Math.abs(cx-x)<48?0:cx<r.left+28?-1:cx>r.right-28?1:0;
   hit.classList.add(side<0?'drop-left':side>0?'drop-right':after?'drop-after':'drop-before');
   if(!side)hit.style.transform='translateY('+(after?-10:10)+'px)';
   node.style.transform='translate('+(cx-x)+'px,'+(cy-y+(scroller?.scrollTop??0)-startScroll)+'px)';
  };
  const tick=()=>{if(active&&scroller){const r=scroller.getBoundingClientRect();const d=cy<r.top+56?-12:cy>r.bottom-56?12:0;if(d){scroller.scrollTop+=d;update()}}raf=requestAnimationFrame(tick)};
  const move=(ev:PointerEvent)=>{if(ev.pointerId!==e.pointerId)return;cx=ev.clientX;cy=ev.clientY;if(!active&&Math.hypot(cx-x,cy-y)>6){active=true;suppress.current=true;node.classList.add('is-dragging');raf=requestAnimationFrame(tick)}if(active){ev.preventDefault();update()}};
  const finish=(cancel=false)=>{cancelAnimationFrame(raf);clearMarkers();node.classList.remove('is-dragging');node.style.transform='';window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelled);window.removeEventListener('keydown',key);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);cleanup.current=()=>{};if(active&&!cancel){void onDrop(id,target,after,side)}setTimeout(()=>{suppress.current=false},0)};
  const up=(ev:PointerEvent)=>{if(ev.pointerId===e.pointerId)finish()},cancelled=()=>finish(true),key=(ev:KeyboardEvent)=>{if(ev.key==='Escape')finish(true)};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelled);window.addEventListener('keydown',key);cleanup.current=()=>finish(true);
 }
 return {start,suppress};
}
