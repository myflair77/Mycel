import {selectedCells} from './tableCells';
import {pageEnter,pageBackspace} from './pageEnter';
import {Extension,Node as TipNode,mergeAttributes,type JSONContent,type Editor} from '@tiptap/core';
import {Plugin,PluginKey,TextSelection} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
export const commentKey=new PluginKey('pageComments');
const types=['paragraph','heading','blockquote','bulletList','orderedList','listItem','taskList','taskItem','horizontalRule','codeBlock','table','tableRow','tableCell','tableHeader','columns','column'];
export const Identity=Extension.create({
 name:'pageIdentity',
 addGlobalAttributes(){return [{types,attributes:{id:{default:null,parseHTML:el=>el.getAttribute('data-block-id'),renderHTML:a=>a.id?{'data-block-id':a.id}:{}}}}]},
 addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,_old,state){if(!transactions.some(t=>t.docChanged))return null;const seen=new Set<string>(),tr=state.tr;state.doc.descendants((n,p)=>{if(!types.includes(n.type.name))return;let id=n.attrs.id;if(!id||seen.has(id)){id=crypto.randomUUID();tr.setNodeMarkup(p,undefined,{...n.attrs,id})}seen.add(id)});return tr.docChanged?tr:null}})]}
});
export const Comments=Extension.create({name:'pageComments',addProseMirrorPlugins(){return [new Plugin({key:commentKey,state:{init:()=>DecorationSet.empty,apply(tr,old){const spans=tr.getMeta(commentKey);return spans?DecorationSet.create(tr.doc,spans.map((s:any)=>Decoration.inline(s.from,s.to,{'class':'page-comment-mark','data-comment-id':s.id}))):old.map(tr.mapping,tr.doc)}},props:{decorations:state=>commentKey.getState(state)}})]}});
export const Columns=TipNode.create({name:'columns',group:'block',content:'column{2,4}',isolating:true,parseHTML:()=>[{tag:'div[data-columns]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-columns':'','class':'editor-columns'}),0]});
export const Column=TipNode.create({
 name:'column',content:'block+',isolating:true,
 addAttributes(){return {width:{default:50,parseHTML:e=>Number(e.getAttribute('data-width'))||50,renderHTML:a=>({'data-width':a.width,style:'flex-basis:'+a.width+'%'})}}},
 parseHTML:()=>[{tag:'div[data-column]'}],
 renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-column':'','class':'editor-column'}),0],
 addNodeView(){return ({node,editor,getPos})=>{let current=node;const dom=document.createElement('div'),contentDOM=document.createElement('div'),handle=document.createElement('button');dom.className='editor-column';dom.dataset.column='';contentDOM.className='editor-column-content';handle.className='editor-column-resize';handle.contentEditable='false';handle.type='button';handle.setAttribute('aria-label','열 너비 조절');handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.tabIndex=0;dom.append(contentDOM,handle);
 const paint=()=>{dom.style.flexBasis=current.attrs.width+'%';dom.dataset.blockId=current.attrs.id;handle.setAttribute('aria-valuenow',String(current.attrs.width));handle.hidden=!editor.isEditable};paint();
 function pair(){const p=getPos();if(typeof p!=='number')return;const $p=editor.state.doc.resolve(p),parent=$p.parent,index=$p.index();if(index>=parent.childCount-1)return;return {p,next:parent.child(index+1),nextPos:p+current.nodeSize}}
 function commit(width:number){const a=pair();if(!a)return;const total=current.attrs.width+a.next.attrs.width;editor.view.dispatch(editor.state.tr.setNodeMarkup(a.p,undefined,{...current.attrs,width}).setNodeMarkup(a.nextPos,undefined,{...a.next.attrs,width:total-width}))}
 handle.onkeydown=e=>{if(!editor.isEditable)return;const a=pair();if(!a)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();commit(Math.max(15,Math.min(current.attrs.width+a.next.attrs.width-15,current.attrs.width+(e.key==='ArrowRight'?2:-2))))}};
 handle.onpointerdown=e=>{if(!editor.isEditable)return;const a=pair();if(!a)return;e.preventDefault();handle.setPointerCapture(e.pointerId);const start=e.clientX,initial=current.attrs.width,total=initial+a.next.attrs.width,parentWidth=dom.parentElement!.getBoundingClientRect().width,nextDom=dom.nextElementSibling as HTMLElement;let width=initial;
 const move=(ev:PointerEvent)=>{width=Math.max(15,Math.min(total-15,initial+100*(ev.clientX-start)/parentWidth));dom.style.flexBasis=width+'%';if(nextDom)nextDom.style.flexBasis=(total-width)+'%'};
 const finish=(ev:PointerEvent)=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);commit(width)};
 const cancel=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);paint();if(nextDom)nextDom.style.flexBasis=a.next.attrs.width+'%'};
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
 };return {dom,contentDOM,update(n){if(n.type!==current.type)return false;current=n;paint();return true},stopEvent:e=>handle.contains(e.target as globalThis.Node),ignoreMutation:m=>m.type==='attributes'&&(m.target===dom||m.target===handle)}}
 }
});
export const PageEnter=Extension.create({name:'pageEnter',priority:1100,addKeyboardShortcuts(){return {Backspace:()=>pageBackspace(this.editor.state,tr=>this.editor.view.dispatch(tr)),Enter:()=>pageEnter(this.editor.state,tr=>this.editor.view.dispatch(tr))}}});
export const CellStyle=Extension.create({name:'cellStyle',addGlobalAttributes(){return [{types:['tableCell','tableHeader'],attributes:{color:{default:null,parseHTML:e=>e.style.color,renderHTML:a=>a.color?{style:'color:'+a.color}:{}},background:{default:null,parseHTML:e=>e.style.backgroundColor,renderHTML:a=>a.background?{style:'background-color:'+a.background}:{}},align:{default:null,parseHTML:e=>e.style.textAlign,renderHTML:a=>a.align?{style:'text-align:'+a.align}:{}}}}]}});
export const ActiveCell=Extension.create({name:'activeCell',addProseMirrorPlugins(){return [new Plugin({props:{decorations:state=>DecorationSet.create(state.doc,selectedCells(state).map(pos=>Decoration.node(pos,pos+state.doc.nodeAt(pos)!.nodeSize,{class:'active-table-cell'})))}})]}});
export function extensions(){return [ActiveCell,CellStyle,PageEnter,StarterKit.configure({heading:{levels:[1,2,3]},link:{openOnClick:false,protocols:['https','http','mailto']}}),TableKit.configure({table:{resizable:true}}),TaskList,TaskItem.configure({nested:true,HTMLAttributes:{'data-type':'taskItem'}}),Placeholder.configure({placeholder:({node})=>node.type.name==='paragraph'?'내용을 입력하거나 / 로 블록 추가':''}),Identity,Columns,Column,Comments]}
export function blockPositions(editor:Editor){
 const entries:{id:string;pos:number;node:any}[]=[];
 const add=(n:any,pos:number)=>{if(['bulletList','orderedList','taskList'].includes(n.type.name)){n.forEach((item:any,offset:number,index:number)=>entries.push({id:index===0?n.attrs.id:item.attrs.id,pos:pos+offset+1,node:item}))}else entries.push({id:n.attrs.id,pos,node:n})};
 editor.state.doc.forEach((n,pos)=>{if(n.type.name==='columns'){n.forEach((col,offset)=>col.forEach((b,bo)=>add(b,pos+offset+bo+2)))}else add(n,pos)});return entries
}
export function selectionQuote(editor:Editor){const {from,to}=editor.state.selection;if(from===to)return null;const b=blockPositions(editor).find(b=>from>b.pos&&to<=b.pos+b.node.nodeSize-1);if(!b||!b.node.isTextblock)return null;const text=b.node.textBetween(0,b.node.content.size,'\n','\n'),start=from-b.pos-1,end=to-b.pos-1;return {blockId:b.id,quote:text.slice(start,end),start:Array.from(text.slice(0,start)).length,end:Array.from(text.slice(0,end)).length}}

