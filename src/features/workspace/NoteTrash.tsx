import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {NoteList,type NoteRow} from './NoteList';
import {rpc} from './Workspace';
type DeleteItem={id:string;title:string;version:number};
export function NoteTrash({items,userId,onOpen,onChanged}:{items:NoteRow[];userId:string;onOpen:(id:string)=>void;onChanged:()=>Promise<void>}){
 const [selected,setSelected]=useState<Set<string>>(new Set()),[preview,setPreview]=useState<DeleteItem[]|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setSelected(old=>new Set([...old].filter(id=>items.some(i=>i.id===id&&i.permission===4))))},[items]);
 useEffect(()=>{if(preview)dialog.current?.showModal()},[preview]);
 const close=()=>{if(busy)return;setPreview(null);trigger.current?.focus()};
 async function prepare(){setBusy(true);setMessage('');try{setPreview(await rpc('workspace_delete_preview',{p_ids:[...selected]}))}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function remove(){if(!preview)return;setBusy(true);setMessage('');try{const total=await rpc('workspace_delete_notes',{p_items:preview});setPreview(null);setSelected(new Set());await onChanged();setMessage(total+'개 노트를 완전 삭제했습니다.');trigger.current?.focus()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <><div className="note-trash-tools"><p>휴지통으로 옮긴 뒤 30일이 지나면 자동으로 완전 삭제됩니다.</p><button ref={trigger} className="danger" disabled={busy||!selected.size} onClick={()=>void prepare()}>선택 삭제{selected.size?' ('+selected.size+')':''}</button></div><p role="status">{message}</p><NoteList items={items} listKey={userId+':trash'} userId={userId} unread={[]} onOpen={onOpen} selection={{ids:selected,onChange:setSelected,busy}}/>
 {preview&&createPortal(<dialog className="note-delete-dialog" ref={dialog} aria-labelledby="note-delete-title" onCancel={e=>{e.preventDefault();close()}}><h2 id="note-delete-title">노트 {preview.length}개를 완전 삭제할까요?</h2><p>하위 노트, 댓글, 수정 이력도 함께 삭제되며 복원할 수 없습니다. 이 노트가 원본인 동기화 블록도 더 이상 사용할 수 없습니다.</p><ul>{preview.slice(0,20).map(i=><li key={i.id}>{i.title}</li>)}</ul>{preview.length>20&&<p>외 {preview.length-20}개</p>}{message&&<p role="alert">{message}</p>}<div><button disabled={busy} onClick={close}>취소</button><button className="danger" disabled={busy} onClick={()=>void remove()}>{busy?'삭제 중…':'완전 삭제'}</button></div></dialog>,document.querySelector('.app')??document.body)}</>;
}
