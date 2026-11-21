import {describe,expect,it,vi} from 'vitest';
import {usePhoneDrawer} from '../src/components/usePhoneDrawer';
vi.mock('react',()=>({useRef:(current:unknown)=>({current})}));

function gesture(opened:boolean) {
  class Target {closest(){return null;}}
  vi.stubGlobal('Element',Target);
  const setOpened=vi.fn();
  const handlers=usePhoneDrawer(true,opened,setOpened);
  const values=new Map<string,string>();
  const node={getBoundingClientRect:()=>({left:0}),dataset:{section:'chats'},removeAttribute:vi.fn(),
    style:{setProperty:(key:string,value:string)=>values.set(key,value),removeProperty:(key:string)=>values.delete(key)},
    querySelector:(selector:string)=>({getBoundingClientRect:()=>selector==='.rail'?{right:48}:{width:280}})};
  const event=(x:number,y=100)=>({currentTarget:node,target:new Target(),touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}]}) as unknown as Parameters<typeof handlers.onTouchStart>[0];
  return {handlers,event,values,setOpened};
}
describe('phone navigation gestures',()=>{
  it('follows a drag from the content edge and opens on release',()=>{
    const {handlers,event,values,setOpened}=gesture(false);
    handlers.onTouchStart(event(20));handlers.onTouchMove(event(160));
    expect(values.get('--panel-offset')).toBe('-50%');
    handlers.onTouchEnd(event(160));expect(setOpened).toHaveBeenCalledWith(true);
    expect(values.size).toBe(0);
  });
  it('tracks the open drawer leftward and closes on release',()=>{
    const {handlers,event,values,setOpened}=gesture(true);
    handlers.onTouchStart(event(230));handlers.onTouchMove(event(90));
    expect(values.get('--panel-opacity')).toBe('0.5');
    handlers.onTouchEnd(event(90));expect(setOpened).toHaveBeenCalledWith(false);
  });
  it('ignores vertical scrolls and lets short drags snap back',()=>{
    const {handlers,event,setOpened}=gesture(true);
    handlers.onTouchStart(event(200));handlers.onTouchMove(event(190,140));handlers.onTouchEnd(event(120,220));
    handlers.onTouchStart(event(200));handlers.onTouchMove(event(170));handlers.onTouchEnd(event(170));
    expect(setOpened).not.toHaveBeenCalled();
  });
});

