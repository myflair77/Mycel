import {TableMap} from '@tiptap/pm/tables';
import type {Node as PMNode} from '@tiptap/pm/model';
export const TABLE_COLUMN_MIN=74; // grip 24 + gap 2 + sort 20 + gap 2 + filter 20 + inset 6
export function tableColumnWidths(node:PMNode){const map=TableMap.get(node),widths=Array(map.width).fill(TABLE_COLUMN_MIN);for(const offset of new Set(map.map)){const cell=node.nodeAt(offset)!;const rect=map.findCell(offset);for(let i=0;i<rect.right-rect.left;i++)widths[rect.left+i]=Math.max(widths[rect.left+i],cell.attrs.colwidth?.[i]||0)}return widths as number[]}
export function fitTableColumns(table:HTMLTableElement,widths:number[]){const total=widths.reduce((a,b)=>a+b,0),ratios=widths.map(w=>w/total);table.style.width='100%';table.style.minWidth=(Math.ceil(Math.max(...ratios.map(r=>TABLE_COLUMN_MIN/r)))+2)+'px';Array.from(table.querySelectorAll('col')).forEach((col,i)=>{col.style.width=(ratios[i]*100)+'%';col.style.minWidth='0'})}
