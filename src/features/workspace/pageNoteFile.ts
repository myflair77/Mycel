import {Node,mergeAttributes} from '@tiptap/core';
import {downloadNoteFile} from './noteFiles';
import {fileSize,fileMime,fileName} from '../messages/attachments';
export const NoteFile=Node.create({name:'noteFile',group:'block',atom:true,draggable:true,
 addAttributes(){return {fileId:{default:''},name:{default:'파일'},size:{default:0},mime:{default:'application/octet-stream'},caption:{default:''},width:{default:100}}},
 parseHTML:()=>[{tag:'div[data-note-file]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-note-file':''}),'첨부파일'],
 addNodeView(){return ({node,editor,getPos})=>{
 let current=node,destroyed=false,url='';const dom=document.createElement('div');dom.className='note-file-block';dom.contentEditable='false';dom.dataset.noteFile=node.attrs.fileId;dom.dataset.blockId=node.attrs.id;
 const preview=document.createElement('div'),download=document.createElement('button'),caption=document.createElement('input'),status=document.createElement('small');download.type='button';caption.setAttribute('aria-label','첨부파일 설명');caption.placeholder='설명 추가';caption.maxLength=300;dom.append(preview,download,caption,status);
 const note=()=>dom.closest<HTMLElement>('[data-note-document]')?.dataset.noteDocument;
 const paint=()=>{download.textContent='↓ '+current.attrs.name+' · '+fileSize(Number(current.attrs.size));caption.value=current.attrs.caption;caption.readOnly=!editor.isEditable;caption.hidden=!editor.isEditable&&!current.attrs.caption;preview.style.width=Math.max(20,Math.min(100,Number(current.attrs.width)||100))+'%'};paint();
 caption.onchange=()=>{const pos=getPos();if(editor.isEditable&&typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,caption:caption.value}))};
 download.onclick=async()=>{const id=note();if(!id)return;download.disabled=true;status.textContent='파일을 가져오는 중…';try{const blob=await downloadNoteFile(current.attrs.fileId,id);if(destroyed)return;const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=fileName(current.attrs.name);link.click();setTimeout(()=>URL.revokeObjectURL(href),60000);status.textContent=''}catch(e){status.textContent=(e as Error).message}finally{download.disabled=false}};
 const frame=requestAnimationFrame(async()=>{const id=note();if(!id||!String(current.attrs.mime).startsWith('image/')||Number(current.attrs.size)>20*1024*1024)return;try{const blob=await downloadNoteFile(current.attrs.fileId,id);const mime=await fileMime(blob);if(destroyed||!mime.startsWith('image/'))return;url=URL.createObjectURL(new Blob([blob],{type:mime}));const img=document.createElement('img');img.src=url;img.alt=current.attrs.caption||current.attrs.name;img.loading='lazy';preview.append(img)}catch(e){if(!destroyed)status.textContent=(e as Error).message}});
 return {dom,update(next){if(next.type!==current.type||next.attrs.fileId!==current.attrs.fileId)return false;current=next;paint();return true},stopEvent:()=>true,ignoreMutation:()=>true,destroy(){destroyed=true;cancelAnimationFrame(frame);if(url)URL.revokeObjectURL(url)}};
 };}
});
