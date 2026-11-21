import {Extension} from '@tiptap/core';
import {Plugin} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {Fragment} from '@tiptap/pm/model';
import type {EditorState,Transaction} from '@tiptap/pm/state';
import {iconColors} from '../../components/iconValue';
export const blockColors=iconColors.map(c=>({...c,background:c.id==='default'?'transparent':({gray:'#efefed',brown:'#f2e8e2',yellow:'#faf3d9',orange:'#fbecdf',green:'#e7f1e9',blue:'#e6eff9',purple:'#efe8f6',pink:'#f7e6ef',red:'#fae7e5'} as Record<string,string>)[c.id]}));
export const listFormats=[['default','기본','ListOrdered'],['decimal','숫자','ListOrdered'],['lower-alpha','글자','ALargeSmall'],['upper-roman','로마 숫자','Type']] as const;
const types=['paragraph','heading','blockquote','listItem','taskItem','codeBlock','table','toggleBlock','noteTabs','childNote','noteFile','syncedBlock'];
const validColor=(value:unknown)=>blockColors.some(c=>c.id===value)&&value!=='default'?String(value):null;
export const BlockAppearance=Extension.create({name:'blockAppearance',
 addGlobalAttributes(){return [{types,attributes:{blockText:{default:null,parseHTML:el=>validColor(el.getAttribute('data-block-text')),renderHTML:a=>validColor(a.blockText)?{'data-block-text':a.blockText}:{}},blockBackground:{default:null,parseHTML:el=>validColor(el.getAttribute('data-block-background')),renderHTML:a=>validColor(a.blockBackground)?{'data-block-background':a.blockBackground}:{}}}},{types:['orderedList'],attributes:{listFormat:{default:'default',parseHTML:el=>listFormats.find(f=>f[0]===el.getAttribute('data-list-format'))?.[0]??'default',renderHTML:a=>listFormats.some(f=>f[0]===a.listFormat)?{'data-list-format':a.listFormat,style:'list-style-type:'+(a.listFormat==='default'?'decimal':a.listFormat)}:{}}}}]},
 addProseMirrorPlugins(){return [new Plugin({props:{decorations:state=>{const spans:Decoration[]=[];state.doc.descendants((node,pos)=>{if(!types.includes(node.type.name))return;const text=blockColors.find(c=>c.id===validColor(node.attrs.blockText)),bg=blockColors.find(c=>c.id===validColor(node.attrs.blockBackground));if(text||bg)spans.push(Decoration.node(pos,pos+node.nodeSize,{class:'page-colored-block',style:(text?'color:'+text.hex+';':'')+(bg?'background-color:'+bg.background+';':'')}))});return DecorationSet.create(state.doc,spans)}}})]}
});
/** Splits only the selected numbered item; neighboring list contents/starts stay intact. */
export function changeListFormat(state:EditorState,pos:number,format:string,dispatch?:(tr:Transaction)=>void){
 if(!listFormats.some(f=>f[0]===format))return false;
 const $pos=state.doc.resolve(pos),node=state.doc.nodeAt(pos),parent=$pos.parent;if(node?.type.name!=='listItem'||parent.type.name!=='orderedList')return false;
 const all=Array.from(parent.content.content),index=$pos.index(),replacement=[];
 if(index)replacement.push(parent.copy(Fragment.from(all.slice(0,index))));
 replacement.push(parent.type.create({...parent.attrs,id:index?null:parent.attrs.id,start:(parent.attrs.start??1)+index,listFormat:format},node));
 if(index+1<all.length)replacement.push(parent.type.create({...parent.attrs,id:null,start:(parent.attrs.start??1)+index+1},all.slice(index+1)));
 if(dispatch)dispatch(state.tr.replaceWith($pos.before(),$pos.after(),Fragment.from(replacement)));return true;
}
