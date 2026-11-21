import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';
import {toggleEnter,toggleBackspace,insertToggle} from '../src/features/workspace/pageToggle';
import {docToBlocks,blocksToDoc,uniqueIds} from '../src/features/workspace/pageDocument';
const schema=getSchema(extensions());const p=(t='')=>schema.nodes.paragraph.create(null,t?schema.text(t):null);
const toggle=(open=true)=>schema.nodes.toggleBlock.create({id:'toggle-id',open},[schema.nodes.toggleTitle.create(null,schema.text('Title',[schema.marks.bold.create()])),schema.nodes.toggleBody.create(null,[p('Body'),schema.nodes.bulletList.create(null,schema.nodes.listItem.create(null,p('List')))])]);
it('roundtrips collapsed toggle, rich nested content and IDs through existing block storage',()=>{
 const doc=uniqueIds(schema.nodes.doc.create(null,[toggle(false),p('Following')]).toJSON());const blocks=docToBlocks(doc);expect(blocks[0].kind).toBe('text');expect(blocks[0].content.text).toContain('Body');
 const restored=schema.nodeFromJSON(blocksToDoc(blocks));expect(restored.toJSON()).toEqual(doc);expect(restored.firstChild!.attrs.open).toBe(false);expect(restored.firstChild!.firstChild!.firstChild!.marks[0].type.name).toBe('bold');
});
it('Enter in the toggle title opens its body without duplicating or discarding text',()=>{
 const doc=schema.nodes.doc.create(null,[toggle(false),p('Following')]);let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,7)});
 expect(toggleEnter(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.selection.$from.parent.textContent).toBe('Body');expect(state.doc.firstChild!.attrs.open).toBe(true);expect(state.doc.textContent).toBe(doc.textContent);
});
it('Backspace at title start unwraps all children and preserves formatting',()=>{
 const doc=schema.nodes.doc.create(null,[toggle(),p('Following')]);let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,2)});
 expect(toggleBackspace(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(4);expect(state.doc.firstChild!.attrs.id).toBe('toggle-id');expect(state.doc.firstChild!.firstChild!.marks[0].type.name).toBe('bold');expect(state.doc.textContent).toBe(doc.textContent);
});
it('converts a paragraph without losing its content and supports undo transactions',()=>{
 const doc=schema.nodes.doc.create(null,[p('Existing title'),p('Following')]);let state=EditorState.create({schema,doc,selection:TextSelection.create(doc,3)});
 const editor={get state(){return state},schema,view:{dispatch(tr:any){state=state.apply(tr)}}} as any;
 expect(insertToggle(editor)).toBe(true);expect(state.doc.firstChild!.type.name).toBe('toggleBlock');expect(state.doc.firstChild!.firstChild!.textContent).toBe('Existing title');expect(state.doc.child(1).textContent).toBe('Following');expect(state.selection.from).toBe(2);
});
