import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export type NoteRow={parent_id?:string|null;body?:{icon?:string};id:string;title:string;owner_id:string;creator_name?:string;permission:number;created_at:string;updated_at:string};
export type NoteFilters={title:string;numberFrom:string;numberTo:string;creator:string;permission:string;createdFrom:string;createdTo:string;updatedFrom:string;updatedTo:string};
export const emptyNoteFilters:NoteFilters={title:'',numberFrom:'',numberTo:'',creator:'',permission:'',createdFrom:'',createdTo:'',updatedFrom:'',updatedTo:''};
export type NoteSort='number'|'title'|'creator_name'|'permission'|'created_at'|'updated_at';
export const permissionName=(p:number)=>p>=3?'본문편집':p===2?'댓글':'열람';
export const permissionNames=(p:number)=>p>=3?['열람','댓글','본문편집']:p===2?['열람','댓글']:['열람'];
const localDay=(s:string)=>{const d=new Date(s);return Number.isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
export const noteNumbers=(items:NoteRow[])=>new Map([...items].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map((i,index)=>[i.id,index+1]));
export function selectNotes<T extends NoteRow>(items:T[],filters:NoteFilters,sort:NoteSort,asc:boolean,numbers=noteNumbers(items)){
 const between=(s:string,from:string,to:string)=>{const day=localDay(s);return (!from||day>=from)&&(!to||day<=to)};
 return items.filter(i=>(!filters.title||i.title.toLocaleLowerCase().includes(filters.title.toLocaleLowerCase()))&&(!filters.numberFrom||(numbers.get(i.id)??0)>=Number(filters.numberFrom))&&(!filters.numberTo||(numbers.get(i.id)??0)<=Number(filters.numberTo))&&(!filters.creator||i.owner_id===filters.creator)&&(!filters.permission||permissionNames(i.permission).includes(filters.permission))&&between(i.created_at,filters.createdFrom,filters.createdTo)&&between(i.updated_at,filters.updatedFrom,filters.updatedTo)).sort((a,b)=>{const x=sort==='number'?numbers.get(a.id):sort==='permission'?permissionName(a.permission):a[sort]??'',y=sort==='number'?numbers.get(b.id):sort==='permission'?permissionName(b.permission):b[sort]??'';const comparison=String(x).localeCompare(String(y),'ko',{numeric:true});return (asc?comparison:-comparison)||a.id.localeCompare(b.id)});
}
export function noteTree<T extends NoteRow>(rows:T[],all:T[],expanded:Set<string>,flat=false){
 const byId=new Map(all.map(i=>[i.id,i])),included=new Set(rows.map(i=>i.id)),seen=new Set<string>();
 const path=(i:T)=>{const titles:string[]=[],visited=new Set([i.id]);let p=i.parent_id;while(p&&byId.has(p)&&!visited.has(p)){visited.add(p);const parent=byId.get(p)!;titles.unshift(parent.title);p=parent.parent_id}return titles.join(' / ')};
 const out:{item:T;depth:number;path:string;hasChildren:boolean}[]=[];
 const visit=(i:T,depth:number)=>{if(seen.has(i.id))return;seen.add(i.id);const children=rows.filter(r=>r.parent_id===i.id);out.push({item:i,depth,path:path(i),hasChildren:children.length>0});if(expanded.has(i.id))children.forEach(c=>visit(c,depth+1))};
 if(flat)return rows.map(item=>({item,depth:0,path:path(item),hasChildren:false}));
 rows.filter(i=>!i.parent_id||!included.has(i.parent_id)).forEach(i=>visit(i,0));
 for(const i of rows){if(seen.has(i.id))continue;let p=i.parent_id;const chain=new Set([i.id]);while(p&&included.has(p)&&!chain.has(p)){chain.add(p);p=byId.get(p)?.parent_id}if(p&&chain.has(p))visit(i,0)}
 return out;
}
const columns:[NoteSort,string][]=[['number','번호'],['title','제목'],['creator_name','생성자'],['permission','나의 권한'],['updated_at','최종수정일자']];
const fields:Record<NoteSort,(keyof NoteFilters)[]>={number:['numberFrom','numberTo'],title:['title'],creator_name:['creator'],permission:['permission'],created_at:['createdFrom','createdTo'],updated_at:['updatedFrom','updatedTo']};
const listViews=new Map<string,{filters:NoteFilters;sort:NoteSort;asc:boolean;expanded:Set<string>}>();
export function NoteList({items,numberingItems=items,listKey='default',userId,unread,onOpen}:{listKey?:string;items:NoteRow[];numberingItems?:NoteRow[];userId:string;unread:{id:string}[];onOpen:(id:string)=>void}){
 const [filters,setFilters]=useState(()=>listViews.get(listKey)?.filters??emptyNoteFilters),[sort,setSort]=useState<NoteSort>(()=>listViews.get(listKey)?.sort??'created_at'),[asc,setAsc]=useState(()=>listViews.get(listKey)?.asc??false);
 const [expanded,setExpanded]=useState<Set<string>>(()=>listViews.get(listKey)?.expanded??new Set());
 const [popup,setPopup]=useState<{key:NoteSort;left:number;top:number}|null>(null),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{const v=listViews.get(listKey);setFilters(v?.filters??emptyNoteFilters);setSort(v?.sort??'created_at');setAsc(v?.asc??false);setExpanded(v?.expanded??new Set());setPopup(null)},[listKey]);
 useEffect(()=>{listViews.set(listKey,{filters,sort,asc,expanded})},[listKey,filters,sort,asc,expanded]);
 useEffect(()=>{if(!popup)return;panel.current?.querySelector<HTMLElement>('input,select,button')?.focus();
  const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setPopup(null)};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setPopup(null);trigger.current?.focus()}};
  const close=()=>setPopup(null);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',close);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',close)};
 },[popup?.key]);
 const numbers=noteNumbers(numberingItems),rows=selectNotes(items,filters,sort,asc,numbers),creators=[...new Map(items.map(i=>[i.owner_id,i.creator_name||(i.owner_id===userId?'나':'작성자')])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'ko'));
 const tree=noteTree(rows,items,expanded,Object.values(filters).some(Boolean));
 const date=(s:string)=>s?new Date(s).toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
 const change=(key:keyof NoteFilters,value:string)=>setFilters(f=>({...f,[key]:value}));
 const clear=(key:NoteSort)=>setFilters(f=>({...f,...Object.fromEntries(fields[key].map(k=>[k,'']))}));
 const sortBy=(key:NoteSort,direction?:boolean)=>{setSort(key);setAsc(direction??(sort===key?!asc:true))};
 return <><div className="note-list-scroll" onScroll={()=>setPopup(null)} tabIndex={0} role="region" aria-label="노트 목록 · 가로 스크롤 가능"><table className="note-list-table"><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort===key?asc?'ascending':'descending':'none'}><div className="note-column-heading"><button onClick={()=>sortBy(key)}>{label}{sort===key?(asc?' ↑':' ↓'):''}</button><button className={'note-filter-trigger'+(fields[key].some(k=>!!filters[k])?' is-active':'')} aria-label={label+' 필터'} aria-haspopup="dialog" aria-expanded={popup?.key===key} title={label+' 정렬 및 필터'} onClick={e=>{if(popup?.key===key){setPopup(null);return}trigger.current=e.currentTarget;const r=e.currentTarget.getBoundingClientRect();setPopup({key,left:Math.max(8,Math.min(r.left,window.innerWidth-288)),top:Math.max(8,Math.min(r.bottom+4,window.innerHeight-360))})}}><svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" fill={fields[key].some(k=>!!filters[k])?'currentColor':'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M2 3h16l-6 7v6l-4 2v-8Z"/></svg></button></div></th>)}</tr></thead><tbody>{tree.map(({item:i,depth,path,hasChildren})=><tr key={i.id}><td className="note-number">{numbers.get(i.id)}</td><td><div className="note-tree-title" style={{paddingLeft:Math.min(depth,8)*18}}>{hasChildren?<button className="note-tree-toggle" aria-label={i.title+' 하위 노트'} aria-expanded={expanded.has(i.id)} onClick={()=>setExpanded(old=>{const next=new Set(old);if(next.has(i.id))next.delete(i.id);else next.add(i.id);return next})}>{expanded.has(i.id)?'▾':'▸'}</button>:<span className="note-tree-spacer"/>}<button className="note-title-link" onClick={()=>onOpen(i.id)} title={i.title}>{i.body?.icon&&<span className="note-row-icon" aria-hidden="true">{i.body.icon} </span>}{i.title}</button>{unread.some(u=>u.id===i.id)&&<span className="resource-new">미확인</span>}</div>{Object.values(filters).some(Boolean)&&path&&<small className="note-tree-path">{path}</small>}</td><td>{i.creator_name||(i.owner_id===userId?'나':'작성자')}</td><td><span className="note-permissions">{permissionNames(i.permission).map(label=><span className="note-permission" key={label}>{label}</span>)}</span></td><td><time dateTime={i.updated_at}>{date(i.updated_at)}</time></td></tr>)}</tbody></table>{!rows.length&&<p className="empty-hint">조건에 맞는 노트가 없습니다.</p>}</div><small className="note-list-count">{rows.length}개 노트 · 열 제목으로 정렬, 깔때기로 필터</small>
 {popup&&createPortal(<div className="note-column-filter" role="dialog" aria-label={columns.find(c=>c[0]===popup.key)![1]+' 필터'} ref={panel} style={{left:popup.left,top:popup.top}}><strong>{columns.find(c=>c[0]===popup.key)![1]}</strong><div className="note-filter-sort"><button onClick={()=>sortBy(popup.key,true)} aria-pressed={sort===popup.key&&asc}>오름차순 ↑</button><button onClick={()=>sortBy(popup.key,false)} aria-pressed={sort===popup.key&&!asc}>내림차순 ↓</button></div>
 {popup.key==='title'&&<label>제목 포함<input value={filters.title} onChange={e=>change('title',e.target.value)} placeholder="검색할 제목"/></label>}
 {popup.key==='creator_name'&&<label>생성자<select value={filters.creator} onChange={e=>change('creator',e.target.value)}><option value="">전체</option>{creators.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
 {popup.key==='permission'&&<label>나의 권한<select value={filters.permission} onChange={e=>change('permission',e.target.value)}><option value="">전체</option>{['열람','댓글','본문편집'].map(p=><option key={p}>{p}</option>)}</select></label>}
 {['number','created_at','updated_at'].includes(popup.key)&&fields[popup.key].map((key,index)=><label key={key}>{popup.key==='number'?(index?'끝 번호':'시작 번호'):(index?'종료일':'시작일')}<input type={popup.key==='number'?'number':'date'} min={popup.key==='number'?1:undefined} value={filters[key]} onChange={e=>change(key,e.target.value)}/></label>)}
 <div className="note-filter-actions"><button onClick={()=>clear(popup.key)}>이 열 필터 해제</button><button onClick={()=>{setPopup(null);trigger.current?.focus()}}>닫기</button></div></div>,document.querySelector('.app')??document.body)}</>;
}
