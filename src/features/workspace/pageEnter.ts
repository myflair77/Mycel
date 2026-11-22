import {lift,setBlockType} from '@tiptap/pm/commands';
import {liftListItem} from '@tiptap/pm/schema-list';
import type {Command} from '@tiptap/pm/state';
import {TextSelection} from '@tiptap/pm/state';
import {TableMap} from '@tiptap/pm/tables';
// Other block types retain the editor's standard split/list/heading commands.
export const pageEnter:Command=(state,dispatch)=>{
 const {$from,empty}=state.selection;
 if(!empty)return false;
 for(let d=$from.depth;d>0;d--){
  if($from.node(d).type.name==='table'){
   const table=$from.node(d),start=$from.start(d),map=TableMap.get(table);
   let cellDepth=$from.depth;while(cellDepth>d&&!['tableCell','tableHeader'].includes($from.node(cellDepth).type.name))cellDepth--;
   if(cellDepth===d)return false;
   const rect=map.findCell($from.before(cellDepth)-start);
   if(rect.bottom<map.height){const pos=start+map.positionAt(rect.bottom,rect.left,table);dispatch?.(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos+1))).scrollIntoView())}
   return true;
  }
 }
 for(let d=$from.depth;d>0;d--){if($from.node(d).type.name==='callout'&&$from.parent.content.size===0&&$from.pos===$from.end(d)-1)return lift(state,dispatch)}
 if($from.parentOffset===$from.parent.content.size){
  for(let d=$from.depth;d>0;d--){if($from.node(d).type.name==='blockquote'&&$from.pos===$from.end(d)-1){
   const pos=$from.after(d),paragraph=state.schema.nodes.paragraph.create();
   if(dispatch){const tr=state.tr.insert(pos,paragraph);dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+1)).scrollIntoView())}
   return true;
  }}
 }
 return false;
};

export const pageBackspace:Command=(state,dispatch)=>{
 const {$from,empty}=state.selection;if(!empty||$from.parentOffset!==0)return false;
 for(let d=$from.depth;d>0;d--){const name=$from.node(d).type.name;if(['tableCell','tableHeader'].includes(name))return false;
 if(['listItem','taskItem'].includes(name)){if($from.pos!==$from.start(d)+1)return false;return liftListItem($from.node(d).type)(state,dispatch)}
 if(['blockquote','callout'].includes(name)&&$from.pos===$from.start(d)+1)return lift(state,dispatch);
 }
 if(['heading','codeBlock'].includes($from.parent.type.name))return setBlockType(state.schema.nodes.paragraph)(state,dispatch);
 return false;
};
