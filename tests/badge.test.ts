import {it,expect,vi} from 'vitest';
import {syncUnreadBadge} from '../src/features/notifications/badge';
it('sets unread total and clears on zero',async()=>{const target={setAppBadge:vi.fn(async()=>{}),clearAppBadge:vi.fn(async()=>{})};await syncUnreadBadge(3,target);await syncUnreadBadge(0,target);expect(target.setAppBadge).toHaveBeenCalledWith(3);expect(target.clearAppBadge).toHaveBeenCalledTimes(1)});
it('serializes updates and tolerates unsupported or denied badges',async()=>{const seen:number[]=[];const target={setAppBadge:async(n?:number)=>{seen.push(n!);if(n===2)throw new Error('denied')}};await Promise.all([syncUnreadBadge(2,target),syncUnreadBadge(1,target)]);expect(seen).toEqual([2,1]);await expect(syncUnreadBadge(3,{})).resolves.toBeUndefined()});
