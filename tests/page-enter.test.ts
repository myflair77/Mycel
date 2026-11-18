import {joinBackward} from '@tiptap/pm/commands';
import {moveTableRow,moveTableColumn} from '@tiptap/pm/tables';
import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';
import {pageEnter,pageBackspace} from '../src/features/workspace/pageEnter';
const schema=getSchema(extensions());
const p=(text:string)=>schema.nodes.paragraph.create(null,text?schema.text(text):null);
it('leaves a completed quote immediately before the following block',()=>{
 const doc=schema.nodes.doc.create(null,[schema.nodes.blockquote.create(null,p('quote')),p('following')]);
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,7)});
 expect(pageEnter(state,tr=>{state=state.apply(tr)})).toBe(true);
 expect(state.doc.child(1).type.name).toBe('paragraph');expect(state.doc.child(1).textContent).toBe('');expect(state.doc.child(2).textContent).toBe('following');expect(state.selection.$from.parent.textContent).toBe('');
});
it('moves vertically in tables without inserting rows or splitting cell text',()=>{
 const cell=(t:string)=>schema.nodes.tableCell.create(null,p(t));const row=(a:string,b:string)=>schema.nodes.tableRow.create(null,[cell(a),cell(b)]);
 const doc=schema.nodes.doc.create(null,[schema.nodes.table.create(null,[row('a','b'),row('c','d')])]);
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
 expect(pageEnter(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.selection.$from.parent.textContent).toBe('c');expect(state.doc.eq(doc)).toBe(true);
 const pos=state.selection.from;expect(pageEnter(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.selection.from).toBe(pos);expect(state.doc.eq(doc)).toBe(true);
});
it('keeps ordinary paragraph splitting delegated to the default editor',()=>{
 const doc=schema.nodes.doc.create(null,p('abcdef'));const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});expect(pageEnter(state)).toBe(false);
});

it('unwraps the second list item before merging its text backwards',()=>{
 const item=(text:string)=>schema.nodes.listItem.create(null,p(text));
 const doc=schema.nodes.doc.create(null,[schema.nodes.bulletList.create(null,[item('one'),item('two')])]);
 let pos=0;doc.descendants((n,offset)=>{if(n.isText&&n.text==='two')pos=offset});
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos)});
 expect(pageBackspace(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(2);expect(state.doc.child(1).type.name).toBe('paragraph');expect(state.doc.textContent).toBe('onetwo');
 expect(pageBackspace(state)).toBe(false);expect(joinBackward(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.textContent).toBe('onetwo');
});
it('unwraps quotes and headings without deleting text',()=>{
 for(const block of [schema.nodes.blockquote.create(null,p('quote')),schema.nodes.heading.create({level:2},schema.text('heading'))]){
 const doc=schema.nodes.doc.create(null,[p('before'),block]);let pos=0;doc.descendants((n,offset)=>{if(n.isText&&n.text!=='before')pos=offset});let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,pos)});expect(pageBackspace(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.child(1).type.name).toBe('paragraph');expect(state.doc.textContent).toBe(doc.textContent);
 }
});
it('moves whole rows and columns preserving cell text and formatting',()=>{
 const cell=(t:string)=>schema.nodes.tableCell.create({background:'#dbeafe'},p(t));const row=(a:string,b:string)=>schema.nodes.tableRow.create(null,[cell(a),cell(b)]);
 const doc=schema.nodes.doc.create(null,[schema.nodes.table.create(null,[row('A','B'),row('C','D'),row('E','F')])]);let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
 expect(moveTableRow({from:0,to:2,pos:1})(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.firstChild?.textContent).toBe('CDEFAB');
 expect(moveTableColumn({from:0,to:1,pos:1})(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.firstChild?.textContent).toBe('DCFEBA');expect(state.doc.firstChild?.firstChild?.firstChild?.attrs.background).toBe('#dbeafe');
});

it('exposes each bullet and task item as an independent handle target',async()=>{
 const {blockPositions}=await import('../src/features/workspace/pageExtensions');
 const doc=schema.nodes.doc.create(null,[schema.nodes.bulletList.create({id:'list'},[schema.nodes.listItem.create({id:'a'},p('one')),schema.nodes.listItem.create({id:'b'},p('two'))]),schema.nodes.taskList.create({id:'tasks'},[schema.nodes.taskItem.create({id:'c',checked:false},p('task'))])]);
 const blocks=blockPositions({state:{doc}} as any);expect(blocks.map(b=>b.id)).toEqual(['list','b','tasks']);expect(blocks.map(b=>b.node.textContent)).toEqual(['one','two','task']);for(const b of blocks)expect(doc.nodeAt(b.pos)).toBe(b.node);
});
