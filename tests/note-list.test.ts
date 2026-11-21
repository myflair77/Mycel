import {it,expect} from 'vitest';import{noteTree,selectNotes,emptyNoteFilters,permissionName,permissionNames}from'../src/features/workspace/NoteList';
const rows=[{id:'a',title:'가',owner_id:'alice',creator_name:'Alice',permission:4,created_at:'2026-11-20T00:00:00Z',updated_at:'2026-11-22T00:00:00Z'},{id:'b',title:'나',owner_id:'bob',creator_name:'Bob',permission:1,created_at:'2026-11-21T00:00:00Z',updated_at:'2026-11-21T00:00:00Z'}];
it('sorts each property and combines creator, permission and inclusive date filters',()=>{expect(selectNotes(rows,emptyNoteFilters,'title',false)[0].id).toBe('b');expect(selectNotes(rows,emptyNoteFilters,'updated_at',false)[0].id).toBe('a');expect(selectNotes(rows,{...emptyNoteFilters,creator:'alice',permission:'본문편집',createdFrom:'2026-11-20',createdTo:'2026-11-20'},'title',true).map(i=>i.id)).toEqual(['a']);expect(selectNotes(rows,{...emptyNoteFilters,updatedFrom:'2026-11-23'},'title',true)).toEqual([]);expect(permissionName(2)).toBe('댓글')});
it('combines title and stable number filters without renumbering filtered items',()=>{const numbers=new Map([['a',4],['b',8]]);expect(selectNotes(rows,{...emptyNoteFilters,title:'나',numberFrom:'7',numberTo:'9'},'number',false,numbers).map(r=>r.id)).toEqual(['b']);expect(selectNotes(rows,{...emptyNoteFilters,numberTo:'5'},'number',false,numbers).map(r=>r.id)).toEqual(['a']);expect(selectNotes(rows,{...emptyNoteFilters,title:'없는 제목'},'title',true)).toEqual([])});

it('shows cumulative permissions and filters by the capability a reader has',()=>{
 expect(permissionNames(1)).toEqual(['열람']);expect(permissionNames(2)).toEqual(['열람','댓글']);expect(permissionNames(3)).toEqual(['열람','댓글','본문편집']);expect(permissionNames(4)).toEqual(permissionNames(3));
 expect(selectNotes(rows,{...emptyNoteFilters,permission:'열람'},'created_at',false).map(r=>r.id)).toEqual(['b','a']);
 expect(selectNotes(rows,{...emptyNoteFilters,permission:'댓글'},'created_at',false).map(r=>r.id)).toEqual(['a']);
});

it('keeps hierarchy order, hides collapsed children, and shows ancestor paths while filtering',()=>{
 const all=[{...rows[0],id:'root',title:'상위'},{...rows[1],id:'child',parent_id:'root',title:'하위'},{...rows[1],id:'new',title:'최신'}];
 expect(noteTree(all,all,new Set()).map(r=>r.item.id)).toEqual(['root','new']);
 expect(noteTree(all,all,new Set(['root'])).map(r=>[r.item.id,r.depth])).toEqual([['root',0],['child',1],['new',0]]);
 expect(noteTree([all[1]],all,new Set(),true)[0].path).toBe('상위');
});
