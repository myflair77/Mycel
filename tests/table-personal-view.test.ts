import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {extensions} from '../src/features/workspace/pageExtensions';
import {normalizeTableView,personalTableInfo,personalTableRows,tableCellText} from '../src/features/workspace/tablePersonalView';
const schema=getSchema(extensions());
const cell=(text:string,header=false,attrs={})=>(header?schema.nodes.tableHeader:schema.nodes.tableCell).create(attrs,schema.nodes.paragraph.create(null,text?schema.text(text):undefined));
const table=()=>schema.nodes.table.create({id:'table-1'},[
 schema.nodes.tableRow.create(null,[cell('이름',true,{id:'name'}),cell('수량',true,{id:'count'})]),
 ...[['배','10'],['사과','2'],['바나나','-3'],['사과','2'],['','']].map(values=>schema.nodes.tableRow.create(null,values.map(text=>cell(text))))
]);
it('sorts numbers and complete row indices stably, keeps empty values last and the source unchanged',()=>{
 const node=table(),before=node.toJSON();
 expect(personalTableRows(node,{sort:{column:'count',direction:'asc'},filters:{}})).toEqual([3,2,4,1,5]);
 expect(personalTableRows(node,{sort:{column:'count',direction:'desc'},filters:{}})).toEqual([1,2,4,3,5]);
 expect(personalTableRows(node,{filters:{}})).toEqual([1,2,3,4,5]);expect(node.toJSON()).toEqual(before);
});
it('combines value, contains and empty filters across columns without deleting rows',()=>{
 const node=table();expect(personalTableRows(node,{filters:{name:{contains:'사과'},count:{values:['2']}}})).toEqual([2,4]);
 expect(personalTableRows(node,{filters:{name:{excludeEmpty:true}}})).toEqual([1,2,3,4]);
 expect(personalTableRows(node,{filters:{name:{values:[]}}})).toEqual([]);
 expect(personalTableRows(node,{filters:{name:{values:['']}}})).toEqual([5]);expect(node.childCount).toBe(6);
});
it('rejects stale columns and invalid persisted preferences; filters follow stable header IDs',()=>{
 const node=table(),prefs=normalizeTableView({sort:{column:'missing',direction:'asc'},filters:{missing:{contains:'bad'},name:{contains:'',excludeEmpty:false,values:['사과','사과']}}},node);
 expect(prefs).toEqual({filters:{name:{values:['사과']}}});expect(personalTableRows(node,prefs)).toEqual([2,4]);
 expect(normalizeTableView('invalid',node)).toEqual({filters:{}});
});
it('does not reorder tables with merged cells or without a complete first header row',()=>{
 const merged=schema.nodes.table.create(null,[schema.nodes.tableRow.create(null,[cell('제목',true,{colspan:2})]),schema.nodes.tableRow.create(null,[cell('2'),cell('1')])]);
 expect(personalTableInfo(merged).supported).toBe(false);
 expect(personalTableRows(merged,{sort:{column:'column-0',direction:'asc'},filters:{'column-0':{values:[]}}})).toEqual([1]);
 const normal=schema.nodes.table.create(null,[schema.nodes.tableRow.create(null,[cell('제목')]),schema.nodes.tableRow.create(null,[cell('2')])]);expect(personalTableInfo(normal).hasHeader).toBe(false);
});
it('extracts mention labels and formatted date text for filtering instead of an empty atom',()=>{
 const person=schema.nodes.pageMention.create({kind:'person',label:'민간인',target:'user'}),date=schema.nodes.pageMention.create({kind:'date',target:'2026-11-23',time:'13:23'});
 const node=schema.nodes.tableCell.create(null,schema.nodes.paragraph.create(null,[person,schema.text(' '),date]));expect(tableCellText(node)).toContain('민간인');expect(tableCellText(node)).toContain('2026년 11월 23일 13:23');
});
