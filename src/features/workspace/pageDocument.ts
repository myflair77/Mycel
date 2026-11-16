import type {JSONContent} from '@tiptap/core';
export type SavedBlock={id:string;kind:string;content:any;version:number;position?:number};
const inline=(text:string):JSONContent[]=>text.split('\n').flatMap((s,i)=>[...(i?[{type:'hardBreak'}]:[]),...(s?[{type:'text',text:s}]:[])]);
const para=(text=''):JSONContent=>({type:'paragraph',content:inline(text)});
export function legacyNode(b:SavedBlock):JSONContent{
 if(b.content._rich)return {...b.content._rich,attrs:{...b.content._rich.attrs,id:b.id}};
 const p=para(b.content.text??'');let n:JSONContent;
 switch(b.kind){
 case 'heading':n={type:'heading',attrs:{level:1},content:p.content};break;
 case 'list':n={type:'bulletList',content:[{type:'listItem',content:[p]}]};break;
 case 'check':n={type:'taskList',content:[{type:'taskItem',attrs:{checked:!!b.content.checked},content:[p]}]};break;
 case 'quote':n={type:'blockquote',content:[p]};break;
 case 'divider':n={type:'horizontalRule'};break;
 case 'table':n={type:'table',content:b.content.rows.map((r:string[])=>({type:'tableRow',content:r.map(t=>({type:'tableCell',content:[para(t)]}))}))};break;
 default:n=p;
 }return {...n,attrs:{...n.attrs,id:b.id}};
}
export function blocksToDoc(blocks:SavedBlock[]):JSONContent{
 const out:JSONContent[]=[],seen=new Set<string>();
 for(const b of blocks){const l=b.content._layout;if(!l){out.push(legacyNode(b));continue}if(seen.has(l.group))continue;seen.add(l.group);
 const members=blocks.filter(x=>x.content._layout?.group===l.group),cols=[...new Set(members.map(x=>x.content._layout.column))].sort((a,b)=>a-b);
 if(cols.length<2){out.push(...members.map(legacyNode));continue}
 out.push({type:'columns',attrs:{id:l.group},content:cols.map(c=>({type:'column',attrs:{width:members.find(x=>x.content._layout.column===c)!.content._layout.width},content:members.filter(x=>x.content._layout.column===c).map(legacyNode)}))});
 }return {type:'doc',content:out.length?out:[{...para(),attrs:{id:crypto.randomUUID()}}]};
}
export function plain(n:JSONContent):string{if(n.type==='text')return n.text??'';if(n.type==='hardBreak')return '\n';return (n.content??[]).map(plain).join(['bulletList','orderedList','taskList','blockquote','table','tableRow','listItem','taskItem','tableCell','tableHeader'].includes(n.type??'')?'\n':'')}
export function docToBlocks(doc:JSONContent):SavedBlock[]{
 const out:SavedBlock[]=[];
 const add=(n:JSONContent,layout?:any)=>{const type=n.type,kind=type==='heading'?'heading':type==='table'?'table':type==='horizontalRule'?'divider':type==='blockquote'?'quote':type==='taskList'?'check':['bulletList','orderedList'].includes(type??'')?'list':'text';
 const content:any={text:plain(n),_rich:n};if(layout)content._layout=layout;if(kind==='table')content.rows=n.content?.map(r=>r.content?.map(plain));if(kind==='check')content.checked=n.content?.[0]?.attrs?.checked??false;
 out.push({id:n.attrs?.id,kind,content,version:0,position:out.length});};
 for(const n of doc.content??[]){if(n.type==='columns'){n.content?.forEach((c,i)=>c.content?.forEach(b=>add(b,{group:n.attrs?.id,column:i,width:c.attrs?.width??100/n.content!.length})))}else add(n)}return out;
}
export function uniqueIds(doc:JSONContent):JSONContent{const seen=new Set<string>();const walk=(n:JSONContent):JSONContent=>{const o={...n,attrs:n.attrs?{...n.attrs}:undefined,content:n.content?.map(walk)};if(n.type!=='text'&&n.type!=='doc'&&n.type!=='hardBreak'){let id=o.attrs?.id;if(!id||seen.has(id))id=crypto.randomUUID();seen.add(id);o.attrs={...o.attrs,id}}return o};return walk(doc)}

