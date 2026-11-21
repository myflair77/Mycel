import {it,expect} from 'vitest';
import {commentThreads} from '../src/features/workspace/commentThreads';
const c=(id:string,parent_id:string|null=null,resolved=false,deleted=false)=>({id,parent_id,resolved,deleted,created_at:id});
it('groups nested replies with their target and keeps the original first',()=>{const groups=commentThreads([c('3','2'),c('1'),c('2','1'),c('4')]);expect(groups.map(g=>g.items.map(x=>x.id))).toEqual([['1','2','3'],['4']])});
it('keeps replies to deleted roots and hides only wholly resolved threads',()=>{expect(commentThreads([c('1',null,false,true),c('2','1')])).toHaveLength(1);expect(commentThreads([c('1',null,true)])).toHaveLength(0);expect(commentThreads([c('1',null,true)],true)).toHaveLength(1)});
