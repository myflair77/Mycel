import {it,expect,vi,afterEach} from 'vitest';
import {readInvite,installShareUrl,clearInvite} from '../src/features/invites/context';
afterEach(()=>vi.unstubAllGlobals());
it('keeps invite code across restarts but never copies auth tokens to Chrome',()=>{
 const map=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>map.get(k),setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});
 const token='a'.repeat(64);vi.stubGlobal('location',new URL('https://example.com/?i='+token+'#access_token=secret'));
 expect(readInvite()).toBe(token);expect(installShareUrl()).toBe('https://example.com/?i='+token);
 vi.stubGlobal('location',new URL('https://example.com/'));expect(readInvite()).toBe(token);expect(installShareUrl()).toBe('https://example.com/?i='+token);
 const replace=vi.fn();vi.stubGlobal('history',{replaceState:replace});clearInvite();expect(readInvite()).toBe(null);
});
