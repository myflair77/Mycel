import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export function useBlockConfirmation(){
 const [target,setTarget]=useState<{name:string;resolve:(ok:boolean)=>void}|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),pending=useRef<((ok:boolean)=>void)|null>(null);
 useEffect(()=>{if(target)dialog.current?.showModal()},[target]);
 useEffect(()=>()=>pending.current?.(false),[]);
 function close(ok:boolean){pending.current?.(ok);pending.current=null;setTarget(null)}
 function confirmBlock(name:string){pending.current?.(false);return new Promise<boolean>(resolve=>{pending.current=resolve;setTarget({name,resolve})})}
 const confirmation=target?createPortal(<dialog ref={dialog} className="block-confirmation" aria-labelledby="block-title" onCancel={e=>{e.preventDefault();close(false)}} onClick={e=>{if(e.target===e.currentTarget)close(false)}}>
 <h2 id="block-title">{target.name}님을 차단할까요?</h2><p>차단하면 양쪽 모두 새 메시지와 친구 요청을 보낼 수 없습니다. 기존 대화와 파일은 유지됩니다.</p><p className="muted">해제 후 친구 관계는 다시 요청해야 합니다.</p><div className="friend-actions"><button autoFocus onClick={()=>close(false)}>취소</button><button className="danger" onClick={()=>close(true)}>차단하기</button></div></dialog>,document.body):null;
 return {confirmBlock,confirmation};
}
