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
 const bar=document.createElement('div');bar.className='note-sync-toolbar';bar.contentEditable='false';const label=document.createElement('strong');label.textContent='동기화 블록';const status=document.createElement('small');status.textContent='불러오는 중…';const content=document.createElement('div');content.className='note-sync-content';const options=document.createElement('details'),summary=document.createElement('summary');summary.textContent='···';summary.setAttribute('aria-label','동기화 블록 메뉴');const menu=document.createElement('div');menu.className='note-sync-menu';options.append(summary,menu);bar.append(label,status,options);dom.append(bar,content);
 const note=()=>dom.closest<HTMLElement>('[data-note-document]')?.dataset.noteDocument??'';
 const draftKey=()=> 'mycel-sync-draft:'+note()+':'+node.attrs.syncId;
 const preserve=()=>{if(inner&&dirty)try{localStorage.setItem(draftKey(),JSON.stringify({doc:inner.getJSON(),version}))}catch{}};
 async function save(){if(inflight)return inflight;if(!dirty&&!pending)return true;if(!inner||permission<3){preserve();return false}
 const sent=pending??{doc:inner.getJSON(),version,mutation:crypto.randomUUID()};pending=sent;
 inflight=(async()=>{try{const v=await rpc('note_sync_save',{p_note:note(),p_id:node.attrs.syncId,p_version:sent.version,p_mutation:sent.mutation,p_content:sent.doc});version=Number(v);lastSaved=JSON.stringify(sent.doc);pending=null;dirty=JSON.stringify(inner!.getJSON())!==lastSaved;status.textContent=dirty?'저장 대기':'동기화됨';if(!dirty)localStorage.removeItem(draftKey());else preserve();return true}catch(e){status.textContent=(e as Error).message;preserve();return false}finally{inflight=null;if(dirty&&!pending&&!destroyed){clearTimeout(timer);timer=setTimeout(()=>void save(),900)}}})();return inflight;
 }
 const option=(text:string,run:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=run;menu.append(b);return b};
 option('복사하여 동기화',()=>{navigator.clipboard.writeText(SYNC_PREFIX+node.attrs.syncId).then(()=>{status.textContent='다른 노트 본문에 붙여넣으세요.';options.open=false}).catch(()=>{status.textContent='클립보드 접근을 허용해 주세요.'})});
 option('원본 노트 열기',()=>{if(sourceNote)dom.dispatchEvent(new CustomEvent('mycel-open-note',{bubbles:true,detail:sourceNote}))});
 option('저장 재시도',()=>void save());
 option('기기 임시 내용 복구',()=>{try{const draft=JSON.parse(localStorage.getItem(draftKey())??'null');if(draft?.doc&&inner&&permission>=3){inner.commands.setContent(draft.doc);status.textContent='임시 내용을 복구했습니다.'}else status.textContent='복구할 입력이 없습니다.'}catch{status.textContent='임시 내용을 읽을 수 없습니다.'}});
 option('최신 내용 열기',()=>{preserve();pending=null;dirty=false;void load(true)});
 option('동기화 해제',()=>{void(async()=>{if(!editor.isEditable||!inner)return;if(dirty&&!await save())return;const doc=uniqueIds(inner.getJSON());await rpc('note_sync_detach',{p_note:note(),p_id:node.attrs.syncId,p_content:doc});if(destroyed)return;const pos=getPos();if(typeof pos!=='number')return;editor.chain().focus().insertContentAt({from:pos,to:pos+node.nodeSize},doc.content??[]).run()})().catch(e=>status.textContent=e.message)});
 const history=document.createElement('div');history.className='note-sync-history';dom.append(history);
 option('수정 이력',()=>{void rpc('note_sync_history',{p_note:note(),p_id:node.attrs.syncId}).then(rows=>{history.replaceChildren();const close=document.createElement('button');close.textContent='이력 닫기';close.onclick=()=>history.replaceChildren();history.append(close);for(const row of rows){const b=document.createElement('button');b.textContent='v'+row.version+' · '+new Date(row.created_at).toLocaleString('ko-KR');b.onclick=()=>{if(permission<3||!inner)return;if(confirm('이 동기화 블록을 선택한 버전으로 복원할까요? 현재 내용도 이력에 보존됩니다.')){pending=null;inner.commands.setContent(row.content);void save()}};b.disabled=permission<3;history.append(b)}}).catch(e=>status.textContent=e.message)});
 async function load(force=false){if(destroyed||!note()||inflight||dirty&&!force)return;
 try{const data=await rpc('note_sync_get',{p_note:note(),p_id:node.attrs.syncId});if(destroyed)return;sourceNote=data.source_note;permission=data.permission;content.hidden=false;label.textContent='동기화 · '+data.source_title;label.title=(data.locations??[]).map((x:any)=>x.title).join(' · ');content.dataset.noteDocument=sourceNote;
 if(!inner){inner=new Editor({element:content,extensions:extensions(false),content:data.content,editable:editor.isEditable&&permission>=3,editorProps:{attributes:{'aria-label':'동기화 블록 본문','role':'textbox','aria-multiline':'true'}},onUpdate:()=>{dirty=true;status.textContent='저장 대기';preserve();clearTimeout(timer);timer=setTimeout(()=>void save(),900)}})}
 else{inner.setEditable(editor.isEditable&&permission>=3,false);if(!dirty&&(force||Number(data.version)>version)&&JSON.stringify(inner.getJSON())!==JSON.stringify(data.content))inner.commands.setContent(data.content,{emitUpdate:false})}
 version=Number(data.version);lastSaved=JSON.stringify(data.content);status.textContent=permission>=3?'동기화됨':'열람 전용';
 }catch(e){if(!destroyed){permission=0;preserve();content.hidden=true;inner?.setEditable(false,false);status.textContent=(e as Error).message}}
 }
 const frame=requestAnimationFrame(()=>void load()),poll=setInterval(()=>void load(),4000);
 const leave=(e:Event)=>{if(!dom.isConnected)return;(e as CustomEvent<Array<()=>Promise<boolean>>>).detail.push(async()=>{clearTimeout(timer);if(permission<3){preserve();return true}for(let n=0;n<10&&(dirty||pending);n++)if(!await save())return false;return !dirty&&!pending})};
 const unload=(e:BeforeUnloadEvent)=>{if(dirty){preserve();e.preventDefault();e.returnValue=''}};
 window.addEventListener('mycel-before-navigation',leave);window.addEventListener('beforeunload',unload);
 return {dom,update(next){if(next.type!==node.type||next.attrs.syncId!==node.attrs.syncId)return false;inner?.setEditable(editor.isEditable&&permission>=3,false);return true},stopEvent:()=>true,ignoreMutation:()=>true,destroy(){destroyed=true;clearTimeout(timer);clearInterval(poll);cancelAnimationFrame(frame);preserve();inner?.destroy();window.removeEventListener('mycel-before-navigation',leave);window.removeEventListener('beforeunload',unload)}};
 };}
});
