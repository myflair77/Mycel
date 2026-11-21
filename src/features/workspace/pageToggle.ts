import {Node,mergeAttributes,type Editor} from '@tiptap/core';
import {Fragment} from '@tiptap/pm/model';
import {TextSelection,type Command} from '@tiptap/pm/state';
export const toggleEnter:Command=(state,dispatch)=>{
 const {$from}=state.selection;if($from.parent.type.name!=='toggleTitle')return false;
 const pos=$from.before($from.depth-1),toggle=$from.node($from.depth-1),body=pos+1+toggle.firstChild!.nodeSize;
 if(dispatch){const tr=state.tr.setNodeMarkup(pos,undefined,{...toggle.attrs,open:true});dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(body+1))).scrollIntoView())}return true;
};
export const toggleBackspace:Command=(state,dispatch)=>{
 const {$from,empty}=state.selection;if(!empty||$from.parent.type.name!=='toggleTitle'||$from.parentOffset!==0)return false;
 const pos=$from.before($from.depth-1),toggle=$from.node($from.depth-1);
 const nodes=Fragment.from(state.schema.nodes.paragraph.create({id:toggle.attrs.id},toggle.firstChild!.content)).append(toggle.lastChild!.content);
 if(dispatch){const tr=state.tr.replaceWith(pos,pos+toggle.nodeSize,nodes);dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+1)).scrollIntoView())}return true;
};
export function insertToggle(editor:Editor){
 const {$from}=editor.state.selection;if(!['paragraph','heading'].includes($from.parent.type.name))return false;
 const pos=$from.before(),node=editor.schema.nodes.toggleBlock.create({id:$from.parent.attrs.id,open:true},[
 editor.schema.nodes.toggleTitle.create(null,$from.parent.content),editor.schema.nodes.toggleBody.create(null,editor.schema.nodes.paragraph.create())]);
 if(!$from.node($from.depth-1).canReplace($from.index($from.depth-1),$from.index($from.depth-1)+1,Fragment.from(node)))return false;
 const tr=editor.state.tr.replaceWith(pos,pos+$from.parent.nodeSize,node);editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+2)).scrollIntoView());return true;
}
export const ToggleBlock=Node.create({
 name:'toggleBlock',group:'block',content:'toggleTitle toggleBody',defining:true,
 addAttributes(){return {open:{default:true,parseHTML:el=>el.getAttribute('data-open')!=='false',renderHTML:a=>({'data-open':String(a.open)})}}},
 parseHTML:()=>[{tag:'div[data-toggle-block]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-block':''}),0],
 addNodeView(){return ({node,editor,getPos})=>{let current=node,localOpen:boolean|null=null;const dom=document.createElement('div'),button=document.createElement('button'),contentDOM=document.createElement('div');
 dom.dataset.toggleBlock='';dom.className='editor-toggle';button.type='button';button.className='toggle-arrow';button.contentEditable='false';contentDOM.className='toggle-content';dom.append(button,contentDOM);
 const paint=()=>{const open=localOpen??current.attrs.open;dom.dataset.open=String(open);dom.dataset.blockId=current.attrs.id;button.textContent=open?'▾':'▸';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'토글 접기':'토글 펼치기')};paint();
 button.onmousedown=e=>e.preventDefault();button.onclick=()=>{const pos=getPos();if(typeof pos!=='number')return;const open=!(localOpen??current.attrs.open);
 if(!editor.isEditable){localOpen=open;paint();return}localOpen=null;let tr=editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,open});
 const bodyStart=pos+1+current.firstChild!.nodeSize;if(!open&&tr.selection.from>=bodyStart&&tr.selection.from<pos+current.nodeSize)tr=tr.setSelection(TextSelection.create(tr.doc,pos+2));editor.view.dispatch(tr)};
 return {dom,contentDOM,update(next){if(next.type!==current.type)return false;if(next.attrs.open!==current.attrs.open)localOpen=null;current=next;paint();return true},stopEvent:e=>button.contains(e.target as globalThis.Node),ignoreMutation:m=>button.contains(m.target)||m.type==='attributes'&&m.target===dom};};}
});
export const ToggleTitle=Node.create({name:'toggleTitle',content:'inline*',defining:true,parseHTML:()=>[{tag:'div[data-toggle-title]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-title':''}),0]});
export const ToggleBody=Node.create({name:'toggleBody',content:'block+',defining:true,parseHTML:()=>[{tag:'div[data-toggle-body]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-body':''}),0]});
