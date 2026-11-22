let requested:string|null=null;
export const requestedBlockFocus=()=>requested;
export function requestBlockFocus(id:string){requested=id;window.dispatchEvent(new CustomEvent('mycel-focus-block',{detail:id}))}
export function finishBlockFocus(id:string){if(requested===id)requested=null}
