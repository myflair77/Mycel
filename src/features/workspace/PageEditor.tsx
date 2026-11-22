import {requestedMentionFocus,revealMention} from './mentionFocus';
import {requestedBlockFocus,finishBlockFocus} from './blockFocus';
import {blockLinkKey} from './pageExtensions';
import {BlockEditInfo,BlockMoveDialog} from './BlockActions';
import {saveBeforeNavigation} from './viewHistory';
import {equalizeColumns} from './columnWidths';
import {PageSelectionTools} from './PageSelectionTools';
import {clipboardFiles} from './pageClipboard';
import type {Editor} from '@tiptap/core';
import {IconValue} from '../../components/SymbolView';
import {blockColors,listFormats,changeListFormat} from './pageBlockAppearance';
import {symbolContent} from './pageInlineIcon';
import {iconElement} from '../../components/iconValue';
import {blockMenuPosition,blockSubmenuPosition} from './blockMenuPosition';
import {conversionTypes,convertBlock,blockType,type Conversion} from './pageConversion';
import {SYNC_PREFIX} from './pageSyncedBlock';
import {uploadNoteFile} from './noteFiles';
import {fileName,fileMime,validateFile} from '../messages/attachments';
import {showEmojiPicker} from '../../components/emojiPicker';
import {insertTabs} from './pageTabs';
import {savePageForNavigation} from './pageNavigation';
import {insertToggle,unwrapToggle} from './pageToggle';
import {pageHandlePosition} from './pageHandlePosition';
import {PageCellTools} from './PageCellTools';
import {PageTableTools,Grip} from './PageTableTools';
import {useEditor,EditorContent} from '@tiptap/react';
import {BubbleMenu} from '@tiptap/react/menus';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {TextSelection} from '@tiptap/pm/state';
import type {JSONContent} from '@tiptap/core';
import {extensions,blockPositions,selectionQuote,commentKey,blockMenuKey} from './pageExtensions';
import {blocksToDoc,docToBlocks,uniqueIds,legacyNode,type SavedBlock} from './pageDocument';
import {arrangeBlocks,locateQuote} from './pageInteractions';
import {rpc} from './Workspace';
type Props={childrenNotes?:{id:string;title:string;icon?:string;trashed?:boolean}[];onPrepareChild?:()=>Promise<number|false>;onOpenNote?:(id:string)=>void;onBeforeLeave?:(save:()=>Promise<boolean>)=>void;id:string;userId:string;blocks:SavedBlock[];version:number;edit:boolean;canComment:boolean;comments:any[];onSaved:(version:number)=>Promise<void>;onQuote:(block:SavedBlock,q:any)=>void;onComment:(id:string)=>void;onStatus:(dirty:boolean)=>void};
export function PageEditor(p:Props){
 const [movingBlock,setMovingBlock]=useState('');
 const blockDragging=useRef(false),uploading=useRef(false),childCommitting=useRef(false);
 const [status,setStatus]=useState('저장됨'),[failed,setFailed]=useState(''),[tick,setTick]=useState(0),[menu,setMenu]=useState<{x:number;y:number;id:string;add?:boolean;submenu?:'convert'|'color'|'list'}|null>(null),[hover,setHover]=useState<{x:number;y:number;right:number;id:string}|null>(null),[slash,setSlash]=useState<{from:number;to:number;q:string;x:number;y:number}|null>(null),[choice,setChoice]=useState(0),[syncSelection,setSyncSelection]=useState<Editor|null>(null),[draftAvailable,setDraftAvailable]=useState(false);
 const menuElement=useRef<HTMLDivElement>(null),submenuElement=useRef<HTMLDivElement>(null);
 const [submenuPosition,setSubmenuPosition]=useState<ReturnType<typeof blockSubmenuPosition>|null>(null);
 const [menuPosition,setMenuPosition]=useState<ReturnType<typeof blockMenuPosition>|null>(null);
 const wrapper=useRef<HTMLDivElement>(null),latest=useRef(p),base=useRef(p.version),revision=useRef(0),savedRevision=useRef(0),saving=useRef(false),inFlight=useRef<Promise<boolean>|null>(null),pending=useRef<{doc:JSONContent;mutation:string;version:number;revision:number}|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),blocked=useRef(false);
 latest.current=p;const key='mycel-rich-page:'+p.userId+':'+p.id;
 const editor=useEditor({extensions:extensions(),content:uniqueIds(blocksToDoc(p.blocks)),editable:p.edit,
 editorProps:{attributes:{'aria-label':'페이지 본문','role':'textbox','aria-multiline':'true'},handleKeyDown:(_view,event)=>{if(event.isComposing)return false;return keyHandler.current(event)}},
 onUpdate:({editor,transaction})=>{if(!transaction.docChanged||!latest.current.edit)return;revision.current++;setStatus('저장 대기');latest.current.onStatus(true);try{localStorage.setItem(key,JSON.stringify({doc:editor.getJSON(),version:base.current}))}catch{};schedule();inspect(editor)},
 onSelectionUpdate:({editor})=>inspect(editor)
 },[p.id]);
 const slashQuery=useRef('');
 const keyHandler=useRef<(e:KeyboardEvent)=>boolean>(()=>false);
 const commands=[['text','텍스트'],['h1','제목 1'],['h2','제목 2'],['h3','제목 3'],['bullet','글머리 목록'],['number','번호 목록'],['check','체크리스트'],['quote','인용'],['callout','콜아웃'],['toggle','토글 목록'],['toggle1','토글 제목 1'],['toggle2','토글 제목 2'],['toggle3','토글 제목 3'],['convert-toggle','토글 목록 · 전환'],['convert-toggle1','토글 제목 1 · 전환'],['convert-toggle2','토글 제목 2 · 전환'],['convert-toggle3','토글 제목 3 · 전환'],['sync','동기화 블록'],['image','이미지'],['file','파일'],['note','노트'],['tabs','탭'],['emoji','아이콘'],['emoji-alias','이모지'],['code','코드'],['divider','구분선'],['table','표'],['columns','2단 배치']] as const;
 const filtered=commands.filter(c=>(c[0]+' '+c[1]).toLowerCase().includes(slash?.q.toLowerCase()??''));
 function inspect(e:any){setTick(t=>t+1);const {selection}=e.state;if(!selection.empty){setSlash(null);return}const $p=selection.$from;if(!$p.parent.isTextblock){setSlash(null);return}const before=$p.parent.textBetween(0,$p.parentOffset,'\n','\n'),m=before.match(/^\/([^\n/]*)$/)??before.match(/\/(아이콘|이모지|emoji(?:-alias)?)$/);if(m){const c=e.view.coordsAtPos(selection.from);setSlash({from:$p.start()+(m.index??0),to:selection.from,q:m[1],x:Math.min(c.left,window.innerWidth-280),y:Math.min(c.bottom+8,window.innerHeight-360)});const query=$p.start()+':'+m[1];if(slashQuery.current!==query){slashQuery.current=query;setChoice(0)}}else {slashQuery.current='';setSlash(null)}}
 function schedule(){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),900)}
 function flush():Promise<boolean>{if(inFlight.current)return inFlight.current;const promise=performFlush();inFlight.current=promise;void promise.finally(()=>{if(inFlight.current===promise)inFlight.current=null});return promise}
 async function performFlush():Promise<boolean>{
 if(!editor||!latest.current.edit||blocked.current)return false;if(saving.current)return false;if(revision.current===savedRevision.current&&!pending.current)return true;
 saving.current=true;setStatus('저장 중');const sent=pending.current??{doc:editor.getJSON(),mutation:crypto.randomUUID(),version:base.current,revision:revision.current};pending.current=sent;
 try{const v=await rpc('page_document_save',{p_id:p.id,p_version:sent.version,p_mutation:sent.mutation,p_blocks:docToBlocks(sent.doc)});base.current=Number(v);savedRevision.current=sent.revision;pending.current=null;setFailed('');setStatus(revision.current===sent.revision?'저장됨':'저장 대기');if(revision.current===sent.revision){localStorage.removeItem(key);setDraftAvailable(false);latest.current.onStatus(false)}await latest.current.onSaved(Number(v));return true}
 catch(e){blocked.current=true;setFailed((e as Error).message);setStatus('저장 실패 · 입력은 이 기기에 보관됨');return false}
 finally{saving.current=false;if(!blocked.current&&revision.current!==savedRevision.current)schedule()}
 }
 useEffect(()=>{p.onBeforeLeave?.(async()=>{if(uploading.current||childCommitting.current){setFailed('노트와 파일 저장이 끝난 뒤 이동해 주세요.');return false}if(timer.current)clearTimeout(timer.current);return savePageForNavigation({dirty:()=>revision.current!==savedRevision.current||!!pending.current,canEdit:()=>latest.current.edit,retry:()=>{blocked.current=false},preserve:()=>{if(editor)localStorage.setItem(key,JSON.stringify({doc:editor.getJSON(),version:base.current}));setDraftAvailable(true)},save:flush})})},[editor,p.onBeforeLeave]);
 useEffect(()=>{if(!editor)return;editor.setEditable(p.edit,false);if(p.edit&&!pending.current){blocked.current=false;if(revision.current!==savedRevision.current)schedule()}if(!p.edit){blocked.current=true;if(revision.current!==savedRevision.current)setFailed('편집 권한이 변경되었습니다. 기기 임시 입력은 유지됩니다.')}},[p.edit,editor]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[key]);
 useEffect(()=>{if(!editor)return;try{const draft=JSON.parse(localStorage.getItem(key)??'null');setDraftAvailable(!!draft?.doc&&!editor.schema.nodeFromJSON(draft.doc).eq(editor.state.doc))}catch{setDraftAvailable(false)}},[key,editor,tick,p.version]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(revision.current!==savedRevision.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[]);
 useEffect(()=>{if(!editor||saving.current||revision.current!==savedRevision.current||p.version<=base.current)return;base.current=p.version;const next=uniqueIds(blocksToDoc(p.blocks));if(JSON.stringify(docToBlocks(editor.getJSON()).map(b=>[b.id,b.kind,b.content]))!==JSON.stringify(docToBlocks(next).map(b=>[b.id,b.kind,b.content]))){const selection=editor.state.selection.toJSON();const scroll=editor.view.dom.closest('.conversation-resource-library');const scrollTop=scroll?.scrollTop;editor.commands.setContent(next,{emitUpdate:false});try{editor.view.dispatch(editor.state.tr.setSelection(TextSelection.fromJSON(editor.state.doc,selection)))}catch{editor.commands.setTextSelection(Math.min(selection.anchor??1,editor.state.doc.content.size))}if(scroll&&scrollTop!==undefined)scroll.scrollTop=scrollTop;setTick(t=>t+1)}},[p.version,editor]);
 useEffect(()=>{if(!editor||revision.current!==savedRevision.current)return;const spans:any[]=[];for(const c of p.comments){if(c.parent_id||!c.block_id||c.deleted||c.resolved)continue;const b=p.blocks.find(b=>b.id===c.block_id),pos=blockPositions(editor).find(b=>b.id===c.block_id);if(!b||!pos)continue;if(!c.anchor){spans.push({id:c.id,block:true,from:pos.pos,to:pos.pos+pos.node.nodeSize});continue}if(!pos.node.isTextblock)continue;const range=locateQuote(b.content.text??'',c.anchor,b.version);if(range)spans.push({id:c.id,from:pos.pos+1+range[0],to:pos.pos+1+range[1]})}editor.view.dispatch(editor.state.tr.setMeta(commentKey,spans).setMeta('addToHistory',false))},[p.comments,p.blocks,editor]);
 useEffect(()=>{if(!editor)return;const go=(ev:Event)=>{const c=(ev as CustomEvent).detail;if(c.page!==p.id)return;const b=latest.current.blocks.find(b=>b.id===c.block_id),pos=blockPositions(editor).find(b=>b.id===c.block_id);if(!b||!pos)return;const range=c.anchor?locateQuote(b.content.text??'',c.anchor,b.version):null;editor.commands.setTextSelection(range?{from:pos.pos+1+range[0],to:pos.pos+1+range[1]}:pos.pos+1);editor.commands.focus();editor.commands.scrollIntoView()};window.addEventListener('mycel-page-quote',go);return()=>window.removeEventListener('mycel-page-quote',go)},[editor]);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!(e.target as HTMLElement).closest('.editor-menu,.editor-handles'))setMenu(null)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
 useEffect(()=>{if(!editor)return;const b=menu&&!menu.add?blockPositions(editor).find(b=>b.id===menu.id):null;editor.view.dispatch(editor.state.tr.setMeta(blockMenuKey,b?{from:b.pos,to:b.pos+b.node.nodeSize}:null).setMeta('addToHistory',false))},[editor,menu?.id,menu?.add]);
 useLayoutEffect(()=>{
 if(!menu||!editor||!menuElement.current){setMenuPosition(null);return}
 const popup=menuElement.current;let frame=0;
 const refresh=()=>{
  const b=blockPositions(editor).find(b=>b.id===menu.id),node=b&&editor.view.nodeDOM(b.pos);if(!(node instanceof HTMLElement))return;
  const rect=node.getBoundingClientRect(),view=window.visualViewport;
  const viewport={left:view?.offsetLeft??0,top:view?.offsetTop??0,right:(view?.offsetLeft??0)+(view?.width??window.innerWidth),bottom:(view?.offsetTop??0)+(view?.height??window.innerHeight)};
  const handle=wrapper.current?.querySelector<HTMLElement>('.editor-handles');
  const narrow=!!menu.submenu&&viewport.right-viewport.left<560;
  const next=blockMenuPosition(rect,handle?.getBoundingClientRect().top??rect.top,viewport,{width:narrow?Math.floor((viewport.right-viewport.left-24)*.44):260,height:Math.min(350,popup.scrollHeight+2)});if(narrow)next.left=viewport.left+8;
  setMenuPosition(old=>old&&Object.keys(next).every(k=>old[k as keyof typeof old]===next[k as keyof typeof next])?old:next);
 };
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh)};
 refresh();const observer=new ResizeObserver(schedule);observer.observe(popup);observer.observe(editor.view.dom);
 document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)};
 },[editor,menu?.id,menu?.add,menu?.submenu]);
 useLayoutEffect(()=>{
  if(!menu?.submenu||!menuPosition||!menuElement.current||!submenuElement.current){setSubmenuPosition(null);return}
  const parent=menuElement.current,sub=submenuElement.current;let frame=0;
  const refresh=()=>{const v=window.visualViewport,viewport={left:v?.offsetLeft??0,top:v?.offsetTop??0,right:(v?.offsetLeft??0)+(v?.width??innerWidth),bottom:(v?.offsetTop??0)+(v?.height??innerHeight)},r=parent.getBoundingClientRect(),anchor=parent.querySelector<HTMLElement>('[data-submenu="'+menu.submenu+'"]');
   const width=viewport.right-viewport.left<560?Math.max(100,viewport.right-r.right-14):260;
   const next=blockSubmenuPosition(r,anchor?.getBoundingClientRect().top??r.top,viewport,{width,height:Math.min(600,sub.scrollHeight+2)});setSubmenuPosition(old=>old&&Object.keys(next).every(k=>old[k as keyof typeof old]===next[k as keyof typeof next])?old:next);
  };const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh)};refresh();const observer=new ResizeObserver(schedule);observer.observe(parent);observer.observe(sub);document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)};
 },[menu?.submenu,menuPosition]);
 const menuIcons:Record<string,string>={callout:'SquareAsterisk',link:'Link',move:'CornerUpRight',text:'Type',h1:'Heading1',h2:'Heading2',h3:'Heading3',bullet:'List',number:'ListOrdered',check:'ListTodo',quote:'Quote',toggle:'ListCollapse',toggle1:'Heading1',toggle2:'Heading2',toggle3:'Heading3',sync:'RefreshCw',image:'Image',file:'Paperclip',note:'FileText',tabs:'PanelsTopLeft',emoji:'Shapes','emoji-alias':'Smile',code:'Code',divider:'Minus',columns:'Columns2',convert:'Replace',color:'PaintRoller',list:'ListOrdered',duplicate:'Copy',comment:'MessageSquare',delete:'Trash2',flatten:'PanelTop',equalize:'Columns2'};
 function menuLabel(type:string,label:string){return <span className="block-menu-label"><IconValue decorative value={'icon:'+(menuIcons[type.replace('convert-','')]??'Square')+':default'}/><span>{label}</span></span>}
 function submenu(kind:'convert'|'color'|'list'){if(menu)setMenu({...menu,submenu:menu.submenu===kind?undefined:kind})}
 function openSelectionMenu(target:Editor){
  if(!editor)return;const b=target===editor?blockPositions(editor).find(b=>target.state.selection.from>b.pos&&target.state.selection.from<b.pos+b.node.nodeSize):blockPositions(editor).find(b=>{const el=editor.view.nodeDOM(b.pos);return el instanceof HTMLElement&&el.contains(target.view.dom)});
  if(!b)return;const el=editor.view.nodeDOM(b.pos) as HTMLElement,r=el.getBoundingClientRect();setMenu({id:b.id,x:r.left,y:r.top});
 }
 useEffect(()=>{const root=wrapper.current;if(!root)return;const select=(event:Event)=>setSyncSelection((event as CustomEvent<Editor>).detail);root.addEventListener('mycel-sync-selection',select);return()=>root.removeEventListener('mycel-sync-selection',select)},[editor]);
 useEffect(()=>{const root=wrapper.current;if(!root||!editor)return;const action=(event:Event)=>{const detail=(event as CustomEvent<{element:HTMLElement;action:string}>).detail;const b=blockPositions(editor).find(b=>{const el=editor.view.nodeDOM(b.pos);return el instanceof HTMLElement&&el.contains(detail.element)});if(!b)return;if(detail.action==='comment'){if(latest.current.canComment)void saveBeforeNavigation().then(saved=>{if(saved)latest.current.onComment(b.id)})}else if(latest.current.edit){const r=detail.element.getBoundingClientRect();setMenu({id:b.id,x:r.right,y:r.top})}};root.addEventListener('mycel-file-action',action);return()=>root.removeEventListener('mycel-file-action',action)},[editor]);
 function blockColor(field:'blockText'|'blockBackground',value:string){if(!editor||!menu)return;const b=blockPositions(editor).find(b=>b.id===menu.id);if(!b)return;editor.view.dispatch(editor.state.tr.setNodeMarkup(b.pos,undefined,{...b.node.attrs,[field]:value==='default'?null:value}));try{localStorage.setItem('mycel-block-recent-color',JSON.stringify({field,value}))}catch{}setMenu(null);editor.commands.focus()}
 function listFormat(value:string){if(!editor||!menu)return;const b=blockPositions(editor).find(b=>b.id===menu.id);if(b&&changeListFormat(editor.state,b.pos,value,tr=>editor.view.dispatch(tr))){setMenu(null);editor.commands.focus()}}
 function isNumbered(){if(!editor||!menu)return false;const b=blockPositions(editor).find(b=>b.id===menu.id);return !!b&&b.node.type.name==='listItem'&&editor.state.doc.resolve(b.pos).parent.type.name==='orderedList'}
 function closeSubmenu(){if(!menu)return;const name=menu.submenu;setMenu({...menu,submenu:undefined});requestAnimationFrame(()=>menuElement.current?.querySelector<HTMLButtonElement>('[data-submenu="'+name+'"]')?.focus())}
 function focusBlock(id:string){const b=editor&&blockPositions(editor).find(b=>b.id===id);if(b)editor!.commands.setTextSelection(Math.min(b.pos+(['listItem','taskItem'].includes(b.node.type.name)?2:1),editor!.state.doc.content.size));return b}
 function replace(doc:JSONContent){if(!editor)return;const parsed=editor.schema.nodeFromJSON(uniqueIds(doc));editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,parsed.content).scrollIntoView());setMenu(null)}
 function choose(cmd:string){if(!editor)return;if(slash)editor.chain().focus().deleteRange({from:slash.from,to:slash.to}).run();else if(menu){const b=focusBlock(menu.id);if(menu.add&&b){editor.chain().insertContentAt(b.pos+b.node.nodeSize,(['listItem','taskItem'].includes(b.node.type.name)?{type:b.node.type.name,attrs:{id:crypto.randomUUID(),checked:false},content:[{type:'paragraph'}]}:{type:'paragraph',attrs:{id:crypto.randomUUID()}})).setTextSelection(b.pos+b.node.nodeSize+(['listItem','taskItem'].includes(b.node.type.name)?2:1)).run()}}
 const normalized=cmd.replace('convert-','');const chain=editor.chain().focus();if(/^toggle[123]?$/.test(normalized)){insertToggle(editor,Number(normalized.slice(6))||0);editor.commands.focus();setSlash(null);setMenu(null);return}if(['text','h1','h2','h3'].includes(cmd)&&unwrapToggle(editor,cmd==='text'?0:Number(cmd[1]))){setSlash(null);setMenu(null);return}switch(cmd){case 'emoji':case 'emoji-alias':{const selection={from:editor.state.selection.from,to:editor.state.selection.to};showEmojiPicker(wrapper.current!,emoji=>{if(!editor.isDestroyed&&editor.isEditable)editor.chain().focus().setTextSelection(selection).insertContent(symbolContent(emoji)).run()},false,{icons:true,initial:cmd==='emoji'?'icon':'emoji'});break}case 'image':case 'file':{const input=document.createElement('input');input.type='file';input.multiple=true;if(cmd==='image')input.accept='image/png,image/jpeg,image/gif,image/webp';input.onchange=()=>void addFiles(Array.from(input.files??[]));input.click();break}case 'note':void createChild();break;case 'sync':void createSync();break;case 'tabs':insertTabs(editor);editor.commands.focus();break;case 'text':chain.clearNodes().setParagraph().run();break;case 'h1':case 'h2':case 'h3':chain.setHeading({level:Number(cmd[1]) as 1|2|3}).run();break;case 'bullet':chain.toggleBulletList().run();break;case 'number':chain.toggleOrderedList().run();break;case 'check':chain.toggleTaskList().run();break;case 'quote':chain.toggleBlockquote().run();break;case 'callout':chain.wrapIn('callout').run();break;case 'code':chain.toggleCodeBlock().run();break;case 'divider':chain.setHorizontalRule().run();break;case 'table':chain.insertTable({rows:3,cols:3,withHeaderRow:true}).run();break;case 'columns':{const blocks=docToBlocks(editor.getJSON()),pos=blockPositions(editor).find(b=>editor.state.selection.from>=b.pos&&editor.state.selection.from<=b.pos+b.node.nodeSize);if(pos){const fresh={id:crypto.randomUUID(),kind:'text',content:{text:''},version:0};try{replace(blocksToDoc(arrangeBlocks([...blocks,fresh],fresh.id,pos.id,true,1)))}catch(e){setFailed((e as Error).message)}}break}}
 setSlash(null);setMenu(null)}
 keyHandler.current=(e)=>{if(e.key==='Escape'&&(menu||slash)){setMenu(null);setSlash(null);return true}if(slash){if(e.key==='ArrowDown'||e.key==='ArrowUp'){setChoice(c=>(c+(e.key==='ArrowDown'?1:-1)+Math.max(1,filtered.length))%Math.max(1,filtered.length));return true}if(e.key==='Home'||e.key==='End'){setChoice(e.key==='Home'?0:Math.max(0,filtered.length-1));return true}if((e.key==='Enter'||e.key==='Tab')&&filtered[choice]){choose(filtered[choice][0]);return true}}return false};
 useEffect(()=>{if(slash)document.querySelector('.editor-menu .selected')?.scrollIntoView({block:'nearest'})},[choice,slash?.q]);
 async function quote(){if(!editor)return;const q=selectionQuote(editor);if(!q)return;try{if(revision.current!==savedRevision.current){if(!await flush())return}const current=await rpc('workspace_get',{p_id:p.id});const b=current.blocks.find((b:SavedBlock)=>b.id===q.blockId);if(b)latest.current.onQuote(b,{...q,version:b.version})}catch(e){setFailed((e as Error).message)}}
 const failedUploads=useRef<{file:File;id:string}[]>([]);
 async function addFiles(files:File[],target:Editor|null=editor,noteId=p.id,canEdit:()=>boolean=()=>latest.current.edit){
 if(!target||target.isDestroyed||!target.isEditable||!latest.current.edit)return;if(uploading.current){setFailed('파일을 저장하는 중입니다. 완료 후 다시 붙여넣어 주세요.');return}uploading.current=true;
 try{for(const file of files)validateFile(file);target.setEditable(false,false);
 for(const file of files){const previous=failedUploads.current.find(x=>x.file===file);const id=previous?.id??crypto.randomUUID();if(!previous)failedUploads.current.push({file,id});const mime=await fileMime(file),name=fileName(file.name);setFailed('');await uploadNoteFile({id,room_id:noteId,sender_id:p.userId,name,size:file.size,mime,path:''},file,setStatus);if(target.isDestroyed)return;if(!canEdit())throw new Error("편집 권한이 변경되어 파일 삽입을 중단했습니다.");target.setEditable(true,false);target.chain().focus().insertContent({type:'noteFile',attrs:{id:crypto.randomUUID(),fileId:id,name,size:file.size,mime}}).run();target.setEditable(false,false);failedUploads.current=failedUploads.current.filter(x=>x.id!==id)}
 }catch(e){setFailed((e as Error).message)}finally{uploading.current=false;if(!target.isDestroyed){target.setEditable(canEdit(),false);if(target===editor)void flush()}}
 }
 useEffect(()=>{const el=wrapper.current;if(!el)return;const paste=(event:Event)=>{const detail=(event as CustomEvent<{files:File[];editor:Editor;note:string;canEdit:()=>boolean}>).detail;void addFiles(detail.files,detail.editor,detail.note,detail.canEdit)};el.addEventListener('mycel-note-paste-files',paste);return()=>el.removeEventListener('mycel-note-paste-files',paste)},[editor,p.id]);
 const childCreating=useRef(false),childAttempt=useRef<{child:string;doc:JSONContent;version:number}|null>(null);
 async function createChild(){
 if(!editor||!latest.current.edit||childCreating.current)return;childCreating.current=true;setSlash(null);setMenu(null);
 try{
 if(latest.current.onPrepareChild){const prepared=await latest.current.onPrepareChild();if(prepared===false)return;base.current=prepared;}
 if(!await flush())return;
 childCommitting.current=true;editor.setEditable(false,false);if(timer.current)clearTimeout(timer.current);
 const child=crypto.randomUUID(),node=editor.schema.nodes.childNote.create({id:crypto.randomUUID(),noteId:child});
 const tr=editor.state.tr.replaceSelectionWith(node);const doc=uniqueIds(tr.doc.toJSON());
 const attempt=childAttempt.current??{child,doc,version:base.current};childAttempt.current=attempt;
 await rpc('workspace_child_create',{p_parent:p.id,p_id:attempt.child,p_version:attempt.version,p_blocks:docToBlocks(attempt.doc)});
 const confirmed=await rpc('workspace_get',{p_id:p.id});const confirmedVersion=Number(confirmed.item.version);base.current=confirmedVersion;editor.commands.setContent(uniqueIds(blocksToDoc(confirmed.blocks)),{emitUpdate:false});const createdChild=childAttempt.current!.child;childAttempt.current=null;savedRevision.current=revision.current;pending.current=null;localStorage.removeItem(key);setStatus('저장됨');latest.current.onStatus(false);await latest.current.onSaved(confirmedVersion);childCommitting.current=false;latest.current.onOpenNote?.(createdChild);
 }catch(e){setFailed((e as Error).message)}finally{childCommitting.current=false;childCreating.current=false;if(editor&&!editor.isDestroyed)editor.setEditable(latest.current.edit,false)}
 }
 async function createSync(){
 if(!editor||!latest.current.edit||childCreating.current)return;childCreating.current=true;
 try{const prepared=await latest.current.onPrepareChild?.();if(prepared===false)return;if(typeof prepared==='number')base.current=prepared;if(!await flush())return;
 childCommitting.current=true;editor.setEditable(false,false);clearTimeout(timer.current??undefined);
 const {$from}=editor.state.selection;const target=blockPositions(editor).find(b=>$from.pos>=b.pos&&$from.pos<=b.pos+b.node.nodeSize);if(!target||target.node.type.name==='syncedBlock')return;
 const allBlocks=docToBlocks(editor.getJSON()),savedBlock=allBlocks.find(b=>b.id===target.id);if(!savedBlock)return;
 const syncId=crypto.randomUUID(),content=uniqueIds({type:'doc',content:[legacyNode(savedBlock)]}),node=editor.schema.nodes.syncedBlock.create({id:target.id,syncId});
 const doc=uniqueIds(blocksToDoc(allBlocks.map(b=>b.id===target.id?{...b,kind:'text',content:{...b.content,_rich:node.toJSON(),text:'동기화 블록'}}:b))); 
 await rpc('note_sync_create',{p_note:p.id,p_id:syncId,p_version:base.current,p_blocks:docToBlocks(doc),p_content:content});
 const confirmed=await rpc('workspace_get',{p_id:p.id});base.current=Number(confirmed.item.version);editor.commands.setContent(uniqueIds(blocksToDoc(confirmed.blocks)),{emitUpdate:false});savedRevision.current=revision.current;pending.current=null;localStorage.removeItem(key);latest.current.onStatus(false);await latest.current.onSaved(base.current);setStatus('저장됨');
 }catch(e){setFailed((e as Error).message)}finally{childCommitting.current=false;childCreating.current=false;if(!editor.isDestroyed)editor.setEditable(latest.current.edit,false)}
 }
 async function linkSync(syncId:string){if(!editor||!latest.current.edit)return;try{await rpc('note_sync_link',{p_note:p.id,p_id:syncId});if(editor.isDestroyed)return;editor.chain().focus().insertContent({type:'syncedBlock',attrs:{id:crypto.randomUUID(),syncId}}).run()}catch(e){setFailed((e as Error).message)}}
 useEffect(()=>{const root=wrapper.current;if(!editor||!root)return;let observer:MutationObserver|undefined,timeout:ReturnType<typeof setTimeout>|undefined;const jump=()=>{const id=requestedMentionFocus();if(id&&revealMention(root,id)){observer?.disconnect();clearTimeout(timeout)}};const start=()=>{observer?.disconnect();clearTimeout(timeout);observer=new MutationObserver(jump);observer.observe(root,{childList:true,subtree:true});jump();timeout=setTimeout(()=>observer?.disconnect(),15000)};window.addEventListener('mycel-focus-mention',start);start();return()=>{observer?.disconnect();clearTimeout(timeout);window.removeEventListener('mycel-focus-mention',start)}},[editor,p.id]);
 useEffect(()=>{if(!editor)return;let timer:ReturnType<typeof setTimeout>|undefined;const jump=(id:string)=>{const b=blockPositions(editor).find(b=>b.id===id);if(!b)return;const el=editor.view.nodeDOM(b.pos);if(el instanceof HTMLElement){el.scrollIntoView({block:'center'});finishBlockFocus(id);clearTimeout(timer);editor.view.dispatch(editor.state.tr.setMeta(blockLinkKey,{from:b.pos,to:b.pos+b.node.nodeSize}).setMeta('addToHistory',false));timer=setTimeout(()=>{if(!editor.isDestroyed)editor.view.dispatch(editor.state.tr.setMeta(blockLinkKey,null).setMeta('addToHistory',false))},3000)}};const go=(e:Event)=>jump((e as CustomEvent<string>).detail);window.addEventListener('mycel-focus-block',go);const frame=requestAnimationFrame(()=>{const id=requestedBlockFocus();if(id)jump(id)});return()=>{cancelAnimationFrame(frame);clearTimeout(timer);window.removeEventListener('mycel-focus-block',go)}},[editor,p.id]);
 useEffect(()=>{const open=(e:Event)=>latest.current.onOpenNote?.((e as CustomEvent<string>).detail);const el=wrapper.current;el?.addEventListener('mycel-open-note',open);return()=>el?.removeEventListener('mycel-open-note',open)},[]);
 useEffect(()=>{if(!editor)return;for(const button of editor.view.dom.querySelectorAll<HTMLButtonElement>('[data-child-note-open]')){const child=p.childrenNotes?.find(c=>c.id===button.dataset.childNoteOpen);button.replaceChildren(iconElement(child?.icon??'📄'),document.createTextNode(' '+(child?child.title+(child.trashed?' (휴지통)':''):'연결된 노트 열기')))}},[editor,p.childrenNotes,tick]);
 function columnGroup(id:string){
  if(!editor)return null;const block=blockPositions(editor).find(b=>b.id===id);if(!block)return null;
  const pos=editor.state.doc.resolve(block.pos+1);for(let depth=pos.depth;depth>0;depth--){const ancestor=pos.node(depth);if(ancestor.type.name==='columns'&&ancestor.childCount>1)return ancestor.attrs.id as string}return null;
 }
 function convertTo(type:Conversion){if(!editor||!menu)return;const b=blockPositions(editor).find(b=>b.id===menu.id);if(!b)return;if(convertBlock(editor.state,b.pos,type,b.id,tr=>editor.view.dispatch(tr))){setMenu(null);editor.commands.focus()}else setFailed('이 블록은 내용을 유지하며 해당 형식으로 전환할 수 없습니다.');}
 function menuKey(e:React.KeyboardEvent<HTMLDivElement>){
 if(!menu)return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const index=items.indexOf(document.activeElement as HTMLButtonElement);
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();items[(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}
 if(e.key==='ArrowLeft'&&menu.submenu){e.preventDefault();e.stopPropagation();closeSubmenu()}
 if(e.key==='ArrowRight'){const kind=(e.target as HTMLElement).closest<HTMLElement>('[data-submenu]')?.dataset.submenu as 'convert'|'color'|'list'|undefined;if(kind){e.preventDefault();setMenu({...menu,submenu:kind});requestAnimationFrame(()=>submenuElement.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus())}}
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(menu.submenu)closeSubmenu();else {setMenu(null);editor?.commands.focus()}}
 }
 function blockAction(action:string){if(!editor||!menu)return;const b=focusBlock(menu.id);if(!b)return;
 if(action==='link'){const url=new URL(location.href);url.searchParams.set('block',menu.id);url.searchParams.set('item',p.id);url.searchParams.set('tab','note');void navigator.clipboard.writeText(url.href).then(()=>setStatus('블록 링크 복사됨')).catch(()=>setFailed('클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.'));setMenu(null);return}
 if(action==='move'){setMovingBlock(menu.id);setMenu(null);return}
 if(action==='sync'){void createSync();setMenu(null);return}
 if(action==='delete')editor.chain().deleteRange({from:b.pos,to:b.pos+b.node.nodeSize}).run();
 if(action==='duplicate')editor.commands.insertContentAt(b.pos+b.node.nodeSize,uniqueIds({...b.node.toJSON(),attrs:{...b.node.attrs,id:null}}));
 if(action==='comment')latest.current.onComment(menu.id);
 if(action==='equalize'){const tr=equalizeColumns(editor.state,b.pos);if(tr)editor.view.dispatch(tr)}
 if(action==='flatten'){const bs=docToBlocks(editor.getJSON()),group=columnGroup(menu.id);if(!group){setMenu(null);return}replace(blocksToDoc(bs.map(b=>{if(b.content._layout?.group!==group)return b;const content={...b.content};delete content._layout;return {...b,content}})))}
 setMenu(null)
 }
 function track(e:React.PointerEvent){
  if(blockDragging.current||!editor||(!p.edit&&!p.canComment)||menu||!wrapper.current)return;
  const target=e.target as HTMLElement;
  const found=blockPositions(editor).find(b=>{const dom=editor.view.nodeDOM(b.pos);return dom instanceof HTMLElement&&dom.contains(target)});
  if(!found)return;
  const block=editor.view.nodeDOM(found.pos) as HTMLElement;
  setHover({id:found.id,...pageHandlePosition(block,editor.view.dom,wrapper.current)});
 }
 // Keep the active gutter aligned after wrapping, font changes or column resizing.
 useEffect(()=>{
  if(!editor||!wrapper.current)return;
  const refresh=()=>setHover(current=>{
   if(!current||blockDragging.current||!wrapper.current)return current;
   const found=blockPositions(editor).find(b=>b.id===current.id);
   const block=found&&editor.view.nodeDOM(found.pos);
   if(!(block instanceof HTMLElement))return null;
   const next=pageHandlePosition(block,editor.view.dom,wrapper.current);
   return next.x===current.x&&next.y===current.y&&next.right===current.right?current:{id:current.id,...next};
  });
  const observer=new ResizeObserver(refresh);
  observer.observe(wrapper.current);observer.observe(editor.view.dom);
  editor.view.dom.querySelectorAll('.editor-column-content').forEach(el=>observer.observe(el));
  window.addEventListener('resize',refresh);refresh();
  return()=>{observer.disconnect();window.removeEventListener('resize',refresh)};
 },[editor,tick]);

 function startDrag(e:React.PointerEvent){if(!editor||!hover||!p.edit)return;e.preventDefault();e.stopPropagation();blockDragging.current=true;const id=hover.id,startX=e.clientX,startY=e.clientY,handle=e.currentTarget as HTMLElement;handle.setPointerCapture(e.pointerId);let ghost:HTMLElement|null=null,line:HTMLElement|null=null,target:any=null,frame=0,lastY=startY,lastX=startX,moved=false;
 const selected=blockPositions(editor).filter(b=>b.pos>=editor.state.selection.from&&b.pos+b.node.nodeSize<=editor.state.selection.to).map(b=>b.id);const moving=selected.includes(id)?selected:[id];
 const elements=()=>blockPositions(editor).map(b=>({b,el:editor.view.nodeDOM(b.pos) as HTMLElement})).filter(x=>x.el&&!moving.includes(x.b.id));
 const tick=()=>{const root=wrapper.current?.closest('.workspace') as HTMLElement;let scroll:HTMLElement|null=root;while(scroll&&scroll.scrollHeight<=scroll.clientHeight)scroll=scroll.parentElement;const r=scroll?.getBoundingClientRect();if(r){if(lastY<r.top+50)scroll!.scrollTop-=10;else if(lastY>r.bottom-50)scroll!.scrollTop+=10}if(moved)frame=requestAnimationFrame(tick)};
 const move=(ev:PointerEvent)=>{lastY=ev.clientY;lastX=ev.clientX;if(!moved&&Math.hypot(lastX-startX,lastY-startY)<5)return;if(!moved){moved=true;setMenu(null);ghost=document.createElement('div');ghost.className='editor-drag-ghost';ghost.textContent=moving.length>1?moving.length+'개 블록':editor.state.doc.nodeAt(blockPositions(editor).find(b=>b.id===id)!.pos)?.textContent.slice(0,100)??'블록';line=document.createElement('div');line.className='editor-drop-line';document.body.append(ghost,line);frame=requestAnimationFrame(tick)}
 ghost!.style.transform='translate('+(lastX+12)+'px,'+(lastY+8)+'px)';const candidates=elements();let best:any=null,dist=Infinity;for(const c of candidates){const r=c.el.getBoundingClientRect(),d=Math.max(r.top-lastY,0,lastY-r.bottom)+Math.max(r.left-lastX,0,lastX-r.right);if(d<dist){dist=d;best={...c,r}}}if(!best)return;const r=best.r,side=Math.abs(lastX-startX)>40?(lastX<r.left+28?-1:lastX>r.right-28?1:0):0;target={id:best.b.id,side,after:lastY>(r.top+r.bottom)/2};Object.assign(line!.style,{left:(side?(side<0?r.left:r.right):r.left)+'px',top:(side?r.top:target.after?r.bottom:r.top)+'px',width:(side?3:r.width)+'px',height:(side?r.height:3)+'px'})};
 const cleanup=()=>{blockDragging.current=false;cancelAnimationFrame(frame);ghost?.remove();line?.remove();handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape)};
 const cancel=()=>cleanup(),escape=(ev:KeyboardEvent)=>{if(ev.key==='Escape')cleanup()};
 const end=()=>{cleanup();if(!moved){setMenu({id,x:Math.max(8,startX),y:Math.min(startY,window.innerHeight-360)});return}setHover(null);if(!target)return;const before=new Map(blockPositions(editor).map(b=>[b.id,(editor.view.nodeDOM(b.pos) as HTMLElement)?.getBoundingClientRect()]));try{let blocks=docToBlocks(editor.getJSON());for(const source of target.after?[...moving].reverse():moving)blocks=arrangeBlocks(blocks,source,target.id,target.after,target.side);replace(blocksToDoc(blocks));requestAnimationFrame(()=>{for(const b of blockPositions(editor)){const el=editor.view.nodeDOM(b.pos) as HTMLElement,old=before.get(b.id),r=el?.getBoundingClientRect();if(old&&r&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{transform:'translate('+(old.left-r.left)+'px,'+(old.top-r.top)+'px)'},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'})}})}catch(e){setFailed((e as Error).message)}};
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape);
 }
 if(!editor)return null;
 return <div className="page-editor" data-can-comment={p.canComment} ref={wrapper} onPasteCapture={e=>{if((e.target as HTMLElement).closest('.note-sync-content'))return;const sync=e.clipboardData.getData('text/plain').trim();if(sync.startsWith(SYNC_PREFIX)&&/^[a-f0-9-]{36}$/.test(sync.slice(SYNC_PREFIX.length))&&p.edit){e.preventDefault();e.stopPropagation();void linkSync(sync.slice(SYNC_PREFIX.length));return}const files=clipboardFiles(e.clipboardData);if(files.length&&p.edit&&(e.target as HTMLElement).closest('[contenteditable=true]')){e.preventDefault();e.stopPropagation();void addFiles(files)}}} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDropCapture={e=>{const files=Array.from(e.dataTransfer.files);if(files.length&&p.edit){e.preventDefault();e.stopPropagation();if(editor){const at=editor.view.posAtCoords({left:e.clientX,top:e.clientY});if(at)editor.commands.setTextSelection(at.pos)}void addFiles(files)}}} onKeyDownCapture={e=>{if(!(e.target as HTMLElement).closest('.editor-menu')&&!e.nativeEvent.isComposing&&keyHandler.current(e.nativeEvent)){e.preventDefault();e.stopPropagation()}}} onPointerMove={track} onPointerDown={track} onClick={e=>{const child=(e.target as HTMLElement).closest<HTMLElement>('[data-child-note-open]');if(child){latest.current.onOpenNote?.(child.dataset.childNoteOpen!);return}const mark=(e.target as HTMLElement).closest<HTMLElement>('[data-comment-id]');if(mark&&!window.getSelection()?.toString())window.dispatchEvent(new CustomEvent('mycel-open-comment',{detail:{id:mark.dataset.commentId,anchor:mark}}))}}>
 <div className="editor-status">{p.edit&&<button type="button" className="emoji-trigger" aria-label="노트 본문에 아이콘 입력" title="아이콘 입력 · /아이콘" onMouseDown={e=>e.preventDefault()} onClick={e=>{const selection={from:editor.state.selection.from,to:editor.state.selection.to};showEmojiPicker(e.currentTarget,emoji=>{if(!editor.isDestroyed&&editor.isEditable)editor.chain().focus().setTextSelection(selection).insertContent(symbolContent(emoji)).run()},false,{icons:true})}}>☺</button>}<span role="status">{status}</span>{p.edit&&draftAvailable&&<details><summary>복구할 임시 내용 있음</summary><div className="editor-recovery-popover"><p>현재 페이지와 다른 임시 입력이 이 기기에 남아 있습니다.</p><button onClick={()=>{try{const draft=JSON.parse(localStorage.getItem(key)??'null');if(draft?.doc){base.current=draft.version;blocked.current=false;pending.current=null;replace(draft.doc);setDraftAvailable(false)}}catch{setFailed('임시 내용을 불러오지 못했습니다.')}}}>임시 입력 복구</button><button onClick={()=>{if(confirm('기기의 임시 입력을 삭제하고 현재 내용을 유지할까요?')){localStorage.removeItem(key);setDraftAvailable(false)}}}>현재 내용 유지 · 임시 입력 삭제</button></div></details>}</div>
 {failed&&<div className="editor-warning" role="alert">{failed}{p.edit&&<button onClick={()=>{blocked.current=false;if(childAttempt.current)void createChild();else if(failedUploads.current.length)void addFiles(failedUploads.current.map(x=>x.file));else void flush()}}>저장 재시도</button>}</div>}
 <EditorContent editor={editor}/>
 {p.canComment&&hover&&<button className="editor-block-comment" aria-label="블록에 댓글 달기" title="댓글 달기" style={{left:hover.right,top:hover.y}} onPointerMove={e=>e.stopPropagation()} onPointerDown={e=>{e.preventDefault();e.stopPropagation()}} onClick={async e=>{e.stopPropagation();if(revision.current!==savedRevision.current&&!await flush())return;latest.current.onComment(hover.id)}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M8 11h8m-4-4v8"/></svg></button>}
 {p.edit&&hover&&<div className="editor-handles" style={{left:hover.x,top:hover.y}} onPointerMove={e=>e.stopPropagation()}><button aria-label="블록 추가" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setMenu({id:hover.id,x:r.left,y:r.bottom,add:true})}}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 2v12M2 8h12"/></svg></button><button aria-label="블록 이동 및 메뉴" title="드래그하여 이동 · 클릭하여 메뉴" onPointerDown={startDrag} style={{touchAction:'none'}}><Grip/></button></div>}
 {p.edit&&<PageSelectionTools editor={editor} hidden={!!menu} onMore={()=>openSelectionMenu(editor)} onComment={p.canComment&&selectionQuote(editor)?()=>void quote():undefined}/>}
 {p.edit&&syncSelection&&!syncSelection.isDestroyed&&<PageSelectionTools editor={syncSelection} hidden={!!menu} onMore={()=>openSelectionMenu(syncSelection)}/>}
 {!p.edit&&p.canComment&&<BubbleMenu editor={editor}><button onClick={()=>void quote()}>선택 문장에 댓글</button></BubbleMenu>}
 {(menu||slash)&&<div role="menu" aria-label="블록 메뉴" className="editor-menu" ref={menuElement} data-placement={menu?menuPosition?.placement:undefined} onKeyDown={menuKey} style={menu?{left:menuPosition?.left??0,top:menuPosition?.top??0,width:menuPosition?.width??260,maxHeight:menuPosition?.maxHeight??350,visibility:menuPosition?'visible':'hidden'}:{left:Math.max(8,Math.min(slash!.x,window.innerWidth-280)),top:Math.max(8,Math.min(slash!.y,window.innerHeight-360))}} onMouseDown={e=>e.preventDefault()}>
 {menu&&!menu.add&&<>
 <button role="menuitem" data-submenu="convert" aria-haspopup="menu" aria-expanded={menu.submenu==='convert'} onClick={()=>submenu('convert')}>{menuLabel('convert','전환')}<span aria-hidden="true">›</span></button>
 <button role="menuitem" data-submenu="color" aria-haspopup="menu" aria-expanded={menu.submenu==='color'} onClick={()=>submenu('color')}>{menuLabel('color','색')}<span aria-hidden="true">›</span></button>
 {isNumbered()&&<button role="menuitem" data-submenu="list" aria-haspopup="menu" aria-expanded={menu.submenu==='list'} onClick={()=>submenu('list')}>{menuLabel('list','목록 형식')}<span aria-hidden="true">›</span></button>}
 <hr/>{[['link','블록 링크 복사'],['duplicate','복제'],['move','옮기기'],['comment','댓글'],['delete','삭제']].map(([action,label])=><button key={action} role="menuitem" onClick={()=>blockAction(action)}>{menuLabel(action,label)}</button>)}
 {columnGroup(menu.id)&&<button role="menuitem" onClick={()=>blockAction('equalize')}>{menuLabel('equalize','단 너비 동일하게')}</button>}
 {columnGroup(menu.id)&&<button role="menuitem" onClick={()=>blockAction('flatten')}>{menuLabel('flatten','한 단으로 펼치기')}</button>}
 <BlockEditInfo id={menu.id} version={p.version} dirty={revision.current!==savedRevision.current}/>
 </>}
 {(slash||menu?.add)&&(slash?filtered:commands).map(([cmd,label],i)=><button key={cmd} role="menuitem" aria-current={slash&&choice===i?'true':undefined} className={slash&&choice===i?'selected':''} onClick={()=>choose(cmd)}>{menuLabel(cmd,label)}<small>/{cmd}</small></button>)}
 {!filtered.length&&slash&&<p>일치하는 블록이 없습니다.</p>}</div>}
 {menu?.submenu&&<div role="menu" aria-label={{convert:'전환',color:'색',list:'목록 형식'}[menu.submenu]} ref={submenuElement} className="editor-menu editor-submenu" onKeyDown={menuKey} onMouseDown={e=>e.preventDefault()} style={{left:submenuPosition?.left??0,top:submenuPosition?.top??0,width:submenuPosition?.width??260,maxHeight:submenuPosition?.maxHeight??600,visibility:submenuPosition?'visible':'hidden'}}>
 <div className="editor-menu-caption">{{convert:'전환',color:'색',list:'목록 형식'}[menu.submenu]}</div>
 {menu.submenu==='convert'&&<>{conversionTypes.map(([type,label])=>{const b=blockPositions(editor).find(b=>b.id===menu.id),current=b&&blockType(b.node,editor.state.doc.resolve(b.pos).parent)===type,available=!!b&&convertBlock(editor.state,b.pos,type,b.id);return <button key={type} role="menuitemradio" aria-checked={!!current} disabled={!available} title={available?label:'내용을 유지할 수 없는 전환입니다.'} onClick={()=>convertTo(type)}>{menuLabel(type,label)}{current&&<span aria-hidden="true">✓</span>}</button>})}<hr/><button role="menuitem" disabled={blockPositions(editor).find(b=>b.id===menu.id)?.node.type.name==='syncedBlock'} onClick={()=>blockAction('sync')}>{menuLabel('sync','동기화 블록')}</button></>}
 {menu.submenu==='color'&&<>{(['blockText','blockBackground'] as const).map(field=><div key={field}><div className="editor-menu-caption">{field==='blockText'?'텍스트 색상':'배경 색상'}</div>{blockColors.map(c=>{const b=blockPositions(editor).find(b=>b.id===menu.id),active=(b?.node.attrs[field]??'default')===c.id;return <button key={c.id} role="menuitemradio" aria-checked={active} onClick={()=>blockColor(field,c.id)}><span className="block-menu-label"><span className="block-color-sample" style={field==='blockText'?{color:c.id==='default'?'inherit':c.hex}:{background:c.background}}>{field==='blockText'?'A':''}</span><span>{c.label} {field==='blockText'?'텍스트':'배경'}</span></span>{active&&<span aria-hidden="true">✓</span>}</button>})}</div>)}</>}
 {menu.submenu==='list'&&listFormats.map(([value,label,icon])=>{const b=blockPositions(editor).find(b=>b.id===menu.id),active=b&&(editor.state.doc.resolve(b.pos).parent.attrs.listFormat??'default')===value;return <button key={value} role="menuitemradio" aria-checked={!!active} onClick={()=>listFormat(value)}><span className="block-menu-label"><IconValue decorative value={'icon:'+icon+':default'}/><span>{label}</span></span>{active&&<span aria-hidden="true">✓</span>}</button>})}
 </div>}
 {movingBlock&&<BlockMoveDialog source={p.id} onClose={()=>setMovingBlock('')} onMove={async(target,targetVersion,mutation)=>{
 if(!editor||!latest.current.edit)throw Error('본문편집 권한이 없습니다.');
 if(!await saveBeforeNavigation())throw Error('변경 내용을 저장한 뒤 다시 이동해 주세요.');
 childCommitting.current=true;editor.setEditable(false,false);
 try{if(revision.current!==savedRevision.current&&!await flush())throw Error('저장하지 못했습니다.');await rpc('page_block_move',{p_source:p.id,p_target:target,p_block:movingBlock,p_version:base.current,p_target_version:targetVersion,p_mutation:mutation});const confirmed=await rpc('workspace_get',{p_id:p.id});base.current=Number(confirmed.item.version);editor.commands.setContent(uniqueIds(blocksToDoc(confirmed.blocks)),{emitUpdate:false});savedRevision.current=revision.current;pending.current=null;localStorage.removeItem(key);latest.current.onStatus(false);await latest.current.onSaved(base.current);setStatus('블록을 이동했습니다.')}finally{childCommitting.current=false;if(!editor.isDestroyed)editor.setEditable(latest.current.edit,false)}
 }}/>}
 {p.edit&&<><PageTableTools editor={editor}/><PageCellTools editor={editor}/></>}
 </div>
}
