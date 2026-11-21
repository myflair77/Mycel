import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';import {EditorState} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';import {changeListFormat} from '../src/features/workspace/pageBlockAppearance';import {convertBlock} from '../src/features/workspace/pageConversion';import {blocksToDoc,docToBlocks,uniqueIds} from '../src/features/workspace/pageDocument';import {blockSubmenuPosition} from '../src/features/workspace/blockMenuPosition';
const schema=getSchema(extensions());
it('changes only one list item format while preserving neighboring starts, content and bold',()=>{
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(uniqueIds({type:'doc',content:[{type:'orderedList',attrs:{start:4},content:['첫째','둘째','셋째'].map(text=>({type:'listItem',content:[{type:'paragraph',content:[{type:'text',text,marks:[{type:'bold'}]}]}]}))}]}))});
 const pos=1+state.doc.firstChild!.firstChild!.nodeSize;expect(changeListFormat(state,pos,'lower-alpha',tr=>state=state.apply(tr))).toBe(true);expect(state.doc.childCount).toBe(3);expect(state.doc.child(0).attrs.start).toBe(4);expect(state.doc.child(1).attrs.start).toBe(5);expect(state.doc.child(1).attrs.listFormat).toBe('lower-alpha');expect(state.doc.child(2).attrs.start).toBe(6);expect(state.doc.textContent).toBe('첫째둘째셋째');expect(state.doc.child(1).firstChild!.firstChild!.firstChild!.marks[0].type.name).toBe('bold');state.doc.check();
 expect(schema.nodeFromJSON(blocksToDoc(docToBlocks(state.doc.toJSON()))).toJSON()).toEqual(state.doc.toJSON());
});
it('retains block colors and text marks through conversion and saved document round trip',()=>{
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(uniqueIds({type:'doc',content:[{type:'paragraph',attrs:{blockText:'blue',blockBackground:'yellow'},content:[{type:'text',text:'보존',marks:[{type:'italic'}]}]}]}))});
 const id=state.doc.firstChild!.attrs.id;expect(convertBlock(state,0,'toggle',id,tr=>state=state.apply(tr))).toBe(true);expect(state.doc.firstChild!.attrs.blockText).toBe('blue');expect(state.doc.firstChild!.attrs.blockBackground).toBe('yellow');expect(state.doc.firstChild!.firstChild!.firstChild!.marks[0].type.name).toBe('italic');expect(schema.nodeFromJSON(blocksToDoc(docToBlocks(state.doc.toJSON()))).toJSON()).toEqual(state.doc.toJSON());
});
it('places a submenu beside its parent and flips at the right screen edge',()=>{
 const viewport={left:0,top:0,right:1200,bottom:800},size={width:260,height:500};let p=blockSubmenuPosition({left:300,top:200,right:560,bottom:500},240,viewport,size);expect(p.left).toBe(566);expect(p.top).toBe(240);p=blockSubmenuPosition({left:900,top:600,right:1160,bottom:780},650,viewport,size);expect(p.left).toBe(634);expect(p.top+p.maxHeight).toBeLessThanOrEqual(792);
});
