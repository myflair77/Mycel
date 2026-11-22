let requested:string|null=null;
export const requestedMentionFocus=()=>requested;
export function requestMentionFocus(id:string){requested=id;window.dispatchEvent(new CustomEvent('mycel-focus-mention',{detail:id}))}
export function revealMention(root:HTMLElement,id:string){
 const el=[...root.querySelectorAll<HTMLElement>('[data-mention-id]')].find(x=>x.dataset.mentionId===id);if(!el)return false;
 el.dispatchEvent(new CustomEvent('mycel-reveal-mention',{bubbles:true}));
 requestAnimationFrame(()=>{el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});el.classList.add('mention-focus');setTimeout(()=>el.classList.remove('mention-focus'),4000)});
 if(requested===id)requested=null;return true;
}
