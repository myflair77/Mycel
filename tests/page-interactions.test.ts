import {it,expect} from 'vitest';
import {arrangeBlocks,locateQuote} from '../src/features/workspace/pageInteractions';
const blocks=()=>['a','b','c'].map(id=>({id,content:{text:id} as any}));
it('keeps content and creates/clears columns while moving',()=>{
 let next=arrangeBlocks(blocks(),'c','a',false,1);
 expect(next.find(b=>b.id==='a')!.content._layout.column).toBe(0);
 expect(next.find(b=>b.id==='c')!.content._layout.column).toBe(1);
 next=arrangeBlocks(next,'c','b',true,0);
 expect(next.find(b=>b.id==='c')!.content._layout).toBeUndefined();
 expect(next.find(b=>b.id==='a')!.content._layout).toBeUndefined();
 expect(next.map(b=>b.content.text).sort()).toEqual(['a','b','c']);
});
it('uses unicode positions and refuses ambiguous changed quotes',()=>{
 const anchor={quote:'함께',start:5,end:7,version:1,prefix:'안녕 😀 ',suffix:' 일해요'};
 expect(locateQuote('안녕 😀 함께 일해요',anchor,1)).toEqual([6,8]);
 expect(locateQuote('다른 내용',anchor,2)).toBeNull();
 expect(locateQuote('안녕 😀 함께 일해요',anchor,2)).toEqual([6,8]);
 expect(locateQuote('반복 반복',{quote:'반복',start:0,end:2,version:1,prefix:'',suffix:''},2)).toBeNull();
});
