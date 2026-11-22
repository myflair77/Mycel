import {expect,it} from 'vitest';
import {dateAttrs,dateDefaults,dateMentionLabel,dateMentionError,dayInZone,dateMentionEndAfterHour,parseMentionTimeInput} from '../src/features/workspace/dateMentionModel';
it('defaults to full date and 24-hour display',()=>{expect(dateDefaults).toMatchObject({dateFormat:'full',timeFormat:'24',reminder:'none'});expect(dateMentionLabel({target:'2026-11-23',time:'09:00'})).toBe('2026년 11월 23일 09:00')});
it('formats midnight/noon and hides time without changing the instant',()=>{const a={target:'2026-11-23',time:'00:05',timeFormat:'12'};expect(dateMentionLabel(a)).toBe('2026년 11월 23일 오전 12:05');expect(dateMentionLabel({...a,time:'12:05'})).toContain('오후 12:05');expect(dateMentionLabel({...a,timeFormat:'hidden'})).toBe('2026년 11월 23일');expect(a.time).toBe('00:05')});
it('supports all numeric date formats and ranges',()=>{const a={target:'2026-11-23'};expect(dateMentionLabel({...a,dateFormat:'short'})).toBe('2026. 11. 23.');expect(dateMentionLabel({...a,dateFormat:'mdy'})).toBe('11/23/2026');expect(dateMentionLabel({...a,dateFormat:'dmy'})).toBe('23/11/2026');expect(dateMentionLabel({...a,dateFormat:'ymd',endDate:'2026-11-24'})).toBe('2026/11/23 – 2026/11/24')});
it('uses selected timezone at midnight for relative date display',()=>{const now=new Date('2026-11-22T16:00:00Z'),a={target:'2026-11-23',dateFormat:'relative'};expect(dateMentionLabel({...a,timeZone:'Asia/Seoul'},now)).toBe('오늘');expect(dateMentionLabel({...a,timeZone:'UTC'},now)).toBe('내일');expect(dateMentionLabel({...a,target:'2026-11-22',timeZone:'Asia/Seoul'},now)).toBe('어제');expect(dateMentionLabel({...a,target:'2026-11-30'},now)).toBe('2026년 11월 30일');expect(dayInZone(now,'Asia/Seoul')).toBe('2026-11-23')});
it('rejects invalid times, dates, zones and backwards ranges',()=>{expect(dateMentionError(dateAttrs({target:'2026-02-30'}))).not.toBe('');expect(dateMentionError(dateAttrs({target:'2026-11-23',time:'24:00'}))).not.toBe('');expect(dateMentionError(dateAttrs({target:'2026-11-23',timeZone:'x'}))).not.toBe('');expect(dateMentionError(dateAttrs({target:'2026-11-23',time:'15:00',endDate:'2026-11-23',endTime:'14:00'}))).not.toBe('')});
it('defaults the end to one hour later and rolls dates over at midnight',()=>{
 expect(dateMentionEndAfterHour('2026-12-02','13:29')).toEqual({endDate:'2026-12-02',endTime:'14:29'});
 expect(dateMentionEndAfterHour('2026-12-31','23:30')).toEqual({endDate:'2027-01-01',endTime:'00:30'});
 expect(dateMentionEndAfterHour('2028-02-28','23:15')).toEqual({endDate:'2028-02-29',endTime:'00:15'});
 expect(dateMentionEndAfterHour('2026-12-02','')).toEqual({endDate:'2026-12-02',endTime:''});
});

it('accepts four-digit time entry and validates both clock formats',()=>{
 expect(parseMentionTimeInput('1635')).toBe('16:35');
 expect(parseMentionTimeInput('0905')).toBe('09:05');
 expect(parseMentionTimeInput('0000')).toBe('00:00');
 expect(parseMentionTimeInput('9:05')).toBe('09:05');
 expect(parseMentionTimeInput('0335','12','pm')).toBe('15:35');
 expect(parseMentionTimeInput('1200','12','am')).toBe('00:00');
 for(const invalid of ['2400','1660','163','abcd'])expect(parseMentionTimeInput(invalid)).toBeNull();
 expect(parseMentionTimeInput('1635','12','pm')).toBeNull();
});
