type PageSummary = {id:string; title:string; trashed:boolean; permission:number; updated_at:string};

export function pageSearchTerm(input:string) {
  const command = input.trim().match(/^(.*?)\s*(?:페이지|문서)(?:를|을)?\s*(?:찾아|검색해|열어)\s*(?:줘|주세요)?[.!?]?$/u);
  return command ? command[1].trim().replace(/^["'‘“]|["'’”]$/gu,'') : null;
}

export function matchingPages(items:PageSummary[], query:string) {
  const words = query.normalize('NFC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items.filter(item => {
    const title = item.title.normalize('NFC').toLocaleLowerCase();
    return item.permission > 0 && !item.trashed && words.every(word=>title.includes(word));
  }).map(({id,title,updated_at})=>({id,title,updated_at}));
}
