import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';import {EditorState} from '@tiptap/pm/state';import {extensions} from '../src/features/workspace/pageExtensions';import {changeTabs} from '../src/features/workspace/pageTabs';import {uniqueIds,docToBlocks,blocksToDoc} from '../src/features/workspace/pageDocument';
const schema=getSchema(extensions());
it('preserves hidden tab content and formatting on rename, icon and reorder, including file and child note links',()=>{
 const doc=uniqueIds({type:'doc',content:[{type:'noteTabs',content:[{type:'noteTab',attrs:{label:'One'},content:[{type:'paragraph',content:[{type:'text',text:'Bold',marks:[{type:'bold'}]}]}]},{type:'noteTab',attrs:{label:'Two'},content:[{type:'childNote',attrs:{noteId:'child'}},{type:'noteFile',attrs:{fileId:'file',name:'test.png'}}]}]}]});let state=EditorState.create({schema,doc:schema.nodeFromJSON(doc)});const id=state.doc.firstChild!.child(1).attrs.id;
 for(const action of [{type:'rename',id,value:'Renamed'},{type:'icon',id,value:'📌'},{type:'move',id,delta:-1}] as const)state=state.apply(changeTabs(state,0,action)!);
 expect(state.doc.firstChild!.firstChild!.attrs.label).toBe('Renamed');expect(state.doc.firstChild!.firstChild!.attrs.icon).toBe('📌');expect(state.doc.textContent).toBe('Bold');expect(schema.nodeFromJSON(blocksToDoc(docToBlocks(state.doc.toJSON()))).toJSON()).toEqual(state.doc.toJSON());state.doc.check();
 state=state.apply(changeTabs(state,0,{type:'remove',id})!);expect(changeTabs(state,0,{type:'remove',id:state.doc.firstChild!.firstChild!.attrs.id})).toBeNull();
});
