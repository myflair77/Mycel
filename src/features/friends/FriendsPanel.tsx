import {useEffect,useState,type FormEvent} from 'react';
import {supabase} from '../../services/supabase';
type Person={id:string;username:string;display_name:string};
type Relation=Person&{status:'pending'|'accepted';incoming:boolean};
export function FriendsPanel({onChat}:{onChat:(username:string)=>Promise<void>}){
 const [relations,setRelations]=useState<Relation[]>([]),[blocks,setBlocks]=useState<Person[]>([]),[found,setFound]=useState<Person|null>(null);
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 async function refresh(){const {data,error}=await supabase!.rpc('list_social');if(error){setNotice('친구 목록을 불러오지 못했습니다. '+error.message);return}setRelations(data.relations);setBlocks(data.blocks);setReady(true)}
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer)},[]);
 async function action(name:string,args:Record<string,unknown>,message:string){setBusy(true);setNotice('');try{const {data,error}=await supabase!.rpc(name,args);if(error)throw error;if(data.error)throw new Error(data.error);setNotice(message);setFound(null);await refresh()}catch(e){setNotice(e instanceof Error?e.message:String((e as {message?:string}).message??'요청 실패'))}finally{setBusy(false)}}
 async function search(e:FormEvent<HTMLFormElement>){e.preventDefault();const username=String(new FormData(e.currentTarget).get('friendUsername')).trim();setBusy(true);setFound(null);setNotice('');try{const {data,error}=await supabase!.rpc('search_friend',{p_username:username});if(error)throw error;if(data.error)setNotice(data.error);else setFound(data.user)}catch(e){setNotice(String((e as {message?:string}).message??'검색 실패'))}finally{setBusy(false)}}
 const person=(p:Person)=><><strong>{p.display_name}</strong><small>@{p.username}</small></>;
 return <section className="friends-panel" aria-label="친구 관리"><h2>친구</h2>
 <form onSubmit={search}><label>친구 ID 검색<input name="friendUsername" placeholder="정확한 @사용자ID" required maxLength={25}/></label><button className="primary-button" disabled={busy}>검색</button></form>
 <p className="muted">검색 1분 20회 · 요청 1시간 10회</p>
 {found&&<div className="person-card">{person(found)}<div className="friend-actions"><button disabled={busy} onClick={()=>void action('request_friend',{p_peer:found.id},'친구 요청을 보냈습니다.')}>친구 요청</button><button disabled={busy} onClick={()=>void action('set_user_block',{p_peer:found.id,p_block:true},'차단했습니다. 기존 대화는 보존됩니다.')}>차단</button></div></div>}
 <p role="status" className="notice">{notice}</p>
 <details open><summary>받은 요청 ({relations.filter(p=>p.status==='pending'&&p.incoming).length})</summary>{relations.filter(p=>p.status==='pending'&&p.incoming).map(p=><div className="person-card" key={p.id}>{person(p)}<div className="friend-actions"><button disabled={busy} onClick={()=>void action('respond_friend',{p_peer:p.id,p_accept:true},'친구가 되었습니다.')}>수락</button><button disabled={busy} onClick={()=>void action('respond_friend',{p_peer:p.id,p_accept:false},'요청을 거절했습니다.')}>거절</button><button disabled={busy} onClick={()=>void action('set_user_block',{p_peer:p.id,p_block:true},'차단했습니다.')}>차단</button></div></div>)}</details>
 <details open><summary>친구 목록 ({relations.filter(p=>p.status==='accepted').length})</summary>{relations.filter(p=>p.status==='accepted').map(p=><div className="person-card" key={p.id}>{person(p)}<div className="friend-actions"><button disabled={busy} onClick={()=>void onChat(p.username)}>대화</button><button disabled={busy} onClick={()=>void action('set_user_block',{p_peer:p.id,p_block:true},'차단했습니다. 기존 대화는 보존됩니다.')}>차단</button></div></div>)}</details>
 <details><summary>보낸 요청 ({relations.filter(p=>p.status==='pending'&&!p.incoming).length})</summary>{relations.filter(p=>p.status==='pending'&&!p.incoming).map(p=><div className="person-card" key={p.id}>{person(p)}<small>수락 대기 중</small></div>)}</details>
 <details><summary>차단 관리 ({blocks.length})</summary><p className="muted">차단 시 양쪽의 새 메시지와 친구 요청을 막습니다. 해제해도 친구 관계는 자동 복구되지 않습니다.</p>{blocks.map(p=><div className="person-card" key={p.id}>{person(p)}<button disabled={busy} onClick={()=>void action('set_user_block',{p_peer:p.id,p_block:false},'차단을 해제했습니다.')}>차단 해제</button></div>)}</details>
 <button className="text-button" disabled={busy} onClick={()=>void refresh()}>친구 목록 새로고침</button>{!ready&&<p className="muted">친구 목록 연결 확인 중</p>}
 </section>;
}
