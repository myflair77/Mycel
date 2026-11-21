import {useRef, type TouchEvent} from 'react';

// A vertical scroll stays with the content. A horizontal drag near the leading
// edge (or on the open drawer) tracks the finger until release.
export function usePhoneDrawer(enabled:boolean, opened:boolean, setOpened:(value:boolean)=>void) {
  const gesture=useRef<{x:number;y:number;width:number;active:boolean;opened:boolean}|null>(null);
  function clear(node:HTMLElement) {
    gesture.current=null;
    node.removeAttribute('data-panel-drag');
    node.style.removeProperty('--panel-offset');
    node.style.removeProperty('--panel-opacity');
  }
  return {
    onTouchStart(e:TouchEvent<HTMLDivElement>) {
      const node=e.currentTarget;
      clear(node);
      if(!enabled || e.touches.length!==1 || !(e.target instanceof Element) ||
        e.target.closest('dialog,.mycel-ai-panel,input,textarea,select,[contenteditable=true]'))return;
      const rail=node.querySelector('.rail')?.getBoundingClientRect();
      const touch=e.touches[0];
      if(!rail || (!opened && touch.clientX>node.getBoundingClientRect().left+32))return;
      const panel=node.querySelector(node.dataset.section==='me'?'.personal-sidebar':'.chat-list');
      if(panel)gesture.current={x:touch.clientX,y:touch.clientY,width:panel.getBoundingClientRect().width,active:false,opened};
    },
    onTouchMove(e:TouchEvent<HTMLDivElement>) {
      const g=gesture.current;
      if(!g)return;
      const node=e.currentTarget;
      if(!enabled||e.touches.length!==1||g.opened!==opened){clear(node);return;}
      const dx=e.touches[0].clientX-g.x, dy=e.touches[0].clientY-g.y;
      if(!g.active){
        if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
        if(Math.abs(dx)<=Math.abs(dy)*1.2 || (opened?dx>0:dx<0)){clear(node);return;}
        g.active=true;
      }
      const progress=Math.max(0,Math.min(1,(opened?1:0)+dx/Math.max(1,g.width)));
      node.dataset.panelDrag='true';
      node.style.setProperty('--panel-offset',(progress*100-100)+'%');
      node.style.setProperty('--panel-opacity',String(progress));
    },
    onTouchEnd(e:TouchEvent<HTMLDivElement>) {
      const g=gesture.current;
      if(g?.active){
        const dx=e.changedTouches[0].clientX-g.x;
        if(Math.abs(dx)>Math.min(64,g.width*.28))setOpened(dx>0);
      }
      clear(e.currentTarget);
    },
    onTouchCancel(e:TouchEvent<HTMLDivElement>){clear(e.currentTarget);}
  };
}
