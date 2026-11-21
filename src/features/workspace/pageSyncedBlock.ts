import {clipboardFiles} from './pageClipboard';
import {Node,Editor,mergeAttributes,type JSONContent} from '@tiptap/core';
import {extensions} from './pageExtensions';
import {uniqueIds} from './pageDocument';
import {supabase} from '../../services/supabase';
export const SYNC_PREFIX='mycel-synced-block:';
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await supabase!.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return data}
export const SyncedBlock=Node.create({name:'syncedBlock',group:'block',atom:true,draggable:true,
 addAttributes(){return {syncId:{default:''}}},parseHTML:()=>[{tag:'div[data-synced-block]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-synced-block':''}),'동기화 블록'],
 addNodeView(){return ({node,editor,getPos})=>{
 let destroyed=false,inner:Editor|undefined,version=0,dirty=false,permission=0,timer:ReturnType<typeof setTimeout>|undefined,inflight:Promise<boolean>|null=null,pending:{doc:JSONContent;version:number;mutation:string}|null=null,sourceNote='',lastSaved='';
 const dom=document.createElement('div');dom.className='note-synced-block';dom.dataset.syncedBlock=node.attrs.syncId;dom.dataset.blockId=node.attrs.id;dom.contentEditable='false';
 const bar=document.createElement('div');bar.className='note-sync-toolbar';bar.contentEditable='false';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','동기화 블록 안내');
 const locations=document.createElement('details'),label=document.createElement('summary'),locationMenu=document.createElement('div');locations.className='note-sync-locations';label.textContent='동기화 블록';label.setAttribute('aria-label','동기화된 노트');locationMenu.className='note-sync-menu';locations.append(label,locationMenu);
 const status=document.createElement('small');status.setAttribute('role','status');
 const notice=document.createElement('div');notice.className='note-sync-notice';notice.setAttribute('role','alert');notice.textContent='동기화 블록을 불러오는 중…';
 const content=document.createElement('div');content.className='note-sync-content';
 const options=document.createElement('details'),summary=document.createElement('summary');summary.textContent='···';summary.setAttribute('aria-label','동기화 블록 메뉴');const menu=document.createElement('div');menu.className='note-sync-menu';options.append(summary,menu);
 const copyButton=document.createElement('button');copyButton.type='button';copyButton.className='note-sync-copy';copyButton.setAttribute('aria-label','복사하여 동기화');copyButton.title='복사하여 동기화';copyButton.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/></svg>';
 bar.append(locations,status,copyButton,options);dom.append(notice,content);document.body.append(bar);
 let active=false,positionFrame=0;
 const setStatus=(text:string,error=false)=>{status.textContent=text==='동기화됨'?'':text;notice.hidden=!error;notice.textContent=error?text:'';dom.dataset.syncError=String(error);schedulePosition()};
 function position(){if(!active||destroyed)return;const r=dom.getBoundingClientRect(),v=window.visualViewport,x=v?.offsetLeft??0,y=v?.offsetTop??0,w=v?.width??innerWidth,h=v?.height??innerHeight;bar.style.maxWidth=Math.max(1,w-16)+'px';const height=bar.offsetHeight,width=bar.offsetWidth;bar.style.left=Math.max(x+8,Math.min(r.right-width,x+w-width-8))+'px';bar.style.top=(r.top-height-8>=y+8?r.top-height-8:Math.max(y+8,Math.min(r.bottom+8,y+h-height-8)))+'px';for(const list of [menu,locationMenu]){const available=y+h-parseFloat(bar.style.top)-height-16;list.style.maxHeight=Math.max(100,Math.min(300,available))+'px';}}
 function schedulePosition(){cancelAnimationFrame(positionFrame);positionFrame=requestAnimationFrame(position)}
 const activate=()=>{active=true;dom.dataset.syncActive='true';bar.hidden=false;position()};
 const deactivate=()=>{active=false;dom.dataset.syncActive='false';bar.hidden=true;options.open=false;locations.open=false};
 const outside=(event:Event)=>{const target=event.target as globalThis.Node;if(!dom.contains(target)&&!bar.contains(target))deactivate()};
 const escape=(event:KeyboardEvent)=>{if(active&&event.key==='Escape'){event.stopPropagation();deactivate()}};
 dom.addEventListener('pointerdown',activate);dom.addEventListener('focusin',activate);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape,true);document.addEventListener('scroll',schedulePosition,true);window.addEventListener('resize',schedulePosition);window.visualViewport?.addEventListener('resize',schedulePosition);window.visualViewport?.addEventListener('scroll',schedulePosition);
 const resize=new ResizeObserver(schedulePosition);resize.observe(dom);resize.observe(bar);
 options.addEventListener('toggle',()=>{if(options.open)locations.open=false;schedulePosition()});locations.addEventListener('toggle',()=>{if(locations.open)options.open=false;schedulePosition()});
 const openNote=(id:string)=>dom.dispatchEvent(new CustomEvent('mycel-open-note',{bubbles:true,detail:id}));
 content.addEventListener('click',event=>{event.stopPropagation();const child=(event.target as HTMLElement).closest<HTMLElement>('[data-child-note-open]');if(child)openNote(child.dataset.childNoteOpen!)});
 const note=()=>dom.closest<HTMLElement>('[data-note-document]')?.dataset.noteDocument??'';
 const draftKey=()=> 'mycel-sync-draft:'+note()+':'+node.attrs.syncId;
 const preserve=()=>{if(inner&&dirty)try{localStorage.setItem(draftKey(),JSON.stringify({doc:inner.getJSON(),version}))}catch{}};
 async function save(){if(inflight)return inflight;if(!dirty&&!pending)return true;if(!inner||permission<3){preserve();return false}
 const sent=pending??{doc:inner.getJSON(),version,mutation:crypto.randomUUID()};pending=sent;
 inflight=(async()=>{try{const v=await rpc('note_sync_save',{p_note:note(),p_id:node.attrs.syncId,p_version:sent.version,p_mutation:sent.mutation,p_content:sent.doc});version=Number(v);lastSaved=JSON.stringify(sent.doc);pending=null;dirty=JSON.stringify(inner!.getJSON())!==lastSaved;setStatus(dirty?'저장 대기':'동기화됨');if(!dirty)localStorage.removeItem(draftKey());else preserve();return true}catch(e){setStatus((e as Error).message,true);preserve();return false}finally{inflight=null;if(dirty&&!pending&&!destroyed){clearTimeout(timer);timer=setTimeout(()=>void save(),900)}}})();return inflight;
 }
 const option=(text:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',text);b.onclick=run;menu.append(b);return b};
 const copy=()=>{navigator.clipboard.writeText(SYNC_PREFIX+node.attrs.syncId).then(()=>{setStatus('복사됨');options.open=false}).catch(()=>setStatus('클립보드 접근을 허용해 주세요.',true))};copyButton.onclick=copy;
 option('복사하여 동기화',copy);
 option('원본 노트 열기',()=>{if(sourceNote)openNote(sourceNote)});
 option('저장 재시도',()=>void save());
 option('기기 임시 내용 복구',()=>{try{const draft=JSON.parse(localStorage.getItem(draftKey())??'null');if(draft?.doc&&inner&&permission>=3){inner.commands.setContent(draft.doc);setStatus('임시 내용을 복구했습니다.')}else setStatus('복구할 입력이 없습니다.')}catch{setStatus('임시 내용을 읽을 수 없습니다.',true)}});
 option('최신 내용 열기',()=>{preserve();pending=null;dirty=false;void load(true)});
 option('동기화 해제',()=>{void(async()=>{if(!editor.isEditable||!inner)return;if(dirty&&!await save())return;const doc=uniqueIds(inner.getJSON());await rpc('note_sync_detach',{p_note:note(),p_id:node.attrs.syncId,p_content:doc});if(destroyed)return;const pos=getPos();if(typeof pos!=='number')return;editor.chain().focus().insertContentAt({from:pos,to:pos+node.nodeSize},doc.content??[]).run()})().catch(e=>setStatus(e.message,true))});
 const history=document.createElement('div');history.className='note-sync-history';dom.append(history);
 option('수정 이력',()=>{void rpc('note_sync_history',{p_note:note(),p_id:node.attrs.syncId}).then(rows=>{history.replaceChildren();const close=document.createElement('button');close.textContent='이력 닫기';close.onclick=()=>history.replaceChildren();history.append(close);for(const row of rows){const b=document.createElement('button');b.textContent='v'+row.version+' · '+new Date(row.created_at).toLocaleString('ko-KR');b.onclick=()=>{if(permission<3||!inner)return;if(confirm('이 동기화 블록을 선택한 버전으로 복원할까요? 현재 내용도 이력에 보존됩니다.')){pending=null;inner.commands.setContent(row.content);void save()}};b.disabled=permission<3;history.append(b)}}).catch(e=>setStatus(e.message,true))});
 async function load(force=false){if(destroyed||!note()||inflight||dirty&&!force)return;
 try{const data=await rpc('note_sync_get',{p_note:note(),p_id:node.attrs.syncId});if(destroyed)return;sourceNote=data.source_note;permission=data.permission;content.hidden=false;const links=(data.locations??[]) as {id:string;title:string}[];const others=links.filter(x=>x.id!==note()).length;label.textContent=others?others+'개의 다른 노트에 동기화':'이 노트에 동기화';label.title='연결된 노트 확인';
 const linkKey=JSON.stringify([sourceNote,links]);if(locationMenu.dataset.links!==linkKey){locationMenu.dataset.links=linkKey;locationMenu.replaceChildren();for(const item of links.length?links:[{id:sourceNote,title:data.source_title}]){const button=document.createElement('button');button.type='button';button.textContent=item.title+(item.id===sourceNote?' · 원본':'')+(item.id===note()?' · 현재 노트':'');button.onclick=()=>openNote(item.id);locationMenu.append(button)}}content.dataset.noteDocument=sourceNote;
 if(!inner){inner=new Editor({element:content,extensions:extensions(false),content:data.content,editable:editor.isEditable&&permission>=3,editorProps:{attributes:{'aria-label':'동기화 블록 본문','role':'textbox','aria-multiline':'true'},handlePaste:(_view,event)=>{const files=event.clipboardData?clipboardFiles(event.clipboardData):[];if(!files.length||!inner?.isEditable)return false;event.preventDefault();dom.dispatchEvent(new CustomEvent('mycel-note-paste-files',{bubbles:true,detail:{files,editor:inner,note:sourceNote,canEdit:()=>!destroyed&&editor.isEditable&&permission>=3}}));return true}},onUpdate:()=>{dirty=true;setStatus('저장 대기');preserve();clearTimeout(timer);timer=setTimeout(()=>void save(),900)}})}
 else{inner.setEditable(editor.isEditable&&permission>=3,false);if(!dirty&&(force||Number(data.version)>version)&&JSON.stringify(inner.getJSON())!==JSON.stringify(data.content))inner.commands.setContent(data.content,{emitUpdate:false})}
 version=Number(data.version);lastSaved=JSON.stringify(data.content);setStatus(permission>=3?'동기화됨':'열람 전용');
 }catch(e){if(!destroyed){permission=0;preserve();content.hidden=true;inner?.setEditable(false,false);setStatus((e as Error).message,true)}}
 }
 const frame=requestAnimationFrame(()=>void load()),poll=setInterval(()=>void load(),4000);
 const leave=(e:Event)=>{if(!dom.isConnected)return;(e as CustomEvent<Array<()=>Promise<boolean>>>).detail.push(async()=>{clearTimeout(timer);if(permission<3){preserve();return true}for(let n=0;n<10&&(dirty||pending);n++)if(!await save())return false;return !dirty&&!pending})};
 const unload=(e:BeforeUnloadEvent)=>{if(dirty){preserve();e.preventDefault();e.returnValue=''}};
 window.addEventListener('mycel-before-navigation',leave);window.addEventListener('beforeunload',unload);
 return {dom,update(next){if(next.type!==node.type||next.attrs.syncId!==node.attrs.syncId)return false;inner?.setEditable(editor.isEditable&&permission>=3,false);return true},stopEvent:()=>true,ignoreMutation:()=>true,destroy(){destroyed=true;bar.remove();resize.disconnect();cancelAnimationFrame(positionFrame);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape,true);document.removeEventListener('scroll',schedulePosition,true);window.removeEventListener('resize',schedulePosition);window.visualViewport?.removeEventListener('resize',schedulePosition);window.visualViewport?.removeEventListener('scroll',schedulePosition);clearTimeout(timer);clearInterval(poll);cancelAnimationFrame(frame);preserve();inner?.destroy();window.removeEventListener('mycel-before-navigation',leave);window.removeEventListener('beforeunload',unload)}};
 };}
});
