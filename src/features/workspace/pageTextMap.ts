import type {Node as PMNode} from '@tiptap/pm/model';
import {plain} from './pageDocument';
const separated=new Set(['callout','noteTabs','noteTab','toggleBlock','toggleBody','bulletList','orderedList','taskList','blockquote','table','tableRow','listItem','taskItem','tableCell','tableHeader']);
export function blockTextMap(node:PMNode,position:number){let text='';const ranges:({from:number;to:number}|null)[]=[];
 const walk=(n:PMNode,pos:number)=>{if(n.isText){for(let i=0;i<n.text!.length;i++){text+=n.text![i];ranges.push({from:pos+i,to:pos+i+1})}return}if(n.isLeaf){const value=plain(n.toJSON());text+=value;for(let i=0;i<value.length;i++)ranges.push({from:pos,to:pos+n.nodeSize});return}n.forEach((child,offset,index)=>{if(index&&separated.has(n.type.name)){text+='\n';ranges.push(null)}walk(child,pos+1+offset)})};walk(node,position);return {text,ranges};
}
export function quoteInBlock(node:PMNode,position:number,from:number,to:number){const map=blockTextMap(node,position);let a=-1,b=-1;map.ranges.forEach((r,i)=>{if(r&&r.from>=from&&r.to<=to){if(a<0)a=i;b=i+1}});if(a<0||b<=a)return null;return {blockId:node.attrs.id,quote:map.text.slice(a,b),start:Array.from(map.text.slice(0,a)).length,end:Array.from(map.text.slice(0,b)).length}}
export function textRangeSpans(node:PMNode,position:number,start:number,end:number){const map=blockTextMap(node,position),spans:{from:number;to:number}[]=[];for(const r of map.ranges.slice(start,end)){if(!r)continue;const last=spans.at(-1);if(last&&r.from<=last.to)last.to=Math.max(last.to,r.to);else spans.push({...r})}return spans}
