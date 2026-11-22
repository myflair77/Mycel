import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {extensions} from '../src/features/workspace/pageExtensions';
import {editProjectedCell,findProjectedCell} from '../src/features/workspace/tableProjectionEdit';
import {personalTableRows} from '../src/features/workspace/tablePersonalView';
const schema=getSchema(extensions());
const cell=(id:string,text:string,header=false)=>(header?schema.nodes.tableHeader:schema.nodes.tableCell).create({id},schema.nodes.paragraph.create(null,schema.text(text)));
function fixture(){return EditorState.create({schema,plugins:[history()],doc:schema.nodes.doc.create(null,schema.nodes.table.create({id:'table'},[schema.nodes.tableRow.create(null,[cell('h','Title',true)]),schema.nodes.tableRow.create(null,[cell('first','Zulu')]),schema.nodes.tableRow.create(null,[cell('second','Alpha')])]))})}
it('edits the stable source cell after sorting, retaining source order, other rows and marks; undo restores content',()=>{
 let state=fixture();const prefs={sort:{column:'h',direction:'asc' as const},filters:{}};
 expect(personalTableRows(state.doc.firstChild!,prefs)).toEqual([2,1]);
 const before=findProjectedCell(state.doc,'second')!.node,after=schema.nodes.tableCell.create(before.attrs,schema.nodes.paragraph.create(null,schema.text('Omega',[schema.marks.bold.create()])));
 state=state.apply(editProjectedCell(state,'second',before,after)!);
 expect(state.doc.firstChild!.child(1).firstChild!.textContent).toBe('Zulu');expect(state.doc.firstChild!.child(2).firstChild!.attrs.id).toBe('second');expect(findProjectedCell(state.doc,'second')!.node.firstChild!.firstChild!.marks[0].type.name).toBe('bold');
 undo(state,tr=>{state=state.apply(tr)});expect(findProjectedCell(state.doc,'second')!.node.textContent).toBe('Alpha');
});
it('edits a filtered row without deleting hidden rows and re-evaluates membership',()=>{let state=fixture();const before=findProjectedCell(state.doc,'second')!.node;state=state.apply(editProjectedCell(state,'second',before,cell('second','Changed'))!);expect(personalTableRows(state.doc.firstChild!,{filters:{h:{contains:'Alpha'}}})).toEqual([]);expect(state.doc.firstChild!.childCount).toBe(3);expect(findProjectedCell(state.doc,'first')!.node.textContent).toBe('Zulu')});
it('rejects a deleted or concurrently edited target instead of overwriting unrelated content',()=>{const state=fixture(),before=findProjectedCell(state.doc,'second')!.node;expect(editProjectedCell(state,'missing',before,cell('second','Changed'))).toBeNull();expect(editProjectedCell(state,'first',before,cell('second','Changed'))).toBeNull()});

