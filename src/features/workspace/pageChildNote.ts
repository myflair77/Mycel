import {Node,mergeAttributes} from '@tiptap/core';
export const ChildNote=Node.create({name:'childNote',group:'block',atom:true,draggable:true,selectable:true,
 addAttributes(){return {noteId:{default:'',parseHTML:e=>e.getAttribute('data-note-id'),renderHTML:a=>({'data-note-id':a.noteId})}}},
 parseHTML:()=>[{tag:'div[data-child-note]'}],renderHTML:({HTMLAttributes})=>['div',mergeAttributes(HTMLAttributes,{'data-child-note':''}),'하위 노트'],
 addNodeView(){return ({node})=>{const dom=document.createElement('div');dom.className='child-note-block';dom.dataset.childNote='';dom.contentEditable='false';const button=document.createElement('button');button.type='button';button.dataset.childNoteOpen=node.attrs.noteId;button.textContent='📄 하위 노트 열기';dom.dataset.blockId=node.attrs.id;dom.append(button);return {dom,stopEvent:()=>true,ignoreMutation:()=>true}}}
});
