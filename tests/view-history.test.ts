import {it,expect} from 'vitest';
import {appendView,initialView,type ViewEntry} from '../src/features/workspace/viewHistory';
const view=(tab:'chat'|'event'|'note',item='')=>({room:'room',tab,item});
it('retains a single canonical room and truncates forward entries after branching',()=>{let stack:ViewEntry[]=[{view:view('chat'),scroll:240,bottom:false}];stack=appendView(stack,0,view('note','A'));stack=appendView(stack,1,view('event','B'));expect(stack[0].scroll).toBe(240);expect(appendView(stack,1,view('note','C')).map(x=>x.view.item)).toEqual(['','A','C']);expect(appendView(stack,2,view('event','B'))).toBe(stack)});
it('only restores recognized resource tabs and UUID identifiers',()=>{expect(initialView('?room=invalid&tab=bad&item=wrong')).toEqual({room:'',tab:'chat',item:''});expect(initialView('?room=00000000-0000-0000-0000-000000000001&tab=note&item=00000000-0000-0000-0000-000000000002').tab).toBe('note')});
