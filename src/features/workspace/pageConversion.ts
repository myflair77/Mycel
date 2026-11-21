import type {Node, Schema} from '@tiptap/pm/model';
import {Fragment} from '@tiptap/pm/model';
import {TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
export const conversionTypes=[['text','텍스트'],['h1','제목 1'],['h2','제목 2'],['h3','제목 3'],['bullet','글머리 목록'],['number','번호 목록'],['check','체크박스'],['quote','인용'],['toggle','토글 목록'],['toggle1','토글 제목 1'],['toggle2','토글 제목 2'],['toggle3','토글 제목 3']] as const;
export type Conversion=(typeof conversionTypes)[number][0];
export function blockType(node:Node,parent?:Node):string {
 const name=node.type.name;
 if(name==='heading')return 'h'+node.attrs.level;
 if(name==='toggleBlock')return 'toggle'+(node.attrs.level||'');
 if(name==='listItem')return parent?.type.name==='orderedList'?'number':'bullet';
 return ({paragraph:'text',taskItem:'check',blockquote:'quote',codeBlock:'code',syncedBlock:'sync'} as Record<string,string>)[name]??name;
}
function parts(node:Node,schema:Schema):{head:Node;tail:Node[]} | null {
 if(node.isTextblock)return {head:node,tail:[]};
 if(node.type.name==='toggleBlock')return {head:node.firstChild!,tail:Array.from(node.lastChild!.content.content)};
 if(['listItem','taskItem','blockquote'].includes(node.type.name)&&node.firstChild?.isTextblock)return {head:node.firstChild,tail:Array.from(node.content.content).slice(1)};
 return null;
}
function converted(node:Node,target:Conversion,schema:Schema,id:string):Node[]|null {
 const data=parts(node,schema);if(!data)return null;
 const {head,tail}=data;
 const paragraph=schema.nodes.paragraph.create({id},head.content);
 if(target==='text'||/^h[123]$/.test(target))return [(target==='text'?schema.nodes.paragraph:schema.nodes.heading).create({id,...(target==='text'?{}:{level:Number(target[1])})},head.content),...tail];
 if(target.startsWith('toggle'))return [schema.nodes.toggleBlock.create({id,open:node.type.name==='toggleBlock'?node.attrs.open:true,level:Number(target.slice(6))||0},[schema.nodes.toggleTitle.create(null,head.content),schema.nodes.toggleBody.create(null,tail.length?tail:schema.nodes.paragraph.create())])];
 if(target==='quote')return [schema.nodes.blockquote.create({id},[schema.nodes.paragraph.create(null,head.content),...tail])];
 const list=target==='check'?'taskList':target==='number'?'orderedList':'bulletList',item=target==='check'?'taskItem':'listItem';
 return [schema.nodes[list].create({id},schema.nodes[item].create(target==='check'?{checked:node.attrs.checked??false}:null,[paragraph.type.create(null,head.content),...tail]))];
}
/** One transaction keeps undo atomic and only splits the selected list item. */
export function convertBlock(state:EditorState,pos:number,target:Conversion,id:string,dispatch?:(tr:Transaction)=>void):boolean {
 const node=state.doc.nodeAt(pos);if(!node)return false;
 const $pos=state.doc.resolve(pos);
 if(blockType(node,$pos.parent)===target)return true;
 const nodes=converted(node,target,state.schema,id);if(!nodes)return false;
 let from=pos,to=pos+node.nodeSize,replacement=nodes,caret=pos;
 if(['listItem','taskItem'].includes(node.type.name)){
  const parent=$pos.parent,index=$pos.index(),all=Array.from(parent.content.content),before=all.slice(0,index),after=all.slice(index+1);
  from=$pos.before();to=from+parent.nodeSize;replacement=[];
  if(before.length)replacement.push(parent.copy(Fragment.from(before)));
  caret=from+replacement.reduce((sum,n)=>sum+n.nodeSize,0);
  replacement.push(...nodes);
  if(after.length)replacement.push(parent.type.create({...parent.attrs,id:index===0?null:parent.attrs.id,start:(parent.attrs.start??1)+index+1},after));
  // The original list ID belongs to the first item; do not duplicate it after splitting.
  if(index>0&&replacement.length&&before.length)replacement[replacement.length-1]=after.length?parent.type.create({...parent.attrs,id:null,start:(parent.attrs.start??1)+index+1},after):replacement[replacement.length-1];
 }
 const $from=state.doc.resolve(from),fragment=Fragment.from(replacement);
 if(!$from.parent.canReplace($from.index(),$from.index()+1,fragment))return false;
 if(dispatch){const tr=state.tr.replaceWith(from,to,fragment);tr.setSelection(TextSelection.near(tr.doc.resolve(caret+1))).scrollIntoView();dispatch(tr)}return true;
}
