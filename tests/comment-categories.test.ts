import {it,expect} from 'vitest';
import {commentCategory,commentCategoryCounts} from '../src/features/workspace/commentThreads';
it('classifies replies by their root and excludes deleted and fully resolved threads',()=>{
 const rows=[{id:'n',created_at:'1'},{id:'b',created_at:'1',block_id:'block'},{id:'p',created_at:'1',block_id:'block',anchor:{quote:'text'}},{id:'reply',created_at:'2',parent_id:'p',block_id:'block'},{id:'deleted',created_at:'3',parent_id:'p',deleted:true},{id:'resolved',created_at:'4',resolved:true}];
 expect(commentCategoryCounts(rows)).toEqual({general:1,block:1,phrase:2});expect(commentCategory(rows[2])).toBe('phrase');
});
