import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {extensions} from '../src/features/workspace/pageExtensions';
import {blockTextMap,quoteInBlock,textRangeSpans} from '../src/features/workspace/pageTextMap';
import {plain} from '../src/features/workspace/pageDocument';
import {tableColumnWidths,TABLE_COLUMN_MIN} from '../src/features/workspace/tableColumnLayout';
const s=getSchema(extensions());
const cell=(text:string,width=80)=>s.nodes.tableCell.create({colwidth:[width]},s.nodes.paragraph.create(null,s.text(text)));
it('maps nested table text to persisted plain text and codepoint quote offsets',()=>{
 const table=s.nodes.table.create({id:'table'},[s.nodes.tableRow.create(null,[cell('A😀B'),cell('한국어')]),s.nodes.tableRow.create(null,[cell('Zulu'),cell('Alpha')])]);
 const map=blockTextMap(table,10);expect(map.text).toBe(plain(table.toJSON()));const index=map.text.indexOf('한국어'),span=map.ranges[index]!;
 const q=quoteInBlock(table,10,span.from,span.from+3)!;expect(q.quote).toBe('한국어');expect(q.start).toBe(Array.from(map.text.slice(0,index)).length);expect(q.end-q.start).toBe(3);
 expect(textRangeSpans(table,10,index,index+3)).toEqual([{from:span.from,to:span.from+3}]);
 expect(textRangeSpans(table,10,0,map.text.length)).toHaveLength(4);
});
it('retains stored column ratios and clamps minimum column widths',()=>{const table=s.nodes.table.create(null,[s.nodes.tableRow.create(null,[cell('a',20),cell('b',180)])]);expect(tableColumnWidths(table)).toEqual([TABLE_COLUMN_MIN,180])});
