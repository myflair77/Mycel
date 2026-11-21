import {Node,Extension,mergeAttributes,InputRule,type Editor} from '@tiptap/core';
import {Fragment} from '@tiptap/pm/model';
import {TextSelection,type Command} from '@tiptap/pm/state';
const isEmptyBody=(body:any)=>body.childCount===1&&body.firstChild.type.name==='paragraph'&&body.firstChild.content.size===0;
export const toggleEnter:Command=(state,dispatch)=>{
 const {$from,$to}=state.selection;if($from.parent.type.name!=='toggleTitle'||!$from.sameParent($to))return false;
 const pos=$from.before($from.depth-1),toggle=$from.node($from.depth-1),body=toggle.lastChild!,title=toggle.firstChild!;
 if(title.content.size===0&&isEmptyBody(body))return toggleBackspace(state,dispatch);
 const left=title.copy(title.content.cut(0,$from.parentOffset)),tail=title.content.cut($to.parentOffset);
 let replacement:any,cursor:number;
 if(toggle.attrs.open){
  const paragraph=state.schema.nodes.paragraph.create(null,tail),children=isEmptyBody(body)?Fragment.from(paragraph):Fragment.from(paragraph).append(body.content);
  replacement=toggle.copy(Fragment.fromArray([left,body.copy(children)]));cursor=pos+left.nodeSize+3;
 }else{
  const sibling=state.schema.nodes.toggleBlock.create({open:false},[state.schema.nodes.toggleTitle.create(null,tail),state.schema.nodes.toggleBody.create(null,state.schema.nodes.paragraph.create())]);
  const first=toggle.copy(Fragment.fromArray([left,body]));replacement=Fragment.fromArray([first,sibling]);cursor=pos+first.nodeSize+2;
 }
 if(dispatch){const tr=state.tr.replaceWith(pos,pos+toggle.nodeSize,replacement);dispatch(tr.setSelection(TextSelection.create(tr.doc,cursor)).scrollIntoView())}return true;
};
export const toggleBackspace:Command=(state,dispatch)=>{
 const {$from,empty}=state.selection;if(!empty||$from.parentOffset!==0)return false;
 if($from.parent.type.name!=='toggleTitle'){
  if($from.depth>1&&$from.node($from.depth-1).type.name==='toggleBody'&&$from.index($from.depth-1)===0)return toggleOutdent(state,dispatch);
  return false;
 }
 const pos=$from.before($from.depth-1),toggle=$from.node($from.depth-1),body=toggle.lastChild!;
 const nodes=Fragment.from(state.schema.nodes.paragraph.create({id:toggle.attrs.id},toggle.firstChild!.content)).append(isEmptyBody(body)?Fragment.empty:body.content);
 if(dispatch){const tr=state.tr.replaceWith(pos,pos+toggle.nodeSize,nodes);dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+1)).scrollIntoView())}return true;
};
export const toggleOutdent:Command=(state,dispatch)=>{
 const {$from,$to}=state.selection;let bodyDepth=$from.depth;while(bodyDepth>0&&$from.node(bodyDepth).type.name!=='toggleBody')bodyDepth--;
 if(bodyDepth===0||$to.pos>$from.end(bodyDepth))return false;
 if($from.depth!==bodyDepth+1&&!($from.depth===bodyDepth+2&&$from.parent.type.name==='toggleTitle'))return false;
 const blockDepth=bodyDepth+1,child=$from.node(blockDepth),childPos=$from.before(blockDepth),togglePos=$from.before(bodyDepth-1),toggle=$from.node(bodyDepth-1),body=$from.node(bodyDepth);
 const rest=body.content.cut(0,childPos-$from.start(bodyDepth)).append(body.content.cut(childPos-$from.start(bodyDepth)+child.nodeSize));
 const next=toggle.copy(Fragment.fromArray([toggle.firstChild!,body.copy(rest.size?rest:Fragment.from(state.schema.nodes.paragraph.create()))]));
 if(dispatch){const tr=state.tr.replaceWith(togglePos,togglePos+toggle.nodeSize,Fragment.fromArray([next,child]));dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(togglePos+next.nodeSize+1+Math.max(0,$from.pos-childPos-1)))).scrollIntoView())}return true;
};
export const toggleIndent:Command=(state,dispatch)=>{
 const {$from,$to}=state.selection;let depth=$from.depth;if($from.parent.type.name==='toggleTitle')depth--;
 if(!depth||$from.index(depth-1)===0||$to.pos>$from.after(depth))return false;
 const parent=$from.node(depth-1),index=$from.index(depth-1),previous=parent.child(index-1);if(previous.type.name!=='toggleBlock')return false;
 const block=$from.node(depth),pos=$from.before(depth),start=pos-previous.nodeSize,body=previous.lastChild!;
 const children=isEmptyBody(body)?Fragment.from(block):body.content.append(Fragment.from(block));
 const replacement=previous.type.create({...previous.attrs,open:true},[previous.firstChild!,body.copy(children)]);
 const offset=isEmptyBody(body)?0:body.content.size;
 if(dispatch){const tr=state.tr.replaceWith(start,pos+block.nodeSize,replacement);dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start+previous.firstChild!.nodeSize+2+offset+($from.pos-pos)))).scrollIntoView())}return true;
};
export function insertToggle(editor:Editor){
 const {$from}=editor.state.selection;if(!['paragraph','heading'].includes($from.parent.type.name))return false;
 const pos=$from.before(),node=editor.schema.nodes.toggleBlock.create({id:$from.parent.attrs.id,open:true},[
 editor.schema.nodes.toggleTitle.create(null,$from.parent.content),editor.schema.nodes.toggleBody.create(null,editor.schema.nodes.paragraph.create())]);
 if(!$from.node($from.depth-1).canReplace($from.index($from.depth-1),$from.index($from.depth-1)+1,Fragment.from(node)))return false;
 const tr=editor.state.tr.replaceWith(pos,pos+$from.parent.nodeSize,node);editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+2)).scrollIntoView());return true;
}
export const ToggleInput=Extension.create({name:'toggleInput',priority:1200,
 addInputRules(){return [new InputRule({find:/^>\s$/,handler:({state,range})=>{const tr=state.tr,$from=tr.doc.resolve(range.from);if($from.parent.type.name!=='paragraph')return null;const pos=$from.before(),tail=$from.parent.content.cut(range.to-$from.start());const node=state.schema.nodes.toggleBlock.create({id:$from.parent.attrs.id,open:true},[state.schema.nodes.toggleTitle.create(null,tail),state.schema.nodes.toggleBody.create(null,state.schema.nodes.paragraph.create())]);tr.replaceWith(pos,pos+$from.parent.nodeSize,node).setSelection(TextSelection.create(tr.doc,pos+2))}})]}});
export const ToggleBlock=Node.create({name:'toggleBlock',group:'block',content:'toggleTitle toggleBody',defining:true,
 addAttributes(){return {open:{default:true,parseHTML:el=>el.getAttribute('data-open')!=='false',renderHTML:a=>({'data-open':String(a.open)})}}},
 parseHTML:()=>[{tag:'div[data-toggle-block]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-block':''}),0],
 addNodeView(){return ({node,editor,getPos})=>{let current=node,localOpen:boolean|null=null;const dom=document.createElement('div'),button=document.createElement('button'),contentDOM=document.createElement('div');
 dom.dataset.toggleBlock='';dom.className='editor-toggle';button.type='button';button.className='toggle-arrow';button.contentEditable='false';contentDOM.className='toggle-content';dom.append(button,contentDOM);
 const paint=()=>{const open=localOpen??current.attrs.open;dom.dataset.open=String(open);dom.dataset.empty=String(isEmptyBody(current.lastChild));dom.dataset.blockId=current.attrs.id;button.innerHTML='<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5 3.5 11 8l-6 4.5Z" fill="currentColor"/></svg>';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'토글 접기':'토글 펼치기')};paint();
 button.onmousedown=e=>e.preventDefault();button.onclick=()=>{const pos=getPos();if(typeof pos!=='number')return;const open=!(localOpen??current.attrs.open);
 if(!editor.isEditable){localOpen=open;paint();return}localOpen=null;let tr=editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,open});
 const bodyStart=pos+1+current.firstChild!.nodeSize;if(!open&&tr.selection.from>=bodyStart&&tr.selection.from<pos+current.nodeSize)tr=tr.setSelection(TextSelection.create(tr.doc,pos+2));editor.view.dispatch(tr)};
 return {dom,contentDOM,update(next){if(next.type!==current.type)return false;if(next.attrs.open!==current.attrs.open)localOpen=null;current=next;paint();return true},stopEvent:e=>button.contains(e.target as globalThis.Node),ignoreMutation:m=>button.contains(m.target)||m.type==='attributes'&&m.target===dom};};}
});
export const ToggleTitle=Node.create({name:'toggleTitle',content:'inline*',defining:true,parseHTML:()=>[{tag:'div[data-toggle-title]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-title':''}),0]});
export const ToggleBody=Node.create({name:'toggleBody',content:'block+',defining:true,parseHTML:()=>[{tag:'div[data-toggle-body]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-toggle-body':''}),0]});
