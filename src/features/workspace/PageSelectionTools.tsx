import {useCallback,useEffect,useRef,useState} from 'react';
import type {Editor} from '@tiptap/core';
import {TextSelection} from '@tiptap/pm/state';
import {BubbleMenu} from '@tiptap/react/menus';
import {IconValue} from '../../components/SymbolView';
import {blockColors} from './pageBlockAppearance';
import {applyInlineColor,type InlineColorField} from './pageInlineColor';
const bubbleOptions={placement:'top' as const,offset:8,shift:{padding:8},flip:{padding:8},strategy:'fixed' as const};
const appendTo=()=>document.body;
export function PageSelectionTools({editor,hidden=false,onMore,onComment}:{editor:Editor;hidden?:boolean;onMore:()=>void;onComment?:()=>void}){
 const popover=useRef<HTMLDivElement>(null),[ownsFocus,setOwnsFocus]=useState(false);
 const [panel,setPanel]=useState<'color'|'link'|null>(null),[href,setHref]=useState(''),[,refresh]=useState(0);
 useEffect(()=>{const selection=()=>{setPanel(null);refresh(n=>n+1)},update=()=>refresh(n=>n+1);editor.on('selectionUpdate',selection);editor.on('update',update);return()=>{editor.off('selectionUpdate',selection);editor.off('update',update)}},[editor]);
 useEffect(()=>{if(panel)editor.commands.setMeta('selectionFormatting','updatePosition')},[panel,editor]);
 useEffect(()=>{const check=()=>{if(editor.isDestroyed)return;const active=document.activeElement;const owns=active===editor.view.dom||!!popover.current?.contains(active);setOwnsFocus(owns);const selection=editor.state.selection;editor.commands.setMeta('selectionFormatting',!hidden&&owns&&editor.isEditable&&selection instanceof TextSelection&&!selection.empty?'show':'hide');};document.addEventListener('focusin',check);document.addEventListener('selectionchange',check);const frame=requestAnimationFrame(check);return()=>{cancelAnimationFrame(frame);document.removeEventListener('focusin',check);document.removeEventListener('selectionchange',check)}},[editor,hidden]);
 const run=(command:string)=>{if(editor.isEditable)(editor.chain().focus() as any)[command]().run()};
 const apply=(field:InlineColorField,value:string)=>{if(!editor.isEditable)return;applyInlineColor(editor.state,field,value,tr=>editor.view.dispatch(tr));setPanel(null);editor.commands.focus()};
 const shouldShow=useCallback(({state,view}:any)=>!hidden&&editor.isEditable&&(document.activeElement===view.dom||!!popover.current?.contains(document.activeElement))&&state.selection instanceof TextSelection&&!state.selection.empty&&!!state.doc.textBetween(state.selection.from,state.selection.to).trim(),[editor,hidden]);
 return <BubbleMenu editor={editor} pluginKey="selectionFormatting" appendTo={appendTo} updateDelay={0} shouldShow={shouldShow} options={bubbleOptions}>
 <div ref={popover} className="page-selection-popover" hidden={hidden||!ownsFocus} onMouseDown={e=>{if(!(e.target instanceof HTMLInputElement))e.preventDefault()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setPanel(null);editor.commands.focus()}}}>
 <div role="toolbar" aria-label="선택 문장 서식" className="page-selection-row">
 <button type="button" aria-label="선택 문장 색상" aria-expanded={panel==='color'} onClick={()=>setPanel(panel==='color'?null:'color')}><span className="selection-color-icon">A</span></button>
 {([['Bold','굵게','toggleBold','bold'],['Italic','기울임','toggleItalic','italic'],['Underline','밑줄','toggleUnderline','underline'],['Strikethrough','취소선','toggleStrike','strike'],['Code','코드','toggleCode','code']] as const).map(([icon,label,command,mark])=><button key={mark} type="button" aria-label={label} aria-pressed={editor.isActive(mark)} onClick={()=>run(command)}><IconValue decorative value={'icon:'+icon+':default'}/></button>)}
 <button type="button" aria-label="링크" onClick={()=>{setHref(editor.getAttributes('link').href??'');setPanel(panel==='link'?null:'link')}}><IconValue decorative value="icon:Link:default"/></button>
 {onComment&&<button type="button" aria-label="선택 문장에 댓글" onClick={onComment}><IconValue decorative value="icon:MessageSquare:default"/></button>}
 <button type="button" aria-label="선택 블록 더보기" aria-haspopup="menu" onClick={()=>{setPanel(null);onMore()}}><IconValue decorative value="icon:Ellipsis:default"/></button>
 </div>
 {panel==='color'&&<div className="selection-color-panel" role="group" aria-label="선택 문장 색상">{(['text','background'] as const).map(field=><div key={field}><div className="editor-menu-caption">{field==='text'?'글자색':'배경색'}</div>{blockColors.map(c=><button type="button" key={c.id} aria-label={'선택 '+(field==='text'?'글자색':'배경색')+' '+c.label} aria-pressed={editor.isActive('inlineColor',{[field]:c.id==='default'?null:c.id})} onClick={()=>apply(field,c.id)}><span className="block-color-sample" style={field==='text'?{color:c.id==='default'?'inherit':c.hex}:{background:c.background}}>{field==='text'?'A':''}</span>{c.label}</button>)}</div>)}</div>}
 {panel==='link'&&<form className="selection-link-form" onSubmit={e=>{e.preventDefault();if(!editor.isEditable)return;if(!href.trim())editor.chain().focus().unsetLink().run();else if(/^(https?:\/\/|mailto:)/i.test(href))editor.chain().focus().setLink({href}).run();else return;setPanel(null)}}><input aria-label="링크 주소" placeholder="https://" value={href} onChange={e=>setHref(e.target.value)}/><button type="submit">적용</button></form>}
 </div></BubbleMenu>
}
