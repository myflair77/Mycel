import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Editor} from '@tiptap/core';
import type {EditorView} from '@tiptap/pm/view';
import {TextSelection} from '@tiptap/pm/state';
import {toggleMark} from '@tiptap/pm/commands';
import {applyInlineColor} from './pageInlineColor';
import {blockColors} from './pageBlockAppearance';
import {findProjectedCell} from './tableProjectionEdit';
import {selectionQuote} from './pageExtensions';
export function ProjectedCellSelectionTools({editor,canEdit,canComment,onComment}:{editor:Editor;canEdit:boolean;canComment:boolean;onComment:(q:NonNullable<ReturnType<typeof selectionQuote>>)=>void}){
 const [current,setCurrent]=useState<{view:EditorView;id:string}|null>(null),[box,setBox]=useState<{left:number;top:number}|null>(null),[colors,setColors]=useState(false),[selecting,setSelecting]=useState(false);
 useEffect(()=>{let active:typeof current=null,frame=0,down=false;const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!active||!active.view.dom.isConnected||down){setBox(null);return}const {from,to}=active.view.state.selection;if(from===to||!(active.view.state.selection instanceof TextSelection)){setBox(null);return}const a=active.view.coordsAtPos(from),b=active.view.coordsAtPos(to);setBox({left:Math.max(8,Math.min((a.left+b.right)/2-140,innerWidth-300)),top:Math.max(8,Math.min(a.top,b.top)-44)})});};const update=(event:Event)=>{active=(event as CustomEvent).detail;setCurrent(active);refresh()};const start=(event:PointerEvent)=>{if(active?.view.dom.contains(event.target as Node)){down=true;setSelecting(true);setBox(null)}};const end=()=>{down=false;setSelecting(false);refresh()};editor.view.dom.addEventListener('mycel-projected-cell-selection',update);document.addEventListener('pointerdown',start,true);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);document.addEventListener('selectionchange',refresh);window.addEventListener('scroll',refresh,true);return()=>{cancelAnimationFrame(frame);editor.view.dom.removeEventListener('mycel-projected-cell-selection',update);document.removeEventListener('pointerdown',start,true);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',end);document.removeEventListener('selectionchange',refresh);window.removeEventListener('scroll',refresh,true)}},[editor]);
 if(!current||!box||selecting||(!canEdit&&!canComment))return null;const {view,id}=current;const theme=getComputedStyle(editor.view.dom),themeStyle=Object.fromEntries(['--paper','--ink','--muted','--line','--soft','--link'].map(key=>[key,theme.getPropertyValue(key)]));
 const comment=()=>{const source=findProjectedCell(editor.state.doc,id);if(!source)return;const q=selectionQuote(editor,{from:source.pos+1+view.state.selection.from,to:source.pos+1+view.state.selection.to});if(q)onComment(q)};
 return createPortal(<div className="editor-menu projected-cell-toolbar" style={{...themeStyle,left:box.left,top:box.top}} onMouseDown={e=>e.preventDefault()} role="toolbar" aria-label="표 선택 문구 서식">
 {canEdit&&<><button aria-label="선택 문장 색상" onClick={()=>setColors(v=>!v)}>A</button>{[['bold','굵게','B'],['italic','기울임','I'],['underline','밑줄','U'],['strike','취소선','S'],['code','코드','‹›']].map(([mark,label,text])=><button key={mark} aria-label={label} onClick={()=>{const type=view.state.schema.marks[mark];if(type)toggleMark(type)(view.state,view.dispatch);view.focus()}}>{text}</button>)}</>}
 {canComment&&<button aria-label="인라인 댓글 달기" onClick={comment}>댓글</button>}
 {canEdit&&colors&&<div className="projected-cell-colors">{(['text','background'] as const).map(field=><div key={field}><small>{field==='text'?'글자색':'배경색'}</small>{blockColors.map(c=><button key={c.id} aria-label={'선택 '+(field==='text'?'글자색':'배경색')+' '+c.label} style={field==='text'?{color:c.hex}:{background:c.background}} onClick={()=>{applyInlineColor(view.state,field,c.id,view.dispatch);setColors(false);view.focus()}}>A</button>)}</div>)}</div>}
 </div>,document.body);
}

