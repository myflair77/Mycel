import {useEffect,useRef,useState} from 'react';
import type {Editor} from '@tiptap/core';
import {CellSelection} from '@tiptap/pm/tables';
import {selectedCells,clearCellContents} from './tableCells';
const colors=[['기본',''],['회색','#64748b'],['갈색','#97644c'],['주황','#c56c19'],['노랑','#9a7a00'],['초록','#28754c'],['파랑','#2563bb'],['보라','#8055a8'],['분홍','#b34d80'],['빨강','#c43d3d']];
const backgrounds=[['기본',''],['회색','#e7e9ee'],['갈색','#eee0d7'],['주황','#ffead6'],['노랑','#fef3c7'],['초록','#dcfce7'],['파랑','#dbeafe'],['보라','#ede2ff'],['분홍','#fce7f3'],['빨강','#fee2e2']];
export function PageCellTools({editor}:{editor:Editor}){
 const [anchor,setAnchor]=useState<{x:number;y:number;count:number}|null>(null),[menu,setMenu]=useState<{x:number;y:number}|null>(null);const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const update=()=>{const positions=selectedCells(editor.state);if(!positions.length){setAnchor(null);setMenu(null);return}const selection=editor.state.selection;const pos=selection instanceof CellSelection?selection.$headCell.pos:positions[0];const cell=editor.view.nodeDOM(pos) as HTMLElement,container=editor.view.dom.closest('.page-editor');if(!cell||!container)return;const c=cell.getBoundingClientRect(),r=container.getBoundingClientRect();setAnchor({x:c.right-r.left-10,y:c.top-r.top+c.height/2-10,count:positions.length})};
 const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!button.current?.contains(e.target as Node))setMenu(null)};const scroll=(e:Event)=>{setMenu(null);if((e.target as HTMLElement).classList?.contains('tableWrapper'))update()};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(null)};const resize=new ResizeObserver(update);resize.observe(editor.view.dom);editor.on('transaction',update);window.addEventListener('resize',update);window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);update();return()=>{resize.disconnect();editor.off('transaction',update);window.removeEventListener('resize',update);window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape)}},[editor]);
 if(!anchor||!editor.isEditable)return null;
 const style=(name:string,value:string)=>{editor.chain().focus().setCellAttribute(name,value||null).run()};
 const attrs=editor.state.doc.nodeAt(selectedCells(editor.state)[0])?.attrs??{};
 return <><button ref={button} className="editor-cell-trigger" aria-label="선택한 셀 메뉴" aria-expanded={!!menu} title="셀 색상·정렬·내용 비우기" style={{left:anchor.x,top:anchor.y}} onPointerDown={e=>{e.preventDefault();e.stopPropagation()}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMenu(menu?null:{x:Math.max(8,Math.min(r.right+4,window.innerWidth-280)),y:Math.max(8,Math.min(r.top,window.innerHeight-390))})}}>⋮</button>
 {menu&&<div ref={root} className="editor-menu editor-cell-menu" role="dialog" aria-label="셀 편집" style={{left:menu.x,top:menu.y}} onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault()}}>
 <strong>{anchor.count>1?anchor.count+'개 셀':'셀'} 편집</strong><button aria-label="셀 메뉴 닫기" onClick={()=>setMenu(null)}>닫기 ×</button>
 <fieldset><legend>글자색</legend><div className="cell-color-options">{colors.map(([label,color])=><button key={label} title={label+' 글자색'} aria-label={label+' 글자색'} aria-pressed={(attrs.color??'')===color} style={{color:color||'var(--ink)'}} onClick={()=>style('color',color)}>A</button>)}</div></fieldset>
 <fieldset><legend>배경색</legend><div className="cell-color-options">{backgrounds.map(([label,color])=><button key={label} title={label+' 배경색'} aria-label={label+' 배경색'} aria-pressed={(attrs.background??'')===color} onClick={()=>style('background',color)}><span style={{background:color||'var(--paper)'}}/></button>)}</div></fieldset>
 <div className="cell-align-options">{[['left','왼쪽'],['center','가운데'],['right','오른쪽']].map(([value,label])=><button key={value} aria-label={label+' 정렬'} aria-pressed={attrs.align===value} onClick={()=>style('align',value)}>{label}</button>)}</div>
 <button disabled={!editor.can().mergeCells()} onClick={()=>{editor.chain().focus().mergeCells().run();setMenu(null)}}>셀 합치기</button><button disabled={!editor.can().splitCell()} onClick={()=>{editor.chain().focus().splitCell().run();setMenu(null)}}>셀 나누기</button>
 <button onClick={()=>{clearCellContents(editor.state,tr=>editor.view.dispatch(tr));editor.view.focus();setMenu(null)}}>내용 비우기</button>
 <small>Tab 다음 셀 · Shift+Tab 이전 셀<br/>Shift+Enter 셀 안에서 줄바꿈</small>
 </div>}</>;
}
