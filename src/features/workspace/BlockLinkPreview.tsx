import {createPortal} from 'react-dom';
import {blockLinkId} from './blockReferenceModel';
export {blockLinkId} from './blockReferenceModel';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {EditorContent,useEditor} from '@tiptap/react';
import {extensions} from './pageExtensions';
import {blocksToDoc,uniqueIds,type SavedBlock} from './pageDocument';
import {rpc} from './Workspace';
function PreviewBody({block}:{block:SavedBlock}){const editor=useEditor({extensions:extensions(),content:uniqueIds(blocksToDoc([block])),editable:false,editorProps:{attributes:{'aria-label':'블록 미리보기'}}},[block.id]);return <div className="page-editor block-preview-content"><EditorContent editor={editor}/></div>}
export function BlockLinkPreview({onGo}:{onGo:(info:any)=>Promise<void>}){
 const [fontSize,setFontSize]=useState('');
 const sourceFont=(el:HTMLElement)=>setFontSize(getComputedStyle(el.closest('.tiptap')??document.querySelector('.page-editor .tiptap')??el).fontSize);
 const [rename,setRename]=useState<((value:string)=>void)|null>(null),[label,setLabel]=useState(''),[naming,setNaming]=useState(false);
 const [id,setId]=useState(()=>blockLinkId(location.href,location.origin)),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);const popup=useRef<HTMLDivElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const close=()=>{setId(null);returnFocus.current?.focus({preventScroll:true})};
 useEffect(()=>{const click=(e:MouseEvent)=>{const el=(e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement|null;if(!el||el.hasAttribute('data-block-reference')||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const block=blockLinkId(el.href,location.origin);if(!block)return;e.preventDefault();e.stopPropagation();returnFocus.current=el;sourceFont(el);setRename(null);setNaming(false);setId(block)};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true)},[]);
 useEffect(()=>{const open=(event:Event)=>{const d=(event as CustomEvent).detail;returnFocus.current=d.anchor;sourceFont(d.anchor);setRename(()=>d.rename??null);setLabel(d.label??'');setNaming(false);setId(d.id)};window.addEventListener('mycel-block-preview',open);return()=>window.removeEventListener('mycel-block-preview',open)},[]);
 useEffect(()=>{if(!id)return;let live=true;setData(null);setError('');void(async()=>{const info=await rpc('page_block_info',{p_block:id}),doc=await rpc('workspace_get',{p_id:info.note_id});const block=doc.blocks.find((b:SavedBlock)=>b.id===id);if(!block)throw Error('블록이 이동되었거나 삭제되었습니다. 링크를 다시 열어 주세요.');if(live)setData({info,block,title:doc.item.title})})().catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[id]);
 useEffect(()=>{if(!id)return;popup.current?.focus();const outside=(e:PointerEvent)=>{if(!popup.current?.contains(e.target as Node))close()},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true)}},[id]);
 if(!id)return null;
 return createPortal(<div className="block-link-preview" style={{'--preview-font-size':fontSize||undefined} as CSSProperties} ref={popup} tabIndex={-1} role="dialog" aria-label="블록 미리보기" data-note-document={data?.info.note_id} data-can-comment="false"><header><strong>{data?.title??'블록 미리보기'}</strong><button aria-label="블록 미리보기 닫기" onClick={close}>×</button></header>{rename&&<div className="block-reference-name">{naming?<form onSubmit={e=>{e.preventDefault();rename(label);setNaming(false)}}><input aria-label="블록 참조 표시 이름" placeholder="비우면 블록 내용으로 표시" value={label} maxLength={200} onChange={e=>setLabel(e.target.value)}/><button type="submit">저장</button></form>:<button onClick={()=>setNaming(true)}>표시 이름 변경</button>}</div>}{error?<p role="alert">{error}</p>:data?<PreviewBody block={data.block}/>:<p role="status">블록을 불러오는 중…</p>}<footer><button disabled={!data||busy} onClick={async()=>{setBusy(true);try{await onGo(data.info);setId(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>원본 블록으로 이동</button></footer></div>,document.body);
}
