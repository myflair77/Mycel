import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';
import {pageEnter} from '../src/features/workspace/pageEnter';
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
