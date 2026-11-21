import {Node} from '@tiptap/core';
import {iconElement,parseIcon} from '../../components/iconValue';
export const InlineIcon=Node.create({name:'inlineIcon',group:'inline',inline:true,atom:true,
 addAttributes(){return {value:{default:'icon:Star:default',parseHTML:el=>el.getAttribute('data-inline-icon')}}},
 parseHTML(){return [{tag:'span[data-inline-icon]',getAttrs:el=>parseIcon(el.getAttribute('data-inline-icon'))?{}:false}]},
 renderHTML({node}){return ['span',{'data-inline-icon':node.attrs.value},'◇']},
 renderText({node}){return '['+(parseIcon(node.attrs.value)?.name??'아이콘')+']'},
 addNodeView(){return ({node})=>({dom:iconElement(node.attrs.value),ignoreMutation:()=>true})}
});
export const symbolContent=(value:string)=>parseIcon(value)?{type:'inlineIcon',attrs:{value}}:{type:'text',text:value};
