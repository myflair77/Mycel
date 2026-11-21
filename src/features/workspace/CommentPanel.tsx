import {createPortal} from 'react-dom';
import {useEffect,useRef,type ReactNode} from 'react';
export function CommentPanel({drawer,open,onClose,children}:{drawer:boolean;open:boolean;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose),ownsEntry=useRef(false);close.current=onClose;
 useEffect(()=>{if(!drawer||!open)return;ownsEntry.current=true;history.pushState({...history.state,weanoOverlay:true,mycelComments:true},'',location.href);const pop=()=>{ownsEntry.current=false;close.current()};window.addEventListener('popstate',pop);return()=>{window.removeEventListener('popstate',pop);if(ownsEntry.current&&history.state?.mycelComments)history.back();ownsEntry.current=false}},[drawer,open]);
 useEffect(()=>{const el=ref.current;if(!drawer||!el)return;if(open&&!el.open)el.showModal();else if(!open&&el.open)el.close();
 const resize=()=>{const v=window.visualViewport;el.style.height=(v?.height??window.innerHeight)+'px';el.style.top=(v?.offsetTop??0)+'px'};resize();window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
 return()=>{window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize)};
 },[drawer,open]);
 if(!drawer)return <section className="page-comments">{children}</section>;
 return createPortal(<dialog ref={ref} className="note-comment-drawer page-comments" aria-label="노트 댓글" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target!==ref.current)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}>{children}</dialog>,document.querySelector('.app')??document.body);
}
