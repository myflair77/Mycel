import {useEffect,useState} from 'react';
import {SearchInput} from '../../components/SearchInput';
import {Highlight} from '../messages/ux';
import {rpc} from './Workspace';

type SearchItem={id:string;title:string;trashed:boolean;updated_at:string};
export function ResourceSearch({kind,space,onSelect,onClose}:{kind:'note'|'event';space?:string;onSelect:(id:string)=>Promise<boolean>;onClose:()=>void}){
 const [query,setQuery]=useState(''),[items,setItems]=useState<SearchItem[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[opening,setOpening]=useState(false),[retry,setRetry]=useState(0);
 const name=kind==='note'?'노트':'일정';
 useEffect(()=>{let active=true;setBusy(true);setItems([]);setError('');void rpc('workspace_list',{p_kind:kind,p_room:space??null}).then(rows=>{if(active)setItems(rows.filter((r:SearchItem)=>!r.trashed))}).catch(e=>{if(active)setError(e.message||'목록을 불러오지 못했습니다.')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[kind,space,retry]);
 const found=items.filter(item=>item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section className="workspace-search" aria-label={name+' 검색'}><header><strong>{name+' 검색'}</strong><button type="button" onClick={onClose} aria-label="자료 검색 닫기">×</button></header><SearchInput autoFocus value={query} onChange={e=>setQuery(e.target.value)} onClear={()=>setQuery('')} placeholder={name+' 제목으로 검색'} aria-label={name+' 검색어'} maxLength={100}/>{busy&&<p role="status">목록 불러오는 중…</p>}{error&&<p role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></p>}{!busy&&!error&&<><p role="status">{found.length?found.length+'개 결과':'검색 결과가 없습니다.'}</p><div className="workspace-search-results">{found.map(item=><button type="button" key={item.id} disabled={opening} onClick={async()=>{setOpening(true);setError('');try{if(await onSelect(item.id))onClose()}catch(e){setError((e as Error).message||'자료를 열지 못했습니다.')}finally{setOpening(false)}}}><span><Highlight text={item.title} query={query.trim()}/></span><time dateTime={item.updated_at}>{new Date(item.updated_at).toLocaleDateString('ko-KR')}</time></button>)}</div></>}</section>;
}
