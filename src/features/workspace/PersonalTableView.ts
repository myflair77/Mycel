import {Extension} from '@tiptap/core';
import {Plugin,TextSelection} from '@tiptap/pm/state';
import {TableView} from '@tiptap/extension-table';
import type {Node as PMNode} from '@tiptap/pm/model';
import type {EditorView,ViewMutationRecord} from '@tiptap/pm/view';
import {emptyTableView,normalizeTableView,personalTableInfo,personalTableRows,tableCellText,type TableFilter,type TableViewPreferences} from './tablePersonalView';

/** A separate, non-editable projection keeps personal sorting out of shared document transactions. */
export class PersonalTableView extends TableView{
 private view:EditorView;
 private controls=document.createElement('div');
 private summary=document.createElement('div');
 private projection=document.createElement('div');
 private preferences:TableViewPreferences=emptyTableView();
 private storageKey='';
 private frame=0;
 private observer:ResizeObserver;
 private menu:HTMLDivElement|null=null;
 private dead=false;
 private menuColumn=-1;
 constructor(node:PMNode,minWidth:number,view?:EditorView,attrs:Record<string,any>={}){
  super(node,minWidth,view,attrs);this.view=view!;
  this.dom.classList.add('personal-table-wrapper');this.table.classList.add('personal-table-source');
  this.controls.className='personal-table-header-actions';this.summary.className='personal-table-summary';this.projection.className='personal-table-projection';
  for(const element of [this.controls,this.summary,this.projection])element.contentEditable='false';
  this.dom.prepend(this.summary);this.dom.append(this.projection,this.controls);
  this.observer=new ResizeObserver(()=>this.position());this.observer.observe(this.dom);
  document.addEventListener('pointerdown',this.outside);document.addEventListener('keydown',this.keydown);window.addEventListener('resize',this.positionMenu);window.visualViewport?.addEventListener('resize',this.positionMenu);window.visualViewport?.addEventListener('scroll',this.positionMenu);document.addEventListener('scroll',this.positionMenu,true);window.addEventListener('storage',this.storage);
  this.dom.addEventListener('mycel-reveal-mention',this.reveal);this.dom.addEventListener('mycel-reveal-block',this.reveal);
  this.dom.addEventListener('focusin',this.focusSource);this.schedule();
 }
 update(node:PMNode){if(!super.update(node))return false;this.closeMenu();this.schedule();return true}
 private schedule(){cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{if(!this.dead)this.render()})}
 private storage=(event:StorageEvent)=>{if(event.key===this.storageKey){this.storageKey='';this.schedule()}};
 private load(){const note=this.view.dom.closest<HTMLElement>('[data-note-document]'),user=note?.dataset.noteUser,id=note?.dataset.noteDocument;
  const key=user&&id&&this.node.attrs.id?`mycel-table-view:v1:${user}:${id}:${this.node.attrs.id}`:'';
  if(key!==this.storageKey){this.storageKey=key;try{this.preferences=key?normalizeTableView(JSON.parse(localStorage.getItem(key)||'null'),this.node):emptyTableView()}catch{this.preferences=emptyTableView()}}
  this.preferences=normalizeTableView(this.preferences,this.node);
 }
 private active(){return !!this.preferences.sort||Object.keys(this.preferences.filters).length>0}
 private save(){this.preferences=normalizeTableView(this.preferences,this.node);try{if(this.storageKey)localStorage.setItem(this.storageKey,JSON.stringify(this.preferences))}catch{}this.render();const tr=this.view.state.tr.setMeta('personalTableView',true).setMeta('addToHistory',false);if(this.table.hidden){let position=-1;tr.doc.descendants((node,pos)=>{if(node===this.node){position=pos;return false}});if(position>=0)tr.setSelection(TextSelection.near(tr.doc.resolve(position+this.node.nodeSize),1))}this.view.dispatch(tr)}
 private reset=()=>{this.closeMenu();this.preferences=emptyTableView();this.save()};
 private reveal=()=>{if(this.table.hidden)this.reset()};
 private focusSource=(event:FocusEvent)=>{if(this.table.contains(event.target as globalThis.Node))this.reveal()};
 private closeMenu=()=>{this.menu?.remove();this.menu=null};
 private outside=(event:PointerEvent)=>{if(!this.menu?.contains(event.target as globalThis.Node)&&!this.controls.contains(event.target as globalThis.Node))this.closeMenu()};
 private keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&this.menu){event.preventDefault();this.closeMenu();this.controls.querySelector('button')?.focus()}};
 private button(label:string,action:()=>void){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=event=>{event.stopPropagation();action()};return button}
 private render(){
  this.load();const info=personalTableInfo(this.node),active=info.supported&&this.active();this.dom.classList.toggle('has-table-view-controls',info.hasHeader);this.dom.classList.toggle('personal-table-active',active);
  this.table.hidden=active;this.summary.replaceChildren();this.summary.hidden=!active;this.projection.replaceChildren();this.projection.hidden=!active;this.controls.replaceChildren();
  if(active){
   const indices=personalTableRows(this.node,this.preferences),status=document.createElement('span');status.textContent=`내 보기 · ${indices.length}/${Math.max(0,this.node.childCount-1)}행 · 읽기 전용`;this.summary.append(status,this.button('원본 보기 · 편집',this.reset));
   const clone=this.table.cloneNode(false) as HTMLTableElement;clone.hidden=false;clone.removeAttribute('data-block-id');clone.removeAttribute('id');clone.classList.remove('personal-table-source');clone.classList.add('personal-table-result');clone.append(this.colgroup.cloneNode(true));const body=document.createElement('tbody');clone.append(body);
   for(const index of [0,...indices]){const row=this.contentDOM.rows[index];if(row)body.append(row.cloneNode(true))}
   for(const element of clone.querySelectorAll<HTMLElement>('*')){element.removeAttribute('id');element.removeAttribute('data-block-id');element.removeAttribute('data-mention-id');element.removeAttribute('contenteditable');element.classList.remove('selectedCell','active-table-cell','page-comment-mark','page-block-comment-mark');if(element.matches('input,button,select,textarea')){(element as HTMLInputElement).disabled=true;element.tabIndex=-1}if(element.matches('a,[tabindex],[role=button]'))element.tabIndex=-1}
   clone.onclick=event=>{if((event.target as HTMLElement).closest('a,button,input,[role=button]'))event.preventDefault()};this.projection.append(clone);
   if(!indices.length){const empty=document.createElement('p');empty.className='personal-table-empty';empty.textContent='조건에 맞는 행이 없습니다.';this.projection.append(empty)}
  }
  if(info.hasHeader)for(const header of info.headers){const sorted=this.preferences.sort?.column===header.id,filtered=!!this.preferences.filters[header.id];const button=this.button((sorted?(this.preferences.sort?.direction==='asc'?'↑':'↓'):'')+(filtered?'≡':'')+'▾',()=>this.open(header.id));button.dataset.column=String(header.index);button.setAttribute('aria-label',header.label+' 정렬·필터');button.title=info.merged?'병합된 셀을 해제하면 정렬·필터를 사용할 수 있습니다.':header.label+' 정렬·필터';button.disabled=!info.supported;button.classList.toggle('active',sorted||filtered);this.controls.append(button)}
  this.position();
 }
 private position(){const table=(this.table.hidden?this.projection.querySelector('table'):this.table),row=table?.rows[0];if(!row)return;const wrapper=this.dom.getBoundingClientRect(),scale=wrapper.width/(this.dom.offsetWidth||wrapper.width||1);for(const button of this.controls.querySelectorAll<HTMLButtonElement>('button')){const cell=row.cells[Number(button.dataset.column)];if(!cell)continue;const rect=cell.getBoundingClientRect();button.style.left=((rect.right-wrapper.left)/scale+this.dom.scrollLeft-29)+'px';button.style.top=((rect.top-wrapper.top)/scale+this.dom.scrollTop+4)+'px'}this.positionMenu()}
 private open(id:string){
  this.closeMenu();const info=personalTableInfo(this.node),header=info.headers.find(h=>h.id===id);if(!header||!info.supported)return;
  const menu=document.createElement('div');this.menu=menu;menu.className='editor-menu personal-table-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label',header.label+' 정렬·필터');menu.contentEditable='false';
  const theme=getComputedStyle(this.view.dom);for(const variable of ['--paper','--ink','--muted','--line','--soft','--link'])menu.style.setProperty(variable,theme.getPropertyValue(variable));
  const title=document.createElement('strong');title.textContent=header.label;menu.append(title);
  const hint=document.createElement('small');hint.textContent='본인 기기에만 적용됩니다.';menu.append(hint);
  for(const [direction,label] of [['asc','오름차순 정렬'],['desc','내림차순 정렬']] as const){const button=this.button(label,()=>{this.preferences.sort={column:id,direction};this.save();this.closeMenu()});button.setAttribute('aria-pressed',String(this.preferences.sort?.column===id&&this.preferences.sort.direction===direction));menu.append(button)}
  menu.append(this.button('정렬 해제',()=>{delete this.preferences.sort;this.save();this.closeMenu()}),document.createElement('hr'));
  const update=(change:Partial<TableFilter>)=>{this.preferences.filters[id]={...this.preferences.filters[id],...change};this.save()};
  const contains=document.createElement('input');contains.type='search';contains.placeholder='포함할 문구';contains.setAttribute('aria-label','포함할 문구');contains.value=this.preferences.filters[id]?.contains||'';contains.oninput=()=>update({contains:contains.value});menu.append(contains);
  const nonempty=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!this.preferences.filters[id]?.excludeEmpty;check.onchange=()=>update({excludeEmpty:check.checked});nonempty.append(check,document.createTextNode('빈 값 제외'));menu.append(nonempty);
  const values=[...new Set(Array.from({length:Math.max(0,this.node.childCount-1)},(_,i)=>tableCellText(this.node.child(i+1).child(header.index))))].sort(new Intl.Collator('ko',{numeric:true}).compare);
  const valuesRoot=document.createElement('div');valuesRoot.className='personal-table-values';valuesRoot.setAttribute('role','group');valuesRoot.setAttribute('aria-label','표시할 값');
  const refreshChecks=()=>{for(const input of valuesRoot.querySelectorAll<HTMLInputElement>('input'))input.checked=!this.preferences.filters[id]?.values||this.preferences.filters[id].values!.includes(input.value)};
  const bulk=document.createElement('div');bulk.className='personal-table-values-actions';bulk.append(this.button('전체 선택',()=>{update({values:undefined});refreshChecks()}),this.button('전체 해제',()=>{update({values:[]});refreshChecks()}));menu.append(bulk);
  for(const value of values){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=value;input.checked=!this.preferences.filters[id]?.values||this.preferences.filters[id].values!.includes(value);input.onchange=()=>{const selected=new Set(this.preferences.filters[id]?.values??values);if(input.checked)selected.add(value);else selected.delete(value);update({values:[...selected]})};label.append(input,document.createTextNode(value||'(빈 값)'));valuesRoot.append(label)}
  menu.append(valuesRoot,document.createElement('hr'),this.button('이 열 필터 해제',()=>{delete this.preferences.filters[id];this.save();this.closeMenu()}),this.button('정렬·필터 모두 해제',this.reset));
  document.body.append(menu);this.menuColumn=header.index;this.positionMenu();menu.querySelector('button')?.focus({preventScroll:true});
 }
 private positionMenu=()=>{const menu=this.menu,button=this.controls.querySelector<HTMLButtonElement>('button[data-column="'+this.menuColumn+'"]');if(!menu||!button)return;const viewport=window.visualViewport,x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0,width=viewport?.width??innerWidth,height=viewport?.height??innerHeight;menu.style.maxHeight=Math.max(80,height-16)+'px';menu.style.maxWidth=Math.max(120,width-16)+'px';const anchor=button.getBoundingClientRect(),rect=menu.getBoundingClientRect();menu.style.left=Math.max(x+8,Math.min(anchor.right-rect.width,x+width-rect.width-8))+'px';menu.style.top=Math.max(y+8,Math.min(anchor.bottom+6,y+height-rect.height-8))+'px'};
 stopEvent(event:Event){return this.controls.contains(event.target as globalThis.Node)||this.summary.contains(event.target as globalThis.Node)||this.projection.contains(event.target as globalThis.Node)}
 ignoreMutation(mutation:ViewMutationRecord){if(this.controls.contains(mutation.target)||this.summary.contains(mutation.target)||this.projection.contains(mutation.target))return true;return super.ignoreMutation(mutation)}
 destroy(){this.dead=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.closeMenu();document.removeEventListener('pointerdown',this.outside);document.removeEventListener('keydown',this.keydown);window.removeEventListener('resize',this.positionMenu);window.visualViewport?.removeEventListener('resize',this.positionMenu);window.visualViewport?.removeEventListener('scroll',this.positionMenu);document.removeEventListener('scroll',this.positionMenu,true);window.removeEventListener('storage',this.storage);this.dom.removeEventListener('mycel-reveal-mention',this.reveal);this.dom.removeEventListener('mycel-reveal-block',this.reveal);this.dom.removeEventListener('focusin',this.focusSource)}
}

// Keyboard or notification navigation into a projected table returns to its editable source.
export const PersonalTableSelection=Extension.create({name:'personalTableSelection',addProseMirrorPlugins(){
 const reveal=(view:EditorView)=>{const {$from}=view.state.selection;for(let depth=$from.depth;depth>0;depth--)if($from.node(depth).type.name==='table'){const dom=view.nodeDOM($from.before(depth));if(dom instanceof HTMLElement&&dom.querySelector('.personal-table-source[hidden]'))dom.dispatchEvent(new CustomEvent('mycel-reveal-block',{bubbles:true}));break}};
 return [new Plugin({props:{handleKeyDown:view=>{reveal(view);return false},handleDOMEvents:{beforeinput:view=>{reveal(view);return false}}},view:()=>({update:(view,previous)=>{if(!previous.selection.eq(view.state.selection))reveal(view)}})})]
}});
