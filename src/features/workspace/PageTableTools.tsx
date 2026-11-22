import {useEffect,useLayoutEffect,useState,useRef} from 'react';
import type {Editor} from '@tiptap/core';
import {CellSelection,TableMap} from '@tiptap/pm/tables';
import {changeTableAxis,tableBand,tableAxisCells,tableAxisIsHeader,setTableAxisHeader} from './tableAxis';
import {TextSelection,NodeSelection} from '@tiptap/pm/state';
import {blockColors} from './pageBlockAppearance';
import {IconValue} from '../../components/SymbolView';
type Axis='row'|'column';
export function Grip({horizontal=false}:{horizontal?:boolean}){
 return <svg aria-hidden="true" width={horizontal?15:10} height={horizontal?10:15} viewBox={horizontal?'0 0 12 8':'0 0 8 12'}>{Array.from({length:6},(_,i)=><circle key={i} cx={2+(i%(horizontal?3:2))*4} cy={2+Math.floor(i/(horizontal?3:2))*4} r=".9" fill="currentColor"/>)}</svg>
}
function tableGeometry(editor:Editor){
 const c=tableContext(editor);if(!c)return null;const dom=editor.view.nodeDOM(c.pos) as HTMLElement;
 const source=dom?.matches('table')?dom as HTMLTableElement:dom?.querySelector('table');const projected=!!source?.hidden;const table=projected?dom?.querySelector<HTMLTableElement>('.personal-table-result'):source;if(!table)return null;
 const map=TableMap.get(c.node),rect=table.getBoundingClientRect(),edges=new Map<number,number>();
 if(projected){Array.from(table.rows[0]?.cells||[]).forEach((cell,i)=>{const r=cell.getBoundingClientRect();edges.set(i,r.left);edges.set(i+1,r.right)})}
 else for(const pos of new Set(map.map)){const cell=editor.view.nodeDOM(c.start+pos) as HTMLElement;if(!cell)continue;const r=cell.getBoundingClientRect(),span=map.findCell(pos);edges.set(span.left,r.left);edges.set(span.right,r.right)}
 edges.set(0,rect.left);edges.set(map.width,rect.right);
 for(let i=1;i<map.width;i++)if(!edges.has(i)){let a=i-1,b=i+1;while(!edges.has(a))a--;while(!edges.has(b))b++;edges.set(i,edges.get(a)!+(edges.get(b)!-edges.get(a)!)*(i-a)/(b-a))}
 const origin=editor.view.dom.closest('.page-editor')!.getBoundingClientRect();
 return {origin,projected,rowIndices:Array.from(table.rows).map((r,i)=>Number(r.dataset.sourceRow??i)),rows:Array.from(table.rows).map(r=>r.getBoundingClientRect()),cols:Array.from({length:map.width},(_,i)=>new DOMRect(edges.get(i)!,rect.top,edges.get(i+1)!-edges.get(i)!,rect.height)),rect};
}

export function tableContext(editor:Editor){const selection=editor.state.selection;if(selection instanceof NodeSelection&&selection.node.type.name==='table')return {node:selection.node,pos:selection.from,start:selection.from+1};const {$from}=selection;for(let d=$from.depth;d>0;d--)if($from.node(d).type.name==='table')return {node:$from.node(d),pos:$from.before(d),start:$from.start(d)};return null}
export function PageTableTools({editor}:{editor:Editor}){
 const [geometry,setGeometry]=useState<ReturnType<typeof tableGeometry>>(null),[menu,setMenu]=useState<{axis:Axis;index:number;x:number;y:number}|null>(null);
 const [colorOpen,setColorOpen]=useState(false);
 const panel=useRef<HTMLDivElement>(null),dragging=useRef(false),cancelDrag=useRef<(()=>void)|null>(null);
 useEffect(()=>{const update=()=>{if(dragging.current)return;setGeometry(tableGeometry(editor));if(!tableContext(editor))setMenu(null)};
 const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!(e.target as HTMLElement).closest('.table-axis-handle'))setMenu(null)};
 const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){cancelDrag.current?.();setMenu(null)}};
 const onScroll=(e:Event)=>{if(panel.current?.contains(e.target as Node))return;if((e.target as HTMLElement).classList?.contains('tableWrapper'))update();setMenu(null)};const observer=new ResizeObserver(update);observer.observe(editor.view.dom);
 editor.view.dom.addEventListener('mycel-table-view-render',update);editor.on('transaction',update);window.addEventListener('scroll',onScroll,true);window.addEventListener('resize',update);document.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);update();return()=>{cancelDrag.current?.();observer.disconnect();editor.view.dom.removeEventListener('mycel-table-view-render',update);editor.off('transaction',update);window.removeEventListener('scroll',onScroll,true);window.removeEventListener('resize',update);document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape)}},[editor]);
 useEffect(()=>{setColorOpen(false);if(menu)panel.current?.focus({preventScroll:true})},[menu]);
 useLayoutEffect(()=>{const el=panel.current;if(!el||!menu)return;const r=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(menu.x,window.innerWidth-r.width-8))+'px';el.style.top=Math.max(8,Math.min(menu.y,window.innerHeight-r.height-8))+'px'},[menu,colorOpen]);
 function select(axis:Axis,index:number){const c=tableContext(editor);if(!c)return;const map=TableMap.get(c.node),band=tableBand(c.node,axis,index);
 const first=map.map[(axis==='row'?band.start:0)*map.width+(axis==='column'?band.start:0)],last=map.map[(axis==='row'?band.end-1:map.height-1)*map.width+(axis==='column'?band.end-1:map.width-1)];
 editor.view.dispatch(editor.state.tr.setSelection(new CellSelection(editor.state.doc.resolve(c.start+first),editor.state.doc.resolve(c.start+last))))}
 function applyAxis(axis:Axis,index:number,target?:number){
 const c=tableContext(editor);if(!c)return;
 const before=new Map<string,DOMRect>();editor.view.dom.querySelectorAll('td,th').forEach(el=>before.set(el.getAttribute('data-block-id')??'',el.getBoundingClientRect()));
 const result=changeTableAxis(c.node,axis,index,target);if(result.table===c.node)return;
 const tr=editor.state.tr.replaceWith(c.pos,c.pos+c.node.nodeSize,result.table),map=TableMap.get(result.table);
 const pos=c.start+map.map[axis==='row'?result.index*map.width:result.index];
 editor.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos+1))));select(axis,result.index);
 requestAnimationFrame(()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const el of editor.view.dom.querySelectorAll('td,th')){const r=before.get(el.getAttribute('data-block-id')??'');if(!r)continue;const next=el.getBoundingClientRect();el.animate([{transform:`translate(${r.left-next.left}px,${r.top-next.top}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'})}});
 setGeometry(tableGeometry(editor));setMenu(null);
 }
 function move(axis:Axis,from:number,to:number){if(geometry?.projected&&axis==='row')return;applyAxis(axis,from,to);if(!geometry?.projected)editor.view.focus()}
 function drag(e:React.PointerEvent,axis:Axis,index:number){e.preventDefault();e.stopPropagation();const handle=e.currentTarget as HTMLElement;handle.setPointerCapture(e.pointerId);const start=axis==='row'?e.clientY:e.clientX;let target=index,moved=false;const line=document.createElement('div');line.className='editor-drop-line table-drop-line';const ghost=document.createElement('div');ghost.className='editor-drag-ghost';const c=tableContext(editor),band=c&&tableBand(c.node,axis,index);ghost.textContent=(band?band.end-band.start:1)+(axis==='row'?'개 행':'개 열');
 const finish=()=>{handle.removeEventListener('pointermove',track);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',cancel);line.remove();ghost.remove();dragging.current=false;cancelDrag.current=null};
 const cancel=()=>finish();cancelDrag.current=cancel;
 const track=(ev:PointerEvent)=>{if(geometry?.projected&&axis==='row')return;const value=axis==='row'?ev.clientY:ev.clientX;if(!moved&&Math.abs(value-start)<5)return;moved=true;dragging.current=true;setMenu(null);if(!line.isConnected)document.body.append(line,ghost);ghost.style.transform='translate('+(ev.clientX+12)+'px,'+(ev.clientY+10)+'px)';const g=tableGeometry(editor);if(!g)return;const rect=g.rect,items=axis==='row'?g.rows:g.cols;let distance=Infinity;items.forEach((r,i)=>{const delta=Math.abs(value-(axis==='row'?(r.top+r.bottom)/2:(r.left+r.right)/2));if(delta<distance){distance=delta;target=i}});
 const c=tableContext(editor),band=c&&tableBand(c.node,axis,target);const r=items[band?(target>index?band.end-1:band.start):target];Object.assign(line.style,{left:(axis==='row'?rect.left:target>index?r.right:r.left)+'px',top:(axis==='column'?rect.top:target>index?r.bottom:r.top)+'px',width:(axis==='row'?rect.width:3)+'px',height:(axis==='column'?rect.height:3)+'px'});};
 const end=(ev:PointerEvent)=>{finish();if(moved){if(target!==index)move(axis,index,target)}else {select(axis,index);setMenu({axis,index,x:Math.min(ev.clientX,window.innerWidth-250),y:Math.min(ev.clientY,window.innerHeight-430)})}};
 handle.addEventListener('pointermove',track);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',cancel);
 }
 function duplicate(){if(menu)applyAxis(menu.axis,menu.index)}
 function action(cmd:string){if(!menu)return;select(menu.axis,menu.index);(editor.chain() as any)[cmd]().run();setMenu(null)}
 function toggleHeader(){if(!menu)return;const c=tableContext(editor);if(!c)return;const next=setTableAxisHeader(c.node,menu.axis,menu.index,!tableAxisIsHeader(c.node,menu.axis,menu.index));const cells=tableAxisCells(next,menu.axis,menu.index),tr=editor.state.tr.replaceWith(c.pos,c.pos+c.node.nodeSize,next);editor.view.dispatch(tr.setSelection(CellSelection.create(tr.doc,c.start+cells[0],c.start+cells[cells.length-1])))}
 function color(field:'color'|'background',value:string|null){if(!menu)return;select(menu.axis,menu.index);editor.chain().setCellAttribute(field,value).run();setMenu(null)}
 if(!geometry||!editor.isEditable)return null;const c=tableContext(editor);if(!c)return null;const map=TableMap.get(c.node);
 return <>
 {geometry.rows.map((r,visibleIndex)=>{const i=geometry.rowIndices[visibleIndex];return <button key={'r'+i} className="table-axis-handle row" style={{left:geometry.rect.left-geometry.origin.left-6,top:r.top-geometry.origin.top+r.height/2-12}} aria-label={`${i+1}행 이동 및 메뉴`} title={geometry.projected?"클릭하여 행 메뉴 · 행 이동은 정렬·필터 해제 후 사용":"드래그하여 행 이동 · 클릭하여 메뉴 · Alt+방향키로 이동"} onPointerDown={e=>drag(e,'row',i)} onKeyDown={e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();move('row',i,Math.max(0,Math.min(map.height-1,i+(e.key==='ArrowDown'?1:-1))))}else if(e.key==='Enter'||e.key===' '){e.preventDefault();select('row',i);setMenu({axis:'row',index:i,x:Math.min(r.left,window.innerWidth-250),y:Math.min(r.top,window.innerHeight-430)})}}}><Grip/></button>})}
 {geometry.cols.map((r,i)=><button key={'c'+i} className="table-axis-handle column" style={{left:r.left-geometry.origin.left+r.width/2-12,top:geometry.rect.top-geometry.origin.top-6}} aria-label={`${i+1}열 이동 및 메뉴`} title="드래그하여 열 이동 · 클릭하여 메뉴 · Alt+방향키로 이동" onPointerDown={e=>drag(e,'column',i)} onKeyDown={e=>{if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move('column',i,Math.max(0,Math.min(map.width-1,i+(e.key==='ArrowRight'?1:-1))))}else if(e.key==='Enter'||e.key===' '){e.preventDefault();select('column',i);setMenu({axis:'column',index:i,x:Math.min(r.left,window.innerWidth-250),y:Math.min(r.top,window.innerHeight-430)})}}}><Grip horizontal/></button>)}
 <div className="editor-table-tools" onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault()}}><button onClick={()=>editor.chain().focus().addRowAfter().run()}>＋ 행</button><button onClick={()=>editor.chain().focus().addColumnAfter().run()}>＋ 열</button><button onClick={()=>editor.chain().focus().toggleHeaderRow().run()}>머리글 행</button><button onClick={()=>editor.chain().focus().toggleHeaderColumn().run()}>머리글 열</button><button disabled={!editor.can().mergeCells()} onClick={()=>editor.chain().focus().mergeCells().run()}>셀 합치기</button><button disabled={!editor.can().splitCell()} onClick={()=>editor.chain().focus().splitCell().run()}>셀 나누기</button><select aria-label="셀 텍스트 정렬" value={editor.getAttributes('tableCell').align??editor.getAttributes('tableHeader').align??''} onChange={e=>editor.chain().focus().setCellAttribute('align',e.target.value||null).run()}><option value="">기본 정렬</option><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select><select aria-label="셀 배경색" value={editor.getAttributes('tableCell').background??editor.getAttributes('tableHeader').background??''} onChange={e=>editor.chain().focus().setCellAttribute('background',e.target.value||null).run()}><option value="">기본 배경</option><option value="#dbeafe">파랑</option><option value="#fef3c7">노랑</option><option value="#dcfce7">초록</option><option value="#fce7f3">분홍</option></select></div>
 {menu&&<div ref={panel} role="dialog" aria-label={'표 '+(menu.axis==='row'?'행':'열')+' 메뉴'} tabIndex={-1} className="editor-menu table-action-menu" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}} onMouseDown={e=>{if((e.target as HTMLElement).closest('button'))e.preventDefault()}}>
 <strong>{menu.index+1}{menu.axis==='row'?'행':'열'}</strong>
 <button type="button" role="switch" aria-checked={tableAxisIsHeader(c.node,menu.axis,menu.index)} onClick={toggleHeader}><span className="block-menu-label"><IconValue decorative value={'icon:'+(menu.axis==='row'?'TableRowsSplit':'TableColumnsSplit')+':default'}/>제목 {menu.axis==='row'?'행':'열'}</span><span aria-hidden="true" className="table-header-switch"/></button>
 <button type="button" aria-expanded={colorOpen} onClick={()=>setColorOpen(v=>!v)}><span className="block-menu-label"><IconValue decorative value="icon:Paintbrush:default"/>색</span><span aria-hidden="true">›</span></button>
 {colorOpen&&<div className="table-axis-colors" role="group" aria-label="행·열 색상">{(['color','background'] as const).map(field=><div key={field}><div className="editor-menu-caption">{field==='color'?'글자색':'배경색'}</div><div className="table-axis-color-grid">{blockColors.map(v=><button type="button" key={v.id} title={v.label} aria-label={(field==='color'?'글자색 ':'배경색 ')+v.label} onClick={()=>color(field,v.id==='default'?null:field==='color'?v.hex:v.background)}><span className="block-color-sample" style={field==='color'?{color:v.id==='default'?'inherit':v.hex}:{background:v.background}}>{field==='color'?'A':''}</span></button>)}</div></div>)}</div>}
 <hr/>
 <button type="button" onClick={()=>action(menu.axis==='row'?'addRowBefore':'addColumnBefore')}><span className="block-menu-label"><IconValue decorative value={'icon:'+(menu.axis==='row'?'ArrowUp':'ArrowLeft')+':default'}/>{menu.axis==='row'?'위에':'왼쪽에'} 삽입</span></button>
 <button type="button" onClick={()=>action(menu.axis==='row'?'addRowAfter':'addColumnAfter')}><span className="block-menu-label"><IconValue decorative value={'icon:'+(menu.axis==='row'?'ArrowDown':'ArrowRight')+':default'}/>{menu.axis==='row'?'아래에':'오른쪽에'} 삽입</span></button>
 <button type="button" onClick={duplicate}><span className="block-menu-label"><IconValue decorative value="icon:Copy:default"/>복제</span></button>
 <button type="button" onClick={()=>{select(menu.axis,menu.index);editor.commands.deleteSelection();setMenu(null)}}><span className="block-menu-label"><IconValue decorative value="icon:CircleX:default"/>내용 비우기</span></button>
 <button type="button" onClick={()=>action(menu.axis==='row'?'deleteRow':'deleteColumn')}><span className="block-menu-label"><IconValue decorative value="icon:Trash2:default"/>{menu.axis==='row'?'행':'열'} 삭제</span></button>
 {tableBand(c.node,menu.axis,menu.index).end-tableBand(c.node,menu.axis,menu.index).start>1&&<small>병합된 셀과 연결된 행·열은 함께 선택·이동·복제됩니다.</small>}
 </div>}
 </>;
}
