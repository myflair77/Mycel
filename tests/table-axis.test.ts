import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {TableMap} from '@tiptap/pm/tables';
import {extensions} from '../src/features/workspace/pageExtensions';
import {changeTableAxis,tableBand,tableAxisCells,tableAxisIsHeader,setTableAxisHeader} from '../src/features/workspace/tableAxis';
import {blocksToDoc,docToBlocks} from '../src/features/workspace/pageDocument';
const s=getSchema(extensions());
const cell=(text:string,attrs={})=>s.nodes.tableCell.create({background:'#dbeafe',align:'right',...attrs},s.nodes.paragraph.create(null,s.text(text,[s.marks.bold.create()])));
const row=(...cells:any[])=>s.nodes.tableRow.create(null,cells);
const table=()=>s.nodes.table.create(null,[
 row(cell('A',{rowspan:2,colspan:2,colwidth:[90,110]}),cell('B'),cell('C')),
 row(cell('D'),cell('E')),
 row(cell('F',{colwidth:[90]}),cell('G',{colwidth:[110]}),cell('H'),cell('I')),
 row(cell('J',{colwidth:[90]}),cell('K',{colwidth:[110]}),cell('L'),cell('M'))
]);
for(const axis of ['row','column'] as const){
 it(axis+' merged band moves intact and keeps all contents/format through persistence',()=>{
  const t=table();expect(tableBand(t,axis,1)).toEqual({start:0,end:2});
  const moved=changeTableAxis(t,axis,1,3).table;expect(TableMap.get(moved).problems).toBeNull();
  const cells=(n:any)=>{const found:any[]=[];n.descendants((c:any)=>{if(c.type.name==='tableCell')found.push(c.toJSON())});return found.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
  expect(cells(moved)).toEqual(cells(t));
  const doc=s.nodes.doc.create(null,moved).toJSON();
  expect(s.nodeFromJSON(blocksToDoc(docToBlocks(doc))).textContent).toBe(moved.textContent);
  expect(cells(s.nodeFromJSON(blocksToDoc(docToBlocks(doc))))).toEqual(cells(moved));
  expect(changeTableAxis(moved,axis,3,0).table.toJSON()).toEqual(t.toJSON());
 });
 it(axis+' merged band duplicates without breaking spans or original content',()=>{
  const t=table(),result=changeTableAxis(t,axis,1),map=TableMap.get(result.table);
  expect(result.count).toBe(2);expect(map.problems).toBeNull();
  expect(axis==='row'?map.height:map.width).toBe(6);
  let copies=0;result.table.descendants(n=>{if(n.type.name==='tableCell'&&n.textContent==='A'){copies++;expect(n.attrs.colspan).toBe(2);expect(n.attrs.rowspan).toBe(2);expect(n.attrs.colwidth).toEqual([90,110]);expect(n.attrs.background).toBe('#dbeafe');expect(n.firstChild?.firstChild?.marks[0].type.name).toBe('bold')}});
  expect(copies).toBe(2);
 });
 it(axis+' dropping inside the merged band is a no-op',()=>{const t=table();expect(changeTableAxis(t,axis,0,1).table).toBe(t)});
}

for(const axis of ['row','column'] as const)it(axis+' header toggle affects the merged band only and preserves content, widths and styling',()=>{
 const original=table(),selected=new Set(tableAxisCells(original,axis,1));
 const header=setTableAxisHeader(original,axis,1,true);
 expect(tableAxisIsHeader(header,axis,1)).toBe(true);expect(TableMap.get(header).problems).toBeNull();
 for(const pos of new Set(TableMap.get(original).map)){
  const before=original.nodeAt(pos)!,after=header.nodeAt(pos)!;
  expect(after.type.name).toBe(selected.has(pos)?'tableHeader':before.type.name);
  expect(after.attrs).toEqual(before.attrs);expect(after.content.toJSON()).toEqual(before.content.toJSON());
 }
 expect(setTableAxisHeader(header,axis,1,false).toJSON()).toEqual(original.toJSON());
 const restored=s.nodeFromJSON(blocksToDoc(docToBlocks(s.nodes.doc.create(null,header).toJSON())));
 expect(tableAxisIsHeader(restored.firstChild!,axis,1)).toBe(true);
});
