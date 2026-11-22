import {Extension} from '@tiptap/core';
import {Plugin,PluginKey,NodeSelection,type EditorState} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
type BlockRange={from:number;to:number};
export const activeBlockKey=new PluginKey<BlockRange|null>('editingBlock');
/** Use the same visible block boundary as the block controls, including list items. */
export function editingBlockRange(state:EditorState){
 if(state.selection instanceof NodeSelection){return state.selection.node.type.name==='syncedBlock'?null:{from:state.selection.from,to:state.selection.to}}
 const {$from}=state.selection;if(!$from.depth)return null;
 let depth=1;if($from.node(1).type.name==='columns'){if($from.depth<3)return null;depth=3}
 if(['bulletList','orderedList','taskList'].includes($from.node(depth).type.name)&&$from.depth>depth)depth++;
 const node=$from.node(depth);if(node.type.name==='syncedBlock')return null;
 return {from:$from.before(depth),to:$from.after(depth)};
}
export const ActiveBlock=Extension.create({name:'editingBlock',addProseMirrorPlugins(){return [new Plugin<BlockRange|null>({key:activeBlockKey,
 state:{init:()=>null,apply:(tr,range,_old,state)=>{const explicit=tr.getMeta(activeBlockKey);if(explicit!==undefined)return explicit;if(!range)return null;if(tr.selectionSet)return editingBlockRange(state);return tr.docChanged?{from:tr.mapping.map(range.from,1),to:tr.mapping.map(range.to,-1)}:range}},
 props:{decorations:state=>{const range=activeBlockKey.getState(state);return range?DecorationSet.create(state.doc,[Decoration.node(range.from,range.to,{class:'page-block-editing'})]):DecorationSet.empty}},
 view(view){const set=(range:BlockRange|null)=>{const old=activeBlockKey.getState(view.state);if(old?.from!==range?.from||old?.to!==range?.to)view.dispatch(view.state.tr.setMeta(activeBlockKey,range).setMeta('addToHistory',false))};
 const track=(event:Event)=>{const element=event.target;if(!(element instanceof Element))return;const target=element instanceof HTMLElement?element:element.parentElement;if(!target)return;
  if(view.dom.contains(target)){
   if(target.closest('.note-synced-block')){set(null);return}
   let block:HTMLElement|null=target;while(block&&block.parentElement!==view.dom&&!block.parentElement?.classList.contains('editor-column-content'))block=block.parentElement;
   const item=target.closest<HTMLElement>('li');if(item&&block?.contains(item))block=item;
   const id=block?.dataset.blockId;let range:BlockRange|null=null;if(id)view.state.doc.descendants((node,pos)=>{if(node.attrs.id===id)range={from:pos,to:pos+node.nodeSize}});set(range);return
  }
  if(target.closest('.editor-menu,.editor-handles,.mycel-emoji-picker,.tiptap-bubble-menu'))return;
  set(null);
 };
 document.addEventListener('pointerdown',track,true);document.addEventListener('focusin',track,true);
 return {destroy(){document.removeEventListener('pointerdown',track,true);document.removeEventListener('focusin',track,true)}};
 }
 })]}});
