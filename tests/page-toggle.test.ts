import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';
import {toggleEnter,toggleBackspace,insertToggle,toggleIndent,toggleOutdent} from '../src/features/workspace/pageToggle';
import {docToBlocks,blocksToDoc,uniqueIds} from '../src/features/workspace/pageDocument';
const schema=getSchema(extensions());const p=(t='')=>schema.nodes.paragraph.create(null,t?schema.text(t):null);
const toggle=(open=true)=>schema.nodes.toggleBlock.create({id:'toggle-id',open},[schema.nodes.toggleTitle.create(null,schema.text('Title',[schema.marks.bold.create()])),schema.nodes.toggleBody.create(null,[p('Body'),schema.nodes.bulletList.create(null,schema.nodes.listItem.create(null,p('List')))])]);
const stateAt=(nodes:any[],pos:number)=>{const doc=schema.nodes.doc.create(null,nodes);return EditorState.create({schema,doc,selection:TextSelection.create(doc,pos)})};
it('roundtrips collapsed toggle, rich nested content and IDs through existing block storage',()=>{
 const doc=uniqueIds(schema.nodes.doc.create(null,[toggle(false),p('Following')]).toJSON());const blocks=docToBlocks(doc);expect(blocks[0].kind).toBe('text');expect(blocks[0].content.text).toContain('Body');
 const restored=schema.nodeFromJSON(blocksToDoc(blocks));expect(restored.toJSON()).toEqual(doc);expect(restored.firstChild!.attrs.open).toBe(false);expect(restored.firstChild!.firstChild!.firstChild!.marks[0].type.name).toBe('bold');
});
it('open title Enter inserts a first child and splits text without losing existing children or marks',()=>{
 let state=stateAt([toggle(),p('Following')],4);
 expect(toggleEnter(state,tr=>{state=state.apply(tr)})).toBe(true);
 expect(state.doc.firstChild!.firstChild!.textContent).toBe('Ti');expect(state.selection.$from.parent.textContent).toBe('tle');expect(state.doc.firstChild!.lastChild!.child(1).textContent).toBe('Body');expect(state.selection.$from.parent.firstChild!.marks[0].type.name).toBe('bold');expect(state.doc.textContent).toBe('TitleBodyListFollowing');state.doc.check();
});
it('closed title Enter creates a sibling toggle while retaining collapsed child content',()=>{
 let state=stateAt([toggle(false),p('Following')],7);
 expect(toggleEnter(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(3);expect(state.doc.firstChild!.attrs.open).toBe(false);expect(state.doc.firstChild!.lastChild!.textContent).toBe('BodyList');expect(state.doc.child(1).type.name).toBe('toggleBlock');expect(state.selection.$from.parent.type.name).toBe('toggleTitle');state.doc.check();
});
it('Backspace at title start unwraps all children and preserves formatting',()=>{
 let state=stateAt([toggle(),p('Following')],2);const text=state.doc.textContent;
 expect(toggleBackspace(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(4);expect(state.doc.firstChild!.attrs.id).toBe('toggle-id');expect(state.doc.firstChild!.firstChild!.marks[0].type.name).toBe('bold');expect(state.doc.textContent).toBe(text);
});
it('empty title Enter exits toggle without leaving an extra placeholder paragraph',()=>{
 const empty=schema.nodes.toggleBlock.create(null,[schema.nodes.toggleTitle.create(),schema.nodes.toggleBody.create(null,p())]);let state=stateAt([empty],2);
 expect(toggleEnter(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(1);expect(state.doc.firstChild!.type.name).toBe('paragraph');state.doc.check();
});
it('Tab nests a block under the preceding toggle and Shift-Tab restores it with its ID',()=>{
 const child=p('Nested');let state=stateAt([toggle(false),child,p('Following')],toggle(false).nodeSize+1);
 expect(toggleIndent(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.childCount).toBe(2);expect(state.doc.firstChild!.attrs.open).toBe(true);expect(state.doc.firstChild!.lastChild!.lastChild!.textContent).toBe('Nested');expect(state.selection.$from.parent.textContent).toBe('Nested');state.doc.check();
 expect(toggleOutdent(state,tr=>{state=state.apply(tr)})).toBe(true);expect(state.doc.child(1).textContent).toBe('Nested');expect(state.doc.firstChild!.lastChild!.textContent).toBe('BodyList');state.doc.check();
});
it('converts a paragraph without losing its content and supports undo transactions',()=>{
 let state=stateAt([p('Existing title'),p('Following')],3);
 const editor={get state(){return state},schema,view:{dispatch(tr:any){state=state.apply(tr)}}} as any;
 expect(insertToggle(editor)).toBe(true);expect(state.doc.firstChild!.type.name).toBe('toggleBlock');expect(state.doc.firstChild!.firstChild!.textContent).toBe('Existing title');expect(state.doc.child(1).textContent).toBe('Following');expect(state.selection.from).toBe(2);
});
it('keeps paragraph as the default block so editor initialization and ordinary Enter cannot create invalid toggles',()=>{expect(schema.topNodeType.contentMatch.defaultType?.name).toBe('paragraph');schema.topNodeType.createAndFill()!.check()});
it('Shift-Tab in a nested list does not extract the entire list from its toggle',()=>{const t=toggle();let pos=0;t.descendants((node,offset)=>{if(node.type.name==='paragraph'&&node.textContent==='List')pos=offset+2});let state=stateAt([t],pos);expect(toggleOutdent(state)).toBe(false)});
