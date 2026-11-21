import {it,expect} from 'vitest';
import {getSchema} from '@tiptap/core';
import {EditorState} from '@tiptap/pm/state';
import {extensions,blockMenuKey} from '../src/features/workspace/pageExtensions';
import {convertBlock} from '../src/features/workspace/pageConversion';
const schema=getSchema(extensions());
const p=(text:string,id:string|null=null)=>schema.nodes.paragraph.create({id},schema.text(text,[schema.marks.bold.create(),schema.marks.link.create({href:'https://example.com'})]));
const state=(content:any[])=>EditorState.create({schema,doc:schema.nodes.doc.create(null,content)});
it('converts rich paragraphs into each heading, list, quote and toggle without losing text or marks',()=>{
 for(const target of ['h1','h2','h3','bullet','number','check','quote','toggle','toggle1','toggle2','toggle3'] as const){let s=state([p('Rich title','original'),p('Following','next')]);expect(convertBlock(s,0,target,'original',tr=>s=s.apply(tr))).toBe(true);s.doc.check();expect(s.doc.textContent).toBe('Rich titleFollowing');expect(s.doc.firstChild!.attrs.id).toBe('original');let marked=false;s.doc.firstChild!.descendants(n=>{if(n.isText&&n.text==='Rich title')marked=n.marks.length===2});expect(marked).toBe(true)}
});
it('unwraps a collapsed toggle while preserving nested table, attachments and formatting',()=>{
 const table=schema.nodes.table.create(null,schema.nodes.tableRow.create(null,schema.nodes.tableCell.create({colspan:2},p('Cell'))));
 const file=schema.nodes.noteFile.create({fileId:'file-id',name:'guide.pdf'});
 const toggle=schema.nodes.toggleBlock.create({id:'toggle',open:false},[schema.nodes.toggleTitle.create(null,p('Title').content),schema.nodes.toggleBody.create(null,[table,file])]);let s=state([toggle]);
 expect(convertBlock(s,0,'h2','toggle',tr=>s=s.apply(tr))).toBe(true);s.doc.check();expect(s.doc.child(1).eq(table)).toBe(true);expect(s.doc.child(2).eq(file)).toBe(true);expect(s.doc.firstChild!.attrs.id).toBe('toggle');
});
it('converts only the middle numbered item and keeps adjacent numbering and nested items',()=>{
 const item=(text:string,id:string)=>schema.nodes.listItem.create({id},p(text));const list=schema.nodes.orderedList.create({id:'list',start:4},[item('A','a'),item('B','b'),item('C','c')]);let s=state([list]);
 expect(convertBlock(s,1+list.child(0).nodeSize,'toggle','b',tr=>s=s.apply(tr))).toBe(true);s.doc.check();expect(s.doc.childCount).toBe(3);expect(s.doc.child(0).attrs.start).toBe(4);expect(s.doc.child(2).attrs.start).toBe(6);expect(s.doc.child(1).attrs.id).toBe('b');expect(s.doc.textContent).toBe('ABC');
});
it('retains checkbox state when already selected and rejects destructive table conversion',()=>{
 const item=schema.nodes.taskItem.create({checked:true,id:'task'},p('Done'));let s=state([schema.nodes.taskList.create({id:'tasks'},item)]);expect(convertBlock(s,1,'check','tasks',tr=>s=s.apply(tr))).toBe(true);expect(s.doc.firstChild!.firstChild!.attrs.checked).toBe(true);
 const table=schema.nodes.table.createAndFill()!;s=state([table]);expect(convertBlock(s,0,'text','table')).toBe(false);
});
