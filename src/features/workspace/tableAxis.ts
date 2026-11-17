import type {Node} from '@tiptap/pm/model';
import {Fragment} from '@tiptap/pm/model';
import {TableMap} from '@tiptap/pm/tables';
export type Axis='row'|'column';
// A band expands until no merged cell crosses either boundary.
export function tableBand(table:Node,axis:Axis,index:number){
 const map=TableMap.get(table),size=axis==='row'?map.height:map.width;
 if(index<0||index>=size)throw new RangeError('Invalid table index');
 let start=index,end=index+1,changed=true;
 while(changed){changed=false;for(const pos of new Set(map.map)){const r=map.findCell(pos),a=axis==='row'?r.top:r.left,b=axis==='row'?r.bottom:r.right;if(a<end&&b>start&&(a<start||b>end)){start=Math.min(start,a);end=Math.max(end,b);changed=true}}}
 return {start,end};
}
export function changeTableAxis(table:Node,axis:Axis,index:number,target?:number){
 const map=TableMap.get(table);if(map.problems)throw new Error('Invalid table structure');
 const band=tableBand(table,axis,index),size=axis==='row'?map.height:map.width;
 const order=Array.from({length:size},(_,i)=>i),moving=order.slice(band.start,band.end);
 let destination=band.end;
 if(target===undefined)order.splice(band.end,0,...moving);
 else {
  const other=tableBand(table,axis,target);
  if(other.start<band.end&&other.end>band.start)return {table,index:band.start,count:moving.length};
  order.splice(band.start,moving.length);
  destination=target>index?other.end-moving.length:other.start;
  order.splice(destination,0,...moving);
 }
 const rows:Node[]=[];
 if(axis==='row')for(const i of order)rows.push(table.child(i));
 else table.forEach((row,_offset,rowIndex)=>{
  const cells:Node[]=[];
  for(let col=0;col<order.length;){
   const oldCol=order[col],pos=map.map[rowIndex*map.width+oldCol],rect=map.findCell(pos),cell=table.nodeAt(pos)!;
   if(rect.top===rowIndex&&rect.left===oldCol)cells.push(cell);
   col+=rect.left===oldCol?cell.attrs.colspan:1;
  }
  rows.push(row.copy(Fragment.from(cells)));
 });
 const next=table.copy(Fragment.from(rows));
 if(TableMap.get(next).problems)throw new Error('Table change would break merged cells');
 return {table:next,index:destination,count:moving.length};
}
