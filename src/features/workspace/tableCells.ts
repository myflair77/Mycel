import {CellSelection} from '@tiptap/pm/tables';
import type {EditorState,Command} from '@tiptap/pm/state';
export function selectedCells(state:EditorState):number[]{
 const selection=state.selection;
 if(selection instanceof CellSelection){const positions:number[]=[];selection.forEachCell((_node,pos)=>positions.push(pos));return positions}
 const {$from}=selection;for(let d=$from.depth;d>0;d--)if(['tableCell','tableHeader'].includes($from.node(d).type.name))return [$from.before(d)];return [];
}
// Replace only the inside of each cell: spans, widths, colors and identities survive.
export const clearCellContents:Command=(state,dispatch)=>{
 const positions=selectedCells(state);if(!positions.length)return false;
 if(dispatch){const tr=state.tr;for(const pos of positions.sort((a,b)=>b-a)){const cell=state.doc.nodeAt(pos)!;tr.replaceWith(pos+1,pos+cell.nodeSize-1,state.schema.nodes.paragraph.create())}dispatch(tr)}return true;
};
