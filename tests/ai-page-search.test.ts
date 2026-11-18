import {describe,expect,it} from 'vitest';
import {matchingPages,pageSearchTerm} from '../src/features/ai/pageActions';

describe('AI page search',()=>{
  it('recognizes a title search but leaves writing prompts to the model',()=>{
    expect(pageSearchTerm('“회의록” 페이지 찾아줘')).toBe('회의록');
    expect(pageSearchTerm('회의록 페이지를 열어 주세요')).toBe('회의록');
    expect(pageSearchTerm('회의록 페이지를 요약해줘')).toBeNull();
  });
  it('matches titles and excludes trashed and inaccessible results',()=>{
    const page={id:'a',title:'Mycel 회의록',permission:1,trashed:false,updated_at:'2026-11-18'};
    expect(matchingPages([page,{...page,trashed:true},{...page,permission:0}],'회의 MYCEL')).toEqual([{id:'a',title:page.title,updated_at:page.updated_at}]);
    expect(matchingPages([page],' ')).toEqual([]);
  });
});
