import {describe,it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState} from '@tiptap/pm/state';
import {iconColors,parseIcon,iconPreference,isUploadedIcon} from '../src/components/iconValue';
import {extensions} from '../src/features/workspace/pageExtensions';
import {symbolContent} from '../src/features/workspace/pageInlineIcon';
import {changeTabs} from '../src/features/workspace/pageTabs';
import {blocksToDoc,docToBlocks,uniqueIds} from '../src/features/workspace/pageDocument';
describe('symbol persistence and safety',()=>{
 it('supports ten fixed colors and rejects arbitrary styles/markup/remote images',()=>{
  expect(iconColors).toHaveLength(10);for(const c of iconColors)expect(parseIcon('icon:CalendarDays:'+c.id)?.color.id).toBe(c.id);
  for(const s of ['icon:Star:url(x)','icon:<svg>:red','icon:__proto__:red','icon:Star:unknown','📅'])expect(parseIcon(s)).toBeNull();
  for(const s of ['https://example.test/a.png','data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)','data:image/png;base64,'+'a'.repeat(70000)])expect(isUploadedIcon(s)).toBe(false);
  expect(isUploadedIcon('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
 });
 it('validates saved preference without altering existing icon values',()=>{
  expect(iconPreference({color:'blue',ask:true})).toEqual({color:'blue',ask:true});
  expect(iconPreference({color:'url()',ask:'true'})).toEqual({color:'default',ask:false});
  expect(parseIcon('icon:Star:red')?.color.id).toBe('red');
 });
 it('round trips colored inline icons, adjacent marks and legacy emoji',()=>{
  const schema=getSchema(extensions()),doc=uniqueIds({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'앞',marks:[{type:'bold'}]},symbolContent('icon:Star:blue'),symbolContent('👍🏽'),{type:'text',text:'뒤'}]}]});
  const original=schema.nodeFromJSON(doc);original.check();const restored=schema.nodeFromJSON(blocksToDoc(docToBlocks(original.toJSON())));expect(restored.toJSON()).toEqual(original.toJSON());expect(restored.firstChild!.child(1).attrs.value).toBe('icon:Star:blue');expect(restored.firstChild!.firstChild!.marks[0].type.name).toBe('bold');
 });
 it('preserves tab contents and full icon token on changing representative icon',()=>{
  const schema=getSchema(extensions()),doc=uniqueIds({type:'doc',content:[{type:'noteTabs',content:[{type:'noteTab',content:[{type:'paragraph',content:[{type:'text',text:'유지할 내용'}]}]}]}]});
  let state=EditorState.create({schema,doc:schema.nodeFromJSON(doc)});const id=state.doc.firstChild!.firstChild!.attrs.id,value='icon:ArrowDownNarrowWide:purple';state=state.apply(changeTabs(state,0,{type:'icon',id,value})!);expect(state.doc.firstChild!.firstChild!.attrs.icon).toBe(value);expect(state.doc.textContent).toBe('유지할 내용');
 });
});
