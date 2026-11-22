import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorState} from '@tiptap/pm/state';
export function findProjectedCell(doc:PMNode,id:string){
 let found:{node:PMNode;pos:number}|null=null;
 if(id)doc.descendants((node,pos)=>{if((node.type.name==='tableCell'||node.type.name==='tableHeader')&&node.attrs.id===id){found={node,pos};return false}});
 return found as {node:PMNode;pos:number}|null;
}
/** Update only this stable cell, never a sorted row index or the whole table. */
export function editProjectedCell(state:EditorState,id:string,before:PMNode,after:PMNode){
 const source=findProjectedCell(state.doc,id);
 if(!source||!source.node.content.eq(before.content)||!source.node.type.validContent(after.content))return null;
 const start=before.content.findDiffStart(after.content);if(start===null)return null;
 const end=before.content.findDiffEnd(after.content)!;const overlap=start-Math.min(end.a,end.b);
 const a=end.a+Math.max(0,overlap),b=end.b+Math.max(0,overlap);
 return state.tr.replace(source.pos+1+start,source.pos+1+a,after.slice(start,b)).setMeta('personalTableCellEdit',true);
}
