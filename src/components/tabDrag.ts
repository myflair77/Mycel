/** Horizontal pointer reordering shared by document tabs and personal navigation. */
export function tabDropIndex(x:number,centers:number[]){let target=0;for(let i=1;i<centers.length;i++)if(Math.abs(x-centers[i])<Math.abs(x-centers[target]))target=i;return target}
export function startTabDrag(event:PointerEvent,bar:HTMLElement,commit:(from:string,to:string)=>void){
 if(event.button!==0)return;const source=(event.target as HTMLElement).closest<HTMLElement>('[data-reorder-id]');if(!source||!bar.contains(source))return;
 const items=Array.from(bar.querySelectorAll<HTMLElement>('[data-reorder-id]')),from=items.indexOf(source),start=event.clientX,startY=event.clientY,pointer=event.pointerId;
 let dragging=false,target=from,ghost:HTMLElement|null=null,frame=0,x=start,y=startY,ended=false;
 const rect=source.getBoundingClientRect(),grab=start-rect.left,initialRects=items.map(el=>el.getBoundingClientRect()),initialScroll=bar.scrollLeft;
 const destination=()=>tabDropIndex(x,initialRects.map(r=>(r.left+r.right)/2-(bar.scrollLeft-initialScroll)));
 const preview=()=>{if(ended||!dragging)return;const bounds=bar.getBoundingClientRect();if(x<bounds.left+28)bar.scrollLeft-=8;else if(x>bounds.right-28)bar.scrollLeft+=8;
  const rects=initialRects;target=destination();
  items.forEach((el,i)=>{if(i===from)return;const shift=from<target&&i>from&&i<=target?-(rects[from].width+4):from>target&&i>=target&&i<from?rects[from].width+4:0;el.style.transform=shift?'translateX('+shift+'px)':''});
  if(ghost)ghost.style.transform='translate('+(x-grab)+'px,'+rect.top+'px)';frame=requestAnimationFrame(preview);
 };
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;x=e.clientX;y=e.clientY;if(!dragging){if(Math.abs(y-startY)>10&&Math.abs(y-startY)>Math.abs(x-start)){finish(false);return}if(Math.abs(x-start)<7)return;dragging=true;bar.dataset.tabDragging='true';source.style.opacity='.25';ghost=source.cloneNode(true) as HTMLElement;ghost.removeAttribute('id');ghost.removeAttribute('role');ghost.setAttribute('aria-hidden','true');ghost.className='tab-drag-ghost';Object.assign(ghost.style,{position:'fixed',left:'0',top:'0',width:rect.width+'px',height:rect.height+'px',pointerEvents:'none',zIndex:'4000',opacity:'.95'});document.body.append(ghost);source.setPointerCapture(pointer);preview()}e.preventDefault()};
 const suppress=(e:MouseEvent)=>{e.preventDefault();e.stopImmediatePropagation()};
 function finish(save:boolean){if(ended)return;ended=true;cancelAnimationFrame(frame);
  // Retain the visible preview positions, including the tab under the pointer.
  const before=new Map(items.map(el=>[el.dataset.reorderId!,el===source&&ghost?ghost.getBoundingClientRect().left:el.getBoundingClientRect().left]));
  ghost?.remove();items.forEach(el=>{el.style.transform='';el.style.opacity=''});delete bar.dataset.tabDragging;
  window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);
  if(dragging){bar.addEventListener('click',suppress,true);setTimeout(()=>bar.removeEventListener('click',suppress,true),0)}
  if(save&&dragging)target=destination();
  if(save&&dragging&&target!==from&&bar.isConnected)commit(items[from].dataset.reorderId!,items[target].dataset.reorderId!);
  if(dragging)animateTabPositions(bar,before);
 }
 const up=(e:PointerEvent)=>{if(e.pointerId===pointer)finish(true)},cancel=()=>finish(false),escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();finish(false)}};
 window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape);window.addEventListener('blur',cancel);
 return cancel;
}

/** Continue from the visible position instead of jumping back to the old order. */
export function animateTabPositions(bar:HTMLElement,before:Map<string,number>){requestAnimationFrame(()=>{if(!bar.isConnected||matchMedia('(prefers-reduced-motion: reduce)').matches)return;bar.querySelectorAll<HTMLElement>('[data-reorder-id]').forEach(el=>{const old=before.get(el.dataset.reorderId!);if(old===undefined)return;const delta=old-el.getBoundingClientRect().left;if(Math.abs(delta)<.5)return;el.animate([{transform:'translateX('+delta+'px)'},{transform:'translateX(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'})})})}
