import {it,expect} from 'vitest';
import {blocksToDoc,docToBlocks,uniqueIds} from '../src/features/workspace/pageDocument';
it('preserves old block ids, table contents and column widths',()=>{
 const a=crypto.randomUUID(),b=crypto.randomUUID(),g=crypto.randomUUID();
 const blocks=[{id:a,kind:'text',version:1,content:{text:'문장\n둘째 줄',_layout:{group:g,column:0,width:52}}},{id:b,kind:'table',version:1,content:{rows:[['A','B'],['C','D']],_layout:{group:g,column:1,width:48}}}];
 const next=docToBlocks(uniqueIds(blocksToDoc(blocks)));
 expect(next.map(x=>x.id)).toEqual([a,b]);expect(next[0].content.text).toBe('문장\n둘째 줄');expect(next[1].content.rows).toEqual([['A','B'],['C','D']]);expect(next[0].content._layout.width).toBe(52);
 expect(docToBlocks(blocksToDoc(next))).toEqual(next);
});
it('retains rich formatting and assigns distinct ids to duplicated blocks',()=>{
 const id=crypto.randomUUID();const node={type:'paragraph',attrs:{id},content:[{type:'text',text:'강조',marks:[{type:'bold'}]}]};
 const doc=uniqueIds({type:'doc',content:[node,node]});const blocks=docToBlocks(doc);
 expect(new Set(blocks.map(b=>b.id)).size).toBe(2);expect(blocksToDoc(blocks).content?.[0].content?.[0].marks).toEqual([{type:'bold'}]);
});

it('stores list items separately without losing numbering, marks, checks or the original block id',()=>{
 const doc=uniqueIds({type:'doc',content:[{type:'orderedList',attrs:{id:'original',start:4},content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'first',marks:[{type:'bold'}]}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'second'}]}]}]},{type:'taskList',attrs:{id:'tasks'},content:[{type:'taskItem',attrs:{checked:true},content:[{type:'paragraph',content:[{type:'text',text:'done'}]}]},{type:'taskItem',attrs:{checked:false},content:[{type:'paragraph',content:[{type:'text',text:'next'}]}]}]}]});
 const saved=docToBlocks(doc);expect(saved).toHaveLength(4);expect(saved[0].id).toBe('original');expect(saved[2].id).toBe('tasks');expect(saved.slice(0,2).map(b=>b.content._rich.attrs.start)).toEqual([4,5]);expect(saved[0].content._rich.content[0].content[0].content[0].marks).toEqual([{type:'bold'}]);expect(saved.slice(2).map(b=>b.content.checked)).toEqual([true,false]);
 const again=docToBlocks(uniqueIds(blocksToDoc(saved)));expect(again.map(b=>b.id)).toEqual(saved.map(b=>b.id));expect(again.map(b=>b.content.text)).toEqual(['first','second','done','next']);
});
