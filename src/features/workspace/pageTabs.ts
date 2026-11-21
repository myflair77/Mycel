import {Node,mergeAttributes,type Editor} from '@tiptap/core';
import {Fragment,type Node as PMNode} from '@tiptap/pm/model';
import {TextSelection,type EditorState} from '@tiptap/pm/state';
import {showEmojiPicker} from '../../components/emojiPicker';
export type TabChange={type:'add';id:string}|{type:'rename'|'icon';id:string;value:string}|{type:'move';id:string;delta:number}|{type:'remove';id:string};
export function changeTabs(state:EditorState,pos:number,action:TabChange){
 const node=state.doc.nodeAt(pos);if(node?.type.name!=='noteTabs')return null;const children:PMNode[]=[];node.forEach(n=>children.push(n));const index=children.findIndex(n=>n.attrs.id===action.id);
 if(action.type==='add'){children.push(state.schema.nodes.noteTab.create({id:action.id,label:'탭 '+(children.length+1)},state.schema.nodes.paragraph.create()))}
 else{if(index<0)return null;if(action.type==='remove'){if(children.length===1)return null;children.splice(index,1)}
 else if(action.type==='move'){const target=index+action.delta;if(target<0||target>=children.length)return null;const [moving]=children.splice(index,1);children.splice(target,0,moving)}
 else {const key=action.type==='rename'?'label':'icon',value=action.value.trim().slice(0,action.type==='rename'?80:32);children[index]=children[index].type.create({...children[index].attrs,[key]:key==='label'?(value||'탭'):value},children[index].content)}}
 return state.tr.replaceWith(pos,pos+node.nodeSize,node.copy(Fragment.fromArray(children)));
}
export function insertTabs(editor:Editor){
 const {$from}=editor.state.selection;if(!['paragraph','heading'].includes($from.parent.type.name))return false;const pos=$from.before(),first=editor.schema.nodes.paragraph.create({id:$from.parent.attrs.id},$from.parent.content);
 const tabs=Array.from({length:3},(_,i)=>editor.schema.nodes.noteTab.create({id:crypto.randomUUID(),label:'탭 '+(i+1)},i?editor.schema.nodes.paragraph.create():first));const node=editor.schema.nodes.noteTabs.create({id:crypto.randomUUID()},tabs);
 if(!$from.node($from.depth-1).canReplace($from.index($from.depth-1),$from.index($from.depth-1)+1,Fragment.from(node)))return false;
 const tr=editor.state.tr.replaceWith(pos,pos+$from.parent.nodeSize,node);editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc,pos+3)).scrollIntoView());return true;
}
export const NoteTab=Node.create({name:'noteTab',content:'block+',defining:true,isolating:true,
 addAttributes(){return {label:{default:'탭',parseHTML:e=>e.getAttribute('data-tab-label')||'탭',renderHTML:a=>({'data-tab-label':a.label})},icon:{default:'',parseHTML:e=>e.getAttribute('data-tab-icon')||'',renderHTML:a=>({'data-tab-icon':a.icon})}}},
 parseHTML:()=>[{tag:'div[data-note-tab]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-note-tab':''}),0]
});
export const NoteTabs=Node.create({name:'noteTabs',group:'block',content:'noteTab+',defining:true,isolating:true,
 parseHTML:()=>[{tag:'div[data-note-tabs]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-note-tabs':''}),0],
 addNodeView(){return ({node,editor,getPos})=>{
 let current=node,active=String(node.firstChild?.attrs.id??''),destroyed=false;const key=crypto.randomUUID();
 const dom=document.createElement('div');dom.className='editor-note-tabs';dom.dataset.noteTabs='';dom.dataset.tabsView=key;
 const toolbar=document.createElement('div');toolbar.className='note-tabs-toolbar';toolbar.contentEditable='false';const bar=document.createElement('div');bar.className='note-tabs-bar';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','노트 안의 탭');
 const menu=document.createElement('div');menu.className='note-tabs-menu';menu.hidden=true;menu.contentEditable='false';const style=document.createElement('style');const contentDOM=document.createElement('div');contentDOM.className='note-tab-panels';toolbar.append(bar);dom.append(toolbar,menu,style,contentDOM);
 const list=()=>{const a:PMNode[]=[];current.forEach(n=>a.push(n));return a};
 const act=(action:TabChange)=>{if(!editor.isEditable)return;const pos=getPos();if(typeof pos!=='number')return;const tr=changeTabs(editor.state,pos,action);if(tr){if(action.type==='add')active=action.id;editor.view.dispatch(tr);menu.hidden=true}};
 const activate=(id:string,focus=false)=>{active=id;menu.hidden=true;paint();if(!focus)(bar.querySelector('[aria-selected="true"]') as HTMLElement)?.focus();if(focus){const pos=getPos();if(typeof pos==='number'){let offset=pos+1;for(const child of list()){if(child.attrs.id===id){editor.commands.setTextSelection(TextSelection.near(editor.state.doc.resolve(offset+1)));editor.commands.focus();break}offset+=child.nodeSize}}}};
 function showMenu(anchor:HTMLElement){menu.replaceChildren();menu.hidden=false;const selected=list().find(t=>t.attrs.id===active);if(!selected)return;const selectedId=active;
 const option=(label:string,run:()=>void,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.onclick=run;menu.append(b)};
 option('이름 변경',()=>{menu.replaceChildren();const input=document.createElement('input');input.setAttribute('aria-label','탭 이름');input.value=selected.attrs.label;input.maxLength=80;const ok=document.createElement('button');ok.type='button';ok.textContent='저장';const commit=()=>act({type:'rename',id:selectedId,value:input.value});ok.onclick=commit;input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();commit()}};menu.append(input,ok);input.focus();input.select()},!editor.isEditable);
 option('아이콘 편집',()=>showEmojiPicker(anchor,emoji=>act({type:'icon',id:selectedId,value:emoji}),true),!editor.isEditable);
 option('링크 복사하기',()=>{const url=new URL(location.href);url.searchParams.set('noteTab',selectedId);navigator.clipboard.writeText(url.href).then(()=>{menu.replaceChildren();menu.textContent='링크를 복사했습니다.'}).catch(()=>{menu.replaceChildren();const field=document.createElement('input');field.value=url.href;field.readOnly=true;field.setAttribute('aria-label','탭 링크');menu.append(field);field.focus();field.select()})});
 const index=list().findIndex(t=>t.attrs.id===active);option('왼쪽으로 이동',()=>act({type:'move',id:selectedId,delta:-1}),!editor.isEditable||index===0);option('오른쪽으로 이동',()=>act({type:'move',id:selectedId,delta:1}),!editor.isEditable||index===current.childCount-1);
 option('삭제',()=>{if(confirm('이 탭과 내부 내용을 삭제할까요? 실행 취소와 노트 수정 이력으로 복원할 수 있습니다.'))act({type:'remove',id:selectedId})},!editor.isEditable||current.childCount===1);
 }
 function paint(){if(destroyed)return;const tabs=list();if(!tabs.some(t=>t.attrs.id===active))active=String(tabs[0]?.attrs.id??'');const index=tabs.findIndex(t=>t.attrs.id===active);dom.dataset.blockId=current.attrs.id;
 style.textContent='[data-tabs-view="'+key+'"] > .note-tab-panels > [data-note-tab]:not(:nth-child('+(index+1)+')){display:none}';bar.replaceChildren();
 tabs.forEach((tab,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(tab.attrs.icon?tab.attrs.icon+' ':'')+tab.attrs.label;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;b.onmousedown=e=>e.preventDefault();b.onclick=()=>activate(tab.attrs.id);b.oncontextmenu=e=>{e.preventDefault();active=tab.attrs.id;paint();showMenu(b)};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[next].attrs.id);(bar.children[next] as HTMLElement)?.focus()}else if(e.key==='ArrowDown'){e.preventDefault();activate(tab.attrs.id,true)}};bar.append(b)});
 if(editor.isEditable){const add=document.createElement('button');add.type='button';add.textContent='＋';add.setAttribute('aria-label','탭 추가');add.onclick=()=>act({type:'add',id:crypto.randomUUID()});bar.append(add)}
 const more=document.createElement('button');more.type='button';more.textContent='···';more.setAttribute('aria-label','선택한 탭 메뉴');more.onclick=()=>{if(menu.hidden)showMenu(more);else menu.hidden=true};bar.append(more);
 }
 const linked=new URLSearchParams(location.search).get('noteTab');if(linked&&list().some(t=>t.attrs.id===linked))active=linked;paint();
 const outside=(e:PointerEvent)=>{if(!dom.contains(e.target as globalThis.Node))menu.hidden=true};document.addEventListener('pointerdown',outside);dom.addEventListener('keydown',e=>{if(e.key==='Escape')menu.hidden=true});
 return {dom,contentDOM,update(next){if(next.type!==current.type)return false;current=next;paint();return true},stopEvent:e=>!contentDOM.contains(e.target as globalThis.Node),ignoreMutation:m=>!contentDOM.contains(m.target),destroy(){destroyed=true;document.removeEventListener('pointerdown',outside)}};
 };}
});
