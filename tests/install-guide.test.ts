import {it,expect} from 'vitest';
import {installPlatform} from '../src/components/InstallButton';
it('distinguishes Galaxy Chrome, Edge, Samsung and desktop mode tablets',()=>{
 expect(installPlatform('Mozilla Android Chrome/140.0 EdgA/140.0')).toMatchObject({android:true,edge:true,chrome:false});
 expect(installPlatform('Mozilla Android Chrome/140.0')).toMatchObject({android:true,edge:false,chrome:true});
 expect(installPlatform('Mozilla Android SamsungBrowser/28 Chrome/140.0').chrome).toBe(false);
 expect(installPlatform('Mozilla X11 Linux Chrome/140 Edg/140','Android')).toMatchObject({android:true,edge:true,chrome:false});
 expect(installPlatform('Mozilla Windows Chrome/140 Edg/140','Win32',10).android).toBe(false);
 expect(installPlatform('Mozilla Mac Safari/605','MacIntel',5).ios).toBe(true);
});
