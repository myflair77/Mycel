import {useEffect,useState} from 'react';
import {supabase} from '../../services/supabase';

type Proposal={request_id:string;tool:string;args:Record<string,unknown>};
type Settings={linked:boolean;calendar:string;direction:string;pending:Proposal[]};
export function CalendarConnection(){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [calendar,setCalendar]=useState('primary'),[direction,setDirection]=useState('both');
 const [code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){
   const {data,error}=await supabase!.rpc('calendar_connection_settings');
   if(error)throw error;
   setSettings(data);
   if(data){setCalendar(data.calendar);setDirection(data.direction);}
 }
 useEffect(()=>{void refresh().catch(()=>setNotice('연결 설정을 불러올 수 없습니다.'));},[]);
 async function run(name:string,args:Record<string,unknown>={}){
   setBusy(true);setNotice('');
   try{
     const {data,error}=await supabase!.rpc(name,args);
     if(error)throw error;
     if(name==='calendar_connect')setCode(String(data));
     if(name==='calendar_disconnect')setCode('');
     await refresh();
     if(name==='calendar_approve')setNotice('승인했습니다. 같은 요청을 다시 실행하면 반영됩니다.');
   }catch{setNotice('요청을 완료하지 못했습니다. 연결 상태를 확인하세요.');}
   finally{setBusy(false);}
 }
 return <details><summary>Google Calendar 동기화</summary>
 <p>{settings?.linked?'Mycel 계정 연결됨':'Mycel 계정 연결 대기'} · 예약 실행 미검증</p>
 <label>Google 캘린더 ID <input value={calendar} onChange={e=>setCalendar(e.target.value)}/></label>
 <label>방향 <select value={direction} onChange={e=>setDirection(e.target.value)}><option value="both">양방향</option><option value="import">Google → Mycel</option><option value="export">Mycel → Google</option></select></label>
 <button disabled={busy||!calendar.trim()} onClick={()=>void run('calendar_connect',{p_calendar:calendar,p_direction:direction})}>{settings?.linked?'기존 연결 해제 후 새 코드 발급':'5분 연결 코드 발급'}</button>
 {settings&&<button disabled={busy} onClick={()=>void run('calendar_disconnect')}>연결 해제</button>}
 {code&&!settings?.linked&&<p>ChatGPT에서 Mycel 플러그인의 calendar_pair에 이 코드를 입력하세요. <code>{code}</code></p>}
 <button disabled={busy} onClick={()=>void refresh().catch(()=>setNotice('조회에 실패했습니다.'))}>연결·승인 목록 새로고침</button>
 {settings?.pending.map(p=><details key={p.request_id}><summary>{({calendar_create_event:'일정 추가',calendar_update_event:'일정 변경',calendar_delete_event:'휴지통 이동'} as Record<string,string>)[p.tool]} · {String(p.args.title??p.args.id)}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(p.args,null,2)}</pre><button disabled={busy} onClick={()=>void run('calendar_approve',{p_request:p.request_id})}>이 변경 승인</button></details>)}
 <p role="status">{notice}</p></details>;
}
