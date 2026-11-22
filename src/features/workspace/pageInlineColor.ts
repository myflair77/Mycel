import {Mark} from '@tiptap/core';
import {TextSelection,type EditorState,type Transaction} from '@tiptap/pm/state';
import {blockColors} from './pageBlockAppearance';
export type InlineColorField='text'|'background';
const color=(value:unknown)=>blockColors.find(c=>c.id===value&&c.id!=='default');
export const InlineColor=Mark.create({name:'inlineColor',
 addAttributes(){return {text:{default:null},background:{default:null}}},
 parseHTML(){return [{tag:'span[data-inline-color]',getAttrs:el=>({text:color(el.getAttribute('data-text-color'))?.id??null,background:color(el.getAttribute('data-background-color'))?.id??null})}]},
 renderHTML({mark}){const text=color(mark.attrs.text),background=color(mark.attrs.background);return ['span',{'data-inline-color':'','data-text-color':text?.id,'data-background-color':background?.id,style:(text?'color:'+text.hex+';':'')+(background?'background-color:'+background.background+';':'')},0]}
});
/** Change only the selected range and one color channel, preserving other marks/colors. */
export function applyInlineColor(state:EditorState,field:InlineColorField,value:string,dispatch?:(tr:Transaction)=>void){
 if(!(state.selection instanceof TextSelection)||state.selection.empty||!blockColors.some(c=>c.id===value))return false;
 const type=state.schema.marks.inlineColor;if(!type)return false;const {from,to}=state.selection,tr=state.tr;
 state.doc.nodesBetween(from,to,(node,pos)=>{if(!node.isText)return;const old=type.isInSet(node.marks),attrs={text:old?.attrs.text??null,background:old?.attrs.background??null,[field]:value==='default'?null:value};const start=Math.max(from,pos),end=Math.min(to,pos+node.nodeSize);tr.removeMark(start,end,type);if(attrs.text||attrs.background)tr.addMark(start,end,type.create(attrs));});
 if(dispatch)dispatch(tr);return true;
}
