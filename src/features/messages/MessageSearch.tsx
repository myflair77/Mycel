import {useEffect,useRef,useState,type FormEvent} from 'react';
import {supabase} from '../../services/supabase';
import type {ChatMessage} from './model';
export function MessageSearch({room,onSelect}:{room:string;onSelect:(message:ChatMessage)=>void}){
 const [query,setQuery]=useState(''),[usedQuery,setUsedQuery]=useState(''),[rows,setRows]=useState<ChatMessage[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[searched,setSearched]=useState(false);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++},[]);
 async function search(append=false){const text=append?usedQuery:query.trim();if(!text||busy)return;const version=++generation.current;setBusy(true);setError('');if(!append){setRows([]);setMore(false);setUsedQuery(text)}
  try{const {data,error}=await supabase!.rpc('search_messages',{p_room:room,p_query:text,p_before:append?rows.at(-1)?.sequence:null}).abortSignal(AbortSignal.timeout(15000));if(version!==generation.current)return;if(error)throw error;const found=data as ChatMessage[];setRows(old=>append?[...old,...found]:found);setMore(found.length===50);setSearched(true)}catch{if(version===generation.current)setError('검색하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.')}finally{if(version===generation.current)setBusy(false)}
 }
 return <section className="message-search" aria-label="대화 내용 검색"><form onSubmit={(event:FormEvent)=>{event.preventDefault();void search()}}><input aria-label="대화 검색어" placeholder="메시지 또는 파일명 검색" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/><button disabled={busy||!query.trim()}>{busy?'검색 중…':'검색'}</button></form>{error&&<p role="alert">{error}</p>}{searched&&!rows.length&&!busy&&!error&&<p role="status">검색 결과가 없습니다.</p>}<div className="search-results">{rows.map(message=><button type="button" key={message.id} onClick={()=>onSelect(message)}><span>{message.attachment_id?'📎 ':''}{message.body}</span><time>{new Date(message.created_at).toLocaleString('ko-KR')}</time></button>)}{more&&<button type="button" disabled={busy} onClick={()=>void search(true)}>이전 결과 더 보기</button>}</div></section>
}
