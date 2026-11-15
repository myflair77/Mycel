export type QuoteAnchor={quote:string;start:number;end:number;version:number;prefix:string;suffix:string};
export function locateQuote(text:string,anchor:QuoteAnchor,version:number):[number,number]|null{
 const points=Array.from(text),quote=Array.from(anchor.quote);
 const matches:number[]=[];
 for(let n=0;n<=points.length-quote.length;n++){
  if(points.slice(n,n+quote.length).join('')!==anchor.quote)continue;
  if(version===anchor.version&&n===anchor.start)return [textIndex(points,n),textIndex(points,n+quote.length)];
  if(points.slice(Math.max(0,n-24),n).join('')===anchor.prefix&&points.slice(n+quote.length,n+quote.length+24).join('')===anchor.suffix)matches.push(n);
 }
 return matches.length===1?[textIndex(points,matches[0]),textIndex(points,matches[0]+quote.length)]:null;
}
function textIndex(points:string[],n:number){return points.slice(0,n).join('').length}
export function moveBlock(ids:string[],source:string,target:string,after:boolean){
 const next=ids.filter(id=>id!==source),at=next.indexOf(target);
 if(source===target||at<0||!ids.includes(source))return ids;
 next.splice(at+(after?1:0),0,source);return next;
}

export function arrangeBlocks<T extends {id:string;content:any}>(blocks:T[],source:string,target:string,after:boolean,side:number):T[]{
 if(source===target)return blocks;
 const moving=blocks.find(b=>b.id===source),anchor=blocks.find(b=>b.id===target);if(!moving||!anchor)return blocks;
 const next=blocks.filter(b=>b.id!==source).map(b=>({...b,content:{...b.content}})),copy={...moving,content:{...moving.content}};
 const layout=anchor.content._layout;
 if(side){
  const group=layout?.group??target,columns=[...new Set(next.filter(b=>b.content._layout?.group===group).map(b=>b.content._layout.column))].sort((a:any,b:any)=>a-b) as number[];
  const count=columns.length||1;if(count>=4)throw Error('한 행에는 최대 4개 열을 배치할 수 있습니다.');
  const index=(layout?.column??0)+(side>0?1:0);
  for(const b of next){if(b.id===target&&!layout)b.content._layout={group,column:side<0?1:0,width:50};else if(b.content._layout?.group===group)b.content._layout={group,column:b.content._layout.column+(b.content._layout.column>=index?1:0),width:100/(count+1)}}
  copy.content._layout={group,column:index,width:100/(count+1)};
 }else if(layout)copy.content._layout={...layout};else delete copy.content._layout;
 next.splice(next.findIndex(b=>b.id===target)+(after?1:0),0,copy);
 const groups=new Set(next.map(b=>b.content._layout?.group).filter(Boolean));
 for(const group of groups){const members=next.filter(b=>b.content._layout?.group===group),columns=[...new Set(members.map(b=>b.content._layout.column))].sort((a,b)=>a-b);
  for(const b of members){if(columns.length===1)delete b.content._layout;else b.content._layout={...b.content._layout,column:columns.indexOf(b.content._layout.column),width:side?100/columns.length:b.content._layout.width}}
 }
 return next;
}

