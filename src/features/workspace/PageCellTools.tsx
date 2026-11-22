import {useEffect,useRef,useState} from 'react';
import type {Editor} from '@tiptap/core';
import {CellSelection} from '@tiptap/pm/tables';
import {selectedCells,clearCellContents,projectedCellSelectionKey} from './tableCells';
const colors=[['기본',''],['회색','#64748b'],['갈색','#97644c'],['주황','#c56c19'],['노랑','#9a7a00'],['초록','#28754c'],['파랑','#2563bb'],['보라','#8055a8'],['분홍','#b34d80'],['빨강','#c43d3d']];
const backgrounds=[['기본',''],['회색','#e7e9ee'],['갈색','#eee0d7'],['주황','#ffead6'],['노랑','#fef3c7'],['초록','#dcfce7'],['파랑','#dbeafe'],['보라','#ede2ff'],['분홍','#fce7f3'],['빨강','#fee2e2']];
function visibleCell(editor:Editor,pos:number){const source=editor.view.nodeDOM(pos) as HTMLElement;if(!source)return null;const wrapper=source.closest('.personal-table-wrapper');if(source.closest('.personal-table-source[hidden]')){const id=editor.state.doc.nodeAt(pos)?.attrs.id;return Array.from(wrapper?.querySelectorAll<HTMLElement>('[data-source-cell]')||[]).find(cell=>cell.dataset.sourceCell===id)||null}return source}
export function PageCellTools({editor}:{editor:Editor}){
 const [anchor,setAnchor]=useState<{x:number;y:number;count:number;cornerX:number;cornerY:number}|null>(null),[menu,setMenu]=useState<{x:number;y:number}|null>(null);const [colorMenu,setColorMenu]=useState(false);const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),cancelRange=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>cancelRange.current?.(),[]);
 useEffect(()=>{const update=()=>{const positions=selectedCells(editor.state);if(!positions.length){setAnchor(null);setMenu(null);return}const selection=editor.state.selection;const pos=selection instanceof CellSelection?selection.$headCell.pos:positions[0];const ids=projectedCellSelectionKey.getState(editor.state),last=ids?.at(-1);const anchorPos=last?positions.find(p=>editor.state.doc.nodeAt(p)?.attrs.id===last)??pos:pos;const cell=visibleCell(editor,anchorPos),container=editor.view.dom.closest('.page-editor');if(!cell||!container)return;const c=cell.getBoundingClientRect(),r=container.getBoundingClientRect();setAnchor({x:c.right-r.left-10,y:c.top-r.top+c.height/2-10,count:positions.length,cornerX:c.right-r.left,cornerY:c.bottom-r.top})};
 const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!button.current?.contains(e.target as Node))setMenu(null)};const scroll=(e:Event)=>{if(root.current?.contains(e.target as Node))return;setMenu(null);if((e.target as HTMLElement).classList?.contains('tableWrapper'))update()};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(null)};const resize=new ResizeObserver(update);resize.observe(editor.view.dom);editor.view.dom.addEventListener('mycel-table-view-render',update);editor.on('transaction',update);window.addEventListener('resize',update);window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);update();return()=>{resize.disconnect();editor.view.dom.removeEventListener('mycel-table-view-render',update);editor.off('transaction',update);window.removeEventListener('resize',update);window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape)}},[editor]);
 if(!anchor||!editor.isEditable)return null;
 function selectRange(e:React.PointerEvent<HTMLButtonElement>){
  e.preventDefault();e.stopPropagation();cancelRange.current?.();setMenu(null);
  const handle=e.currentTarget,selection=editor.state.selection,selected=selectedCells(editor.state),firstId=projectedCellSelectionKey.getState(editor.state)?.[0];
  const first=firstId?selected.find(pos=>editor.state.doc.nodeAt(pos)?.attrs.id===firstId):selection instanceof CellSelection?selection.$anchorCell.pos:selected[0];if(first===undefined)return;
  const initialCell=visibleCell(editor,first) as HTMLTableCellElement|null,table=initialCell?.closest('table');if(!table||!initialCell)return;
  const wrapper=table.closest('.personal-table-wrapper');wrapper?.dispatchEvent(new CustomEvent('mycel-end-cell-edit'));wrapper?.dispatchEvent(new CustomEvent('mycel-cell-range-drag',{detail:true}));
  const projected=table.classList.contains('personal-table-result'),startX=e.clientX,startY=e.clientY,pointerId=e.pointerId;
  let x=startX,y=startY,moved=false,frame=0,lastHit:HTMLTableCellElement|null=null,done=false;
  const scrollers:HTMLElement[]=[];for(let el=table.parentElement;el;el=el.parentElement){const css=getComputedStyle(el);if(/auto|scroll/.test(css.overflow+css.overflowX+css.overflowY))scrollers.push(el)}
  const choose=()=>{
   // Geometry hit testing ignores the moving range handle and other table controls.
   let hit:HTMLTableCellElement|null=null,best=Infinity;
   for(const row of Array.from(table.rows))for(const cell of Array.from(row.cells)){const r=cell.getBoundingClientRect();const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),distance=dx*dx+dy*dy;if(distance<best){best=distance;hit=cell}}
   if(!hit||hit===lastHit)return;lastHit=hit;
   if(projected){const rows=Array.from(table.rows),r1=rows.indexOf(initialCell.parentElement as HTMLTableRowElement),r2=rows.indexOf(hit.parentElement as HTMLTableRowElement),ids:string[]=[];if(r1<0||r2<0)return;
    for(let r=Math.min(r1,r2);r<=Math.max(r1,r2);r++)for(let c=Math.min(initialCell.cellIndex,hit.cellIndex);c<=Math.max(initialCell.cellIndex,hit.cellIndex);c++){const id=rows[r].cells[c]?.dataset.sourceCell;if(id)ids.push(id)}
    editor.view.dispatch(editor.state.tr.setMeta(projectedCellSelectionKey,ids).setMeta('addToHistory',false));
   }else{const pos=editor.view.posAtDOM(hit,0)-1;if(editor.state.doc.nodeAt(pos)?.type.spec.tableRole?.includes('cell')){const next=CellSelection.create(editor.state.doc,first,pos);if(!next.eq(editor.state.selection))editor.view.dispatch(editor.state.tr.setSelection(next).setMeta('addToHistory',false))}}
  };
  const tick=()=>{frame=0;if(done||!moved)return;if(!table.isConnected){finish();return}
   for(const el of scrollers){const r=el.getBoundingClientRect(),edge=28;let dx=0,dy=0;if(y>=r.top&&y<=r.bottom&&el.scrollWidth>el.clientWidth)dx=x<r.left+edge?-10:x>r.right-edge?10:0;if(x>=r.left&&x<=r.right&&el.scrollHeight>el.clientHeight)dy=y<r.top+edge?-10:y>r.bottom-edge?10:0;if(dx||dy){el.scrollBy(dx,dy);lastHit=null}}
   choose();frame=requestAnimationFrame(tick);
  };
  const move=(event:PointerEvent)=>{if(event.pointerId!==pointerId)return;event.preventDefault();x=event.clientX;y=event.clientY;if(!moved&&Math.hypot(x-startX,y-startY)<3)return;moved=true;if(!frame)frame=requestAnimationFrame(tick)};
  const finish=(event?:PointerEvent)=>{if(event&&event.pointerId!==pointerId)return;if(done)return;if(event?.type==='pointerup'&&moved){x=event.clientX;y=event.clientY;choose()}done=true;cancelAnimationFrame(frame);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',finish,true);document.removeEventListener('pointercancel',finish,true);handle.removeEventListener('lostpointercapture',finish);if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);cancelRange.current=null;wrapper?.dispatchEvent(new CustomEvent('mycel-cell-range-drag',{detail:false}))};
  handle.setPointerCapture(pointerId);document.addEventListener('pointermove',move,{capture:true,passive:false});document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);handle.addEventListener('lostpointercapture',finish);cancelRange.current=finish;
 }
 const style=(name:string,value:string)=>{const tr=editor.state.tr;for(const pos of selectedCells(editor.state)){const cell=tr.doc.nodeAt(pos)!;tr.setNodeMarkup(pos,undefined,{...cell.attrs,[name]:value||null})}editor.view.dispatch(tr)};
 const attrs=editor.state.doc.nodeAt(selectedCells(editor.state)[0])?.attrs??{};
 return <><button type="button" className="table-range-handle" aria-label="셀 범위 선택" title="끌어서 여러 셀 선택" style={{left:anchor.cornerX,top:anchor.cornerY}} onPointerDown={selectRange}/><button ref={button} className="editor-cell-trigger" aria-label="선택한 셀 메뉴" aria-expanded={!!menu} title="셀 색상·정렬·내용 비우기" style={{left:anchor.x,top:anchor.y}} onPointerDown={e=>{e.preventDefault();e.stopPropagation()}} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setColorMenu(false);setMenu(menu?null:{x:Math.max(8,Math.min(r.right+4,window.innerWidth-232)),y:Math.max(8,Math.min(r.top,window.innerHeight-260))})}}><svg aria-hidden="true" width="4" height="14" viewBox="0 0 4 14"><circle cx="2" cy="2" r="1.2" fill="currentColor"/><circle cx="2" cy="7" r="1.2" fill="currentColor"/><circle cx="2" cy="12" r="1.2" fill="currentColor"/></svg></button>
 {menu&&<div ref={root} className="editor-menu editor-cell-menu" role="dialog" aria-label="셀 편집" style={{left:menu.x,top:menu.y}} onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault()}}>
 <div className="cell-menu-heading"><strong>{colorMenu?'색상':anchor.count>1?anchor.count+'개 셀':'셀'}</strong><button aria-label="셀 메뉴 닫기" onClick={()=>setMenu(null)}>×</button></div>{colorMenu?<><button onClick={()=>setColorMenu(false)}>‹ 셀 메뉴</button>
 <fieldset><legend>글자색</legend><div className="cell-color-options">{colors.map(([label,color])=><button key={label} title={label+' 글자색'} aria-label={label+' 글자색'} aria-pressed={(attrs.color??'')===color} style={{color:color||'var(--ink)'}} onClick={()=>style('color',color)}>A</button>)}</div></fieldset>
 <fieldset><legend>배경색</legend><div className="cell-color-options">{backgrounds.map(([label,color])=><button key={label} title={label+' 배경색'} aria-label={label+' 배경색'} aria-pressed={(attrs.background??'')===color} onClick={()=>style('background',color)}><span style={{background:color||'var(--paper)'}}/></button>)}</div></fieldset>
 </>:<><button aria-haspopup="true" onClick={()=>setColorMenu(true)}>색상 <span>›</span></button>
 <div className="cell-align-options">{[['left','왼쪽'],['center','가운데'],['right','오른쪽']].map(([value,label])=><button key={value} aria-label={label+' 정렬'} aria-pressed={attrs.align===value} onClick={()=>style('align',value)}>{label}</button>)}</div>
 <button disabled={!!projectedCellSelectionKey.getState(editor.state)?.length||!editor.can().mergeCells()} onClick={()=>{editor.chain().focus().mergeCells().run();setMenu(null)}}>셀 합치기</button><button disabled={!!projectedCellSelectionKey.getState(editor.state)?.length||!editor.can().splitCell()} onClick={()=>{editor.chain().focus().splitCell().run();setMenu(null)}}>셀 나누기</button>
 <button onClick={()=>{clearCellContents(editor.state,tr=>editor.view.dispatch(tr));setMenu(null)}}>내용 비우기</button>
 </>}
 </div>}</>;
}
