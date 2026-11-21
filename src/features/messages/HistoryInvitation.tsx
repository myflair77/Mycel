import {useState} from 'react';
import {supabase} from '../../services/supabase';
export type HistoryProposal={id:string;proposer:string;status:string;expires_at:string;total:number;agreed:number;my_vote:boolean|null;targets:{id:string;display_name:string;username:string}[]};
export function HistoryInvitation({proposal,userId,onChanged}:{proposal:HistoryProposal|null;userId:string;onChanged:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!proposal)return null;const p=proposal,active=['pending','approved'].includes(p.status);
 const statuses:Record<string,string>={pending:'동의 진행 중',approved:'전원 동의 완료 · 방장 초대 대기',accepted:'이전 기록 공개 초대 완료',rejected:'거절로 종료',cancelled:'제안 취소',expired:'72시간 기한 만료',invalidated:'참여자·방장·권한 변경으로 종료'};
 async function run(name:string,args:Record<string,unknown>){if(busy)return;setBusy(true);setError('');try{const {error}=await supabase!.rpc(name,args);if(error)throw error;window.dispatchEvent(new Event('weano-group'));onChanged()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="group-proposal" aria-label="이전 기록 공개 초대"><h3>이전 기록 공개 초대</h3><p>대상: {p.targets.map(t=>`${t.display_name} (@${t.username})`).join(', ')}</p><p>이 사람들에게 이 방의 이전 대화·사진·파일·노트·공지를 공개합니다. 삭제·만료된 원본은 복구되지 않습니다. 동의는 표시된 대상에게만 적용됩니다.</p><strong>{statuses[p.status]??p.status}</strong><p>동의 {p.agreed}/{p.total}명 · 기한 {new Date(p.expires_at).toLocaleString('ko-KR')}</p>
 {p.status==='pending'&&p.my_vote===null&&<div className="group-member-actions"><button disabled={busy} className="primary-button" onClick={()=>void run('vote_history_invitation',{p_id:p.id,p_agree:true})}>이전 기록 공개에 동의</button><button disabled={busy} onClick={()=>void run('vote_history_invitation',{p_id:p.id,p_agree:false})}>공개 거절 · 제안 종료</button></div>}
 {p.status==='pending'&&p.my_vote===true&&<p>동의했습니다. 나머지 참여자의 응답을 기다립니다.</p>}
 {p.status==='approved'&&p.proposer===userId&&<button disabled={busy} className="primary-button" onClick={()=>void run('finish_history_invitation',{p_id:p.id,p_cancel:false})}>동의한 범위로 초대 완료</button>}
 {active&&p.proposer===userId&&<button disabled={busy} onClick={()=>void run('finish_history_invitation',{p_id:p.id,p_cancel:true})}>공개 초대 제안 취소</button>}<p role="status">{error}</p></section>
}
