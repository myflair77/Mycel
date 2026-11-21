import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';import {editingBlockRange} from '../src/features/workspace/pageActiveBlock';
const schema=getSchema(extensions());
it('moves editing outline with the cursor without changing document data',()=>{
 const p=(text:string)=>schema.nodes.paragraph.create(null,schema.text(text));const doc=schema.nodes.doc.create(null,[p('First'),p('Next')]);
 let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,2)});expect(editingBlockRange(state)).toEqual({from:0,to:7});
 state=state.apply(state.tr.setSelection(TextSelection.create(doc,9)));expect(editingBlockRange(state)).toEqual({from:7,to:13});expect(state.doc.eq(doc)).toBe(true);
});
it('outlines a column child instead of both columns',()=>{
 const p=schema.nodes.paragraph.create(null,schema.text('Text'));const doc=schema.nodes.doc.create(null,[schema.nodes.columns.create(null,[schema.nodes.column.create(null,[p]),schema.nodes.column.create(null,[p])])]);
 const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,3)});expect(editingBlockRange(state)).toEqual({from:2,to:8});
});
