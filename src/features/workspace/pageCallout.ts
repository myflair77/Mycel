import {Node,mergeAttributes} from '@tiptap/core';
import {iconElement} from '../../components/iconValue';
import {showEmojiPicker} from '../../components/emojiPicker';
export const Callout=Node.create({name:'callout',group:'block',content:'block+',defining:true,
 addAttributes(){return {icon:{default:'💡',parseHTML:e=>e.getAttribute('data-callout-icon')??'💡',renderHTML:a=>({'data-callout-icon':a.icon})}}},
 parseHTML:()=>[{tag:'div[data-callout]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-callout':'',class:'note-callout'}),0],
 addNodeView(){return ({node,editor,getPos})=>{let current=node,paintedIcon:string|undefined;const dom=document.createElement('div'),button=document.createElement('button'),contentDOM=document.createElement('div');dom.className='note-callout';dom.dataset.callout='';button.className='note-callout-icon';button.type='button';button.contentEditable='false';button.setAttribute('aria-label','콜아웃 아이콘 변경');contentDOM.className='note-callout-content';dom.append(button,contentDOM);
 const paint=()=>{dom.dataset.blockId=current.attrs.id;if(paintedIcon!==current.attrs.icon){paintedIcon=current.attrs.icon;button.replaceChildren();if(current.attrs.icon)button.append(iconElement(current.attrs.icon));else button.textContent='＋';}button.disabled=!editor.isEditable;button.dataset.empty=String(!current.attrs.icon)};paint();
 button.onmousedown=e=>e.preventDefault();
 button.onclick=()=>{if(!editor.isEditable)return;showEmojiPicker(button,value=>{const pos=getPos();if(!editor.isDestroyed&&editor.isEditable&&typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,icon:value}))},true)};
 return {dom,contentDOM,update(next){if(next.type!==current.type)return false;current=next;paint();return true},stopEvent:e=>button.contains(e.target as globalThis.Node),ignoreMutation:m=>m.target===button||button.contains(m.target)};
 }}
});
