import {describe,it,expect} from 'vitest';
// @ts-expect-error The Worker module is native JavaScript.
import {planCalendarChange} from '../worker/calendar-plan.mjs';
describe('calendar reconciliation',()=>{
 const mapping={mycel_version:2,google_version:'a'};
 const local={version:2,deleted:false}, remote={version:'a',deleted:false};
 const compare=(mycel:any,google:any,base:any=mapping,direction='both')=>planCalendarChange({mycel,google,mapping:base,direction});
 it('distinguishes independently changed sides',()=>{
   expect(compare(local,remote)).toBe('unchanged');
   expect(compare({...local,version:3},remote)).toBe('preview_update_in_google');
   expect(compare(local,{...remote,version:'b'})).toBe('preview_update_in_mycel');
   expect(compare({...local,version:3},{...remote,version:'b'})).toBe('review_conflict');
 });
 it('holds missing observations and possible duplicates for review',()=>{
   expect(compare(local,null)).toBe('review_missing_record');
   expect(compare(local,remote,null)).toBe('review_possible_duplicate');
   expect(compare(null,remote,null)).toBe('preview_create_in_mycel');
   expect(compare(local,null,null)).toBe('preview_create_in_google');
   expect(compare(local,null,null,'import')).toBe('skip');
 });
 it('requires evidence of deletion and never deletes automatically',()=>{
   expect(compare(local,{version:'b',deleted:true})).toBe('review_delete_in_mycel');
   expect(compare({version:3,deleted:true},remote)).toBe('review_delete_in_google');
 });
});
