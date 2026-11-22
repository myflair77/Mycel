import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {extensions} from '../src/features/workspace/pageExtensions';
import {applyInlineColor} from '../src/features/workspace/pageInlineColor';
import {docToBlocks,blocksToDoc,uniqueIds} from '../src/features/workspace/pageDocument';
const schema=getSchema(extensions());
it('colors a substring without changing adjacent text, bold, or its background; saves and restores it',()=>{
 let state=EditorState.create({schema,doc:schema.nodeFromJSON(uniqueIds({type:'doc',content:[{type:'paragraph',attrs:{blockText:'blue'},content:[{type:'text',text:'Alpha Bravo Charlie',marks:[{type:'bold'},{type:'inlineColor',attrs:{background:'yellow'}}]}]}]}))});
 state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,7,12)));const dispatch=(tr:any)=>state=state.apply(tr);
 expect(applyInlineColor(state,'text','red',dispatch)).toBe(true);const parts=state.doc.firstChild!.content.content;expect(parts.map(n=>n.text)).toEqual(['Alpha ','Bravo',' Charlie']);expect(parts[1].marks.map(m=>m.type.name)).toContain('bold');expect(schema.marks.inlineColor.isInSet(parts[1].marks)?.attrs).toEqual({text:'red',background:'yellow'});expect(schema.marks.inlineColor.isInSet(parts[0].marks)?.attrs.text).toBeNull();
 expect(schema.nodeFromJSON(blocksToDoc(docToBlocks(state.doc.toJSON()))).toJSON()).toEqual(state.doc.toJSON());
 applyInlineColor(state,'text','default',dispatch);expect(schema.marks.inlineColor.isInSet(state.doc.firstChild!.firstChild!.marks)?.attrs.background).toBe('yellow');expect(state.doc.firstChild!.attrs.blockText).toBe('blue');
 applyInlineColor(state,'background','default',dispatch);expect(schema.marks.inlineColor.isInSet(state.doc.firstChild!.child(1).marks)).toBeUndefined();expect(state.doc.firstChild!.child(1).marks[0].type.name).toBe('bold');
});
it('rejects empty selections and unrecognized style values',()=>{const state=EditorState.create({schema,doc:schema.node('doc',null,[schema.node('paragraph',null,[schema.text('safe')])])});expect(applyInlineColor(state,'text','red')).toBe(false);const selected=state.apply(state.tr.setSelection(TextSelection.create(state.doc,1,5)));expect(applyInlineColor(selected,'text','url(unsafe)')).toBe(false)});
