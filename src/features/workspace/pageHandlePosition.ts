/** All blocks in a column share a gutter, independent of list/table indentation. */
export function pageHandlePosition(block:HTMLElement, editor:HTMLElement, wrapper:HTMLElement){
 const column=block.closest<HTMLElement>('.editor-column-content')??editor;
 const columnRect=column.getBoundingClientRect(),columnStyle=getComputedStyle(column);
 const origin=wrapper.getBoundingClientRect();
 const projected=block.querySelector<HTMLElement>('.personal-table-result');
 const first=projected?(projected.querySelector<HTMLElement>('p,h1,h2,h3,pre,hr')??projected):block.matches('[data-note-tabs]')?block.querySelector<HTMLElement>('[role=tab]')??block:block.matches('[data-toggle-block]')?block.querySelector<HTMLElement>('[data-toggle-title]')??block:block.matches('p,h1,h2,h3,pre,hr')?block:block.querySelector<HTMLElement>('p,h1,h2,h3,pre,hr')??block;
 const rect=first.getBoundingClientRect(),style=getComputedStyle(first);
 const px=(value:string)=>parseFloat(value)||0;
 const line=px(style.lineHeight)||px(style.fontSize)*1.65;
 const center=first.matches('hr')?rect.top+rect.height/2:rect.top+px(style.borderTopWidth)+px(style.paddingTop)+line/2;
 return {
  x:columnRect.left+px(columnStyle.borderLeftWidth)+px(columnStyle.paddingLeft)-origin.left-wrapper.clientLeft+wrapper.scrollLeft-48,
  y:center-origin.top-wrapper.clientTop+wrapper.scrollTop-12,
  right:Math.min(columnRect.right+4,window.innerWidth-32)-origin.left-wrapper.clientLeft+wrapper.scrollLeft,
 };
}
