import {expect,it} from 'vitest';
import {canMarkRead,contiguousReadPosition} from '../src/features/messages/readState';
it('marks only a selected, visible, focused conversation',()=>{
 expect(canMarkRead('room',true,true,true)).toBe(true);
 expect(canMarkRead('',true,true,true)).toBe(false);
 expect(canMarkRead('room',false,true,true)).toBe(false);
 expect(canMarkRead('room',true,false,true)).toBe(false);
 expect(canMarkRead('room',true,true,false)).toBe(false);
});
it('does not mark missing incoming rows or rows from another room',()=>{
 const rows=[{room_id:'a',sequence:1},{room_id:'a',sequence:3}];
 expect(contiguousReadPosition(rows,'a')).toBe(1);
 expect(contiguousReadPosition(rows,'b')).toBe(0);
 expect(contiguousReadPosition([{room_id:'a',sequence:1},{room_id:'a',sequence:2}], 'a')).toBe(2);
});
