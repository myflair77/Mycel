import {it,expect,vi} from 'vitest';
import {closeReadNotifications} from '../src/features/notifications/readNotifications';
const notice=(roomId:string)=>({data:{roomId},close:vi.fn()});
it('clears all notifications for read rooms while preserving other unread rooms',()=>{
 const a=notice('read'),b=notice('read'),c=notice('unread');
 closeReadNotifications([a,b,c],[{room_id:'read',unread_count:0},{room_id:'unread',unread_count:2}]);
 expect(a.close).toHaveBeenCalledTimes(1);expect(b.close).toHaveBeenCalledTimes(1);expect(c.close).not.toHaveBeenCalled();
});
it('retains arrivals after capture and notifications absent from authorized room results',()=>{
 const old=notice('room'),fresh=notice('room'),unknown=notice('other');const captured=[old,unknown];
 closeReadNotifications(captured,[{room_id:'room',unread_count:0}]);
 expect(old.close).toHaveBeenCalled();expect(fresh.close).not.toHaveBeenCalled();expect(unknown.close).not.toHaveBeenCalled();
});
it('cleans restored notifications on reopening and tolerates a failed close',()=>{
 const good=notice('room');closeReadNotifications([{data:{roomId:'room'},close:()=>{throw new Error('closed')}},good],[{room_id:'room',unread_count:0}]);expect(good.close).toHaveBeenCalled();
});

it('does not dismiss note mentions when chat messages are read',()=>{const mention={data:{roomId:'room',mentionId:'mention'},close:vi.fn()};closeReadNotifications([mention],[{room_id:'room',unread_count:0}]);expect(mention.close).not.toHaveBeenCalled()});
