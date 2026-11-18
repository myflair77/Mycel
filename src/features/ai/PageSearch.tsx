import {useEffect,useRef,useState} from 'react';
import {rpc} from '../workspace/Workspace';
import {SearchInput} from '../../components/SearchInput';
import {matchingPages,pageSearchTerm} from './pageActions';

export function PageSearch({initial,onOpen}:{initial:string;onOpen:(id:string)=>void}) {
  const [input,setInput]=useState(initial);
  const [matches,setMatches]=useState<ReturnType<typeof matchingPages>>([]);
  const [status,setStatus]=useState('');
  const version=useRef(0);
  async function search(value:string) {
    const current=++version.current;
    const term=(pageSearchTerm(value)??value).trim();
    setMatches([]);
    if (!term) {setStatus('찾을 페이지 제목을 입력하세요.');return;}
    setStatus('검색 중…');
    try {
      const pages=await rpc('workspace_list',{p_kind:'note',p_room:null});
      if (version.current!==current) return;
      const found=matchingPages(pages,term);
      setMatches(found);
      setStatus(found.length?found.length+'개 찾았습니다. 열 페이지를 선택하세요.':'일치하는 페이지가 없습니다.');
    } catch(e) {
      if (version.current===current) setStatus((e as Error).message);
    }
  }
  useEffect(()=>{
    if(initial) void search(initial);
    return ()=>{version.current++};
  },[initial]);
  function edit(value:string) {version.current++;setInput(value);setMatches([]);setStatus('');}
  return <section aria-label="내 페이지 검색">
    <form onSubmit={event=>{event.preventDefault();void search(input)}}>
      <label>내 페이지 제목<SearchInput aria-label="내 페이지 제목" value={input} onChange={e=>edit(e.target.value)} onClear={()=>edit('')} placeholder="예: 회의록 페이지 찾아줘"/></label>
      <button disabled={!input.trim()}>검색</button>
    </form>
    <p role="status">{status}</p>
    <ul>{matches.map(page=><li key={page.id}><button onClick={()=>onOpen(page.id)}>{page.title} <small>{new Date(page.updated_at).toLocaleString('ko-KR')}</small></button></li>)}</ul>
  </section>;
}
