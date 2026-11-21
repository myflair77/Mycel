type PageLeaveOptions={dirty:()=>boolean;canEdit:()=>boolean;preserve:()=>void;retry:()=>void;save:()=>Promise<boolean>};
// A revoked permission must protect the server without trapping the local draft.
export async function savePageForNavigation(o:PageLeaveOptions){
 if(!o.dirty())return true;
 const keepDraft=()=>{o.preserve();return true};
 if(!o.canEdit())return keepDraft();
 o.retry();
 for(let n=0;n<20;n++){
  if(!o.canEdit())return keepDraft();
  if(!await o.save())return !o.canEdit()?keepDraft():false;
  if(!o.dirty())return true;
 }
 return false;
}
