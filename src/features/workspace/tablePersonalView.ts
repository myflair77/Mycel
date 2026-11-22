import type {Node} from '@tiptap/pm/model';
import {dateMentionLabel} from './dateMentionModel';
export type TableFilter={contains?:string;excludeEmpty?:boolean;values?:string[]};
export type TableViewPreferences={sort?:{column:string;direction:'asc'|'desc'};filters:Record<string,TableFilter>};
export const emptyTableView=():TableViewPreferences=>({filters:{}});
export function tableCellText(cell:Node){return cell.textBetween(0,cell.content.size,' ',node=>node.type.name==='pageMention'?(node.attrs.kind==='date'?dateMentionLabel(node.attrs):String(node.attrs.label||'')):String(node.attrs.label||node.attrs.name||node.attrs.alt||'')).trim()}
export function personalTableInfo(table:Node){
 const first=table.firstChild,headers=first?Array.from(first.content.content).map((cell,index)=>({id:String(cell.attrs.id||'column-'+index),label:tableCellText(cell)||`${index+1}열`,index})):[];
 const hasHeader=!!first&&first.childCount>0&&Array.from(first.content.content).every(cell=>cell.type.name==='tableHeader');
 let merged=false;table.forEach(row=>row.forEach(cell=>{if(cell.attrs.colspan>1||cell.attrs.rowspan>1)merged=true}));
 return {headers,hasHeader,merged,supported:hasHeader&&!merged};
}
export function normalizeTableView(value:unknown,table:Node):TableViewPreferences{
 const result=emptyTableView(),raw=value as any,ids=new Set(personalTableInfo(table).headers.map(h=>h.id));
 if(raw&&ids.has(raw.sort?.column)&&['asc','desc'].includes(raw.sort.direction))result.sort={column:raw.sort.column,direction:raw.sort.direction};
 if(raw?.filters&&typeof raw.filters==='object')for(const [id,input] of Object.entries(raw.filters)){
  if(!ids.has(id)||!input||typeof input!=='object')continue;const v=input as any,f:TableFilter={};
  if(typeof v.contains==='string'&&v.contains.trim())f.contains=v.contains;
  if(v.excludeEmpty===true)f.excludeEmpty=true;
  if(Array.isArray(v.values)&&v.values.every((s:unknown)=>typeof s==='string'))f.values=[...new Set<string>(v.values)];
  if(Object.keys(f).length)result.filters[id]=f;
 }
 return result;
}
const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
function compare(a:string,b:string){
 const numeric=/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
 if(numeric.test(a)&&numeric.test(b))return Number(a.replaceAll(',',''))-Number(b.replaceAll(',',''));
 return collator.compare(a,b);
}
/** Original nodes are never reordered or modified; return source row indices only. */
export function personalTableRows(table:Node,input:TableViewPreferences){
 const info=personalTableInfo(table),rows=Array.from({length:Math.max(0,table.childCount-1)},(_,i)=>i+1);
 if(!info.supported)return rows;
 const prefs=normalizeTableView(input,table),cols=new Map(info.headers.map(h=>[h.id,h.index]));
 const filtered=rows.filter(row=>Object.entries(prefs.filters).every(([id,f])=>{
  const value=tableCellText(table.child(row).child(cols.get(id)!));
  return (!f.excludeEmpty||value!=='')&&(!f.contains||value.toLocaleLowerCase('ko').includes(f.contains.toLocaleLowerCase('ko')))&&(!f.values||f.values.includes(value));
 }));
 if(prefs.sort){const {column,direction}=prefs.sort,index=cols.get(column)!;filtered.sort((a,b)=>{
  const x=tableCellText(table.child(a).child(index)),y=tableCellText(table.child(b).child(index));
  if(!x||!y)return x===y?a-b:x?-1:1;
  return compare(x,y)*(direction==='asc'?1:-1)||a-b;
 })}
 return filtered;
}
