const groups:Record<string,string[]>={
 '표정':['😀 웃음','😊 미소','😂 기쁨','😍 사랑','🤔 생각','😎 멋짐','😢 슬픔','😴 잠','🥳 축하','🙏 감사','👍 좋아요','👏 박수'],
 '업무':['📋 업무','📅 일정','📝 노트','📄 문서','📁 폴더','📌 고정','💡 아이디어','🎯 목표','✅ 완료','🔍 검색','💬 대화','📊 통계','📈 증가','💻 컴퓨터','📞 전화','✉️ 메일','🔔 알림','⏰ 시간','🔒 잠금','🔑 열쇠'],
 '자연':['🌱 새싹','🌳 나무','🌸 꽃','☀️ 해','🌙 달','⭐ 별','🔥 불','💧 물','🌈 무지개','🐶 강아지','🐱 고양이','🦋 나비'],
 '사물':['🏠 집','🏢 사무실','🏫 학교','🚗 자동차','✈️ 비행기','☕ 커피','🍎 사과','🎁 선물','📚 책','🎨 미술','🎵 음악','🏆 상'],
 '기호':['❤️ 하트','💙 파랑 하트','🟢 초록','🔴 빨강','🟡 노랑','✔️ 체크','❗ 중요','❓ 질문','➡️ 오른쪽','⬅️ 왼쪽','➕ 더하기','➖ 빼기','⚠️ 주의','🔗 링크']
};
const all=Object.entries(groups).flatMap(([category,entries])=>entries.map(entry=>({emoji:entry.split(' ')[0],label:entry.slice(entry.indexOf(' ')+1),category})));
const read=(key:string):string[]=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return []}};
const save=(key:string,value:string[])=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let dismiss:(()=>void)|undefined;
export function showEmojiPicker(anchor:HTMLElement,onSelect:(emoji:string)=>void,remove=false){
 dismiss?.();const dialog=document.createElement('dialog');dialog.className='mycel-emoji-picker';dialog.setAttribute('aria-label','아이콘 선택');
 const header=document.createElement('header'),heading=document.createElement('strong'),close=document.createElement('button');heading.textContent='아이콘';close.textContent='×';close.type='button';close.setAttribute('aria-label','아이콘 선택 닫기');header.append(heading,close);
 const search=document.createElement('input');search.type='search';search.placeholder='아이콘 검색';search.setAttribute('aria-label','아이콘 검색');
 const categories=document.createElement('div');categories.className='emoji-categories';const grid=document.createElement('div');grid.className='emoji-grid';grid.setAttribute('aria-label','아이콘 목록');
 const favoriteLabel=document.createElement('label'),favoriteMode=document.createElement('input');favoriteMode.type='checkbox';favoriteLabel.append(favoriteMode,' 즐겨찾기 편집');
 const cleanup=()=>{dialog.close();dialog.remove();if(dismiss===cleanup)dismiss=undefined;anchor.isConnected&&anchor.focus({preventScroll:true})};dismiss=cleanup;close.onclick=cleanup;dialog.oncancel=e=>{e.preventDefault();cleanup()};dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cleanup()}};
 let category='전체';const recentKey='mycel-emoji-recent',favoriteKey='mycel-emoji-favorites';
 const paint=()=>{grid.replaceChildren();for(const button of Array.from(categories.children))button.setAttribute('aria-pressed',String(button.textContent===category));const query=search.value.trim().toLowerCase(),favorites=read(favoriteKey),recent=read(recentKey);
 let choices=all.filter(e=>(category==='전체'||category===e.category||category==='최근'&&recent.includes(e.emoji)||category==='즐겨찾기'&&favorites.includes(e.emoji))&&(!query||(e.emoji+' '+e.label).includes(query)));
 if(category==='최근')choices.sort((a,b)=>recent.indexOf(a.emoji)-recent.indexOf(b.emoji));
 for(const item of choices){const b=document.createElement('button');b.type='button';b.textContent=item.emoji;b.title=item.label;b.setAttribute('aria-label',item.label+(favorites.includes(item.emoji)?' · 즐겨찾기':''));b.className=favorites.includes(item.emoji)?'is-favorite':'';b.onclick=()=>{if(favoriteMode.checked){save(favoriteKey,favorites.includes(item.emoji)?favorites.filter(e=>e!==item.emoji):[...favorites,item.emoji]);paint();return}save(recentKey,[item.emoji,...recent.filter(e=>e!==item.emoji)].slice(0,24));cleanup();onSelect(item.emoji)};grid.append(b)}
 if(!choices.length){const empty=document.createElement('p');empty.textContent='표시할 아이콘이 없습니다.';grid.append(empty)}};
 for(const name of ['전체','최근','즐겨찾기',...Object.keys(groups)]){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>{category=name;paint()};categories.append(b)}
 search.oninput=paint;favoriteMode.onchange=paint;dialog.append(header,search,categories,favoriteLabel,grid);
 if(remove){const b=document.createElement('button');b.type='button';b.textContent='아이콘 제거';b.onclick=()=>{cleanup();onSelect('')};dialog.append(b)}
 (document.querySelector('.app')??document.body).append(dialog);paint();dialog.showModal();search.focus();return cleanup;
}
export function insertEmojiText(value:string,start:number,end:number,emoji:string,maxLength=Infinity){const next=value.slice(0,start)+emoji+value.slice(end);return next.length<=maxLength?{value:next,cursor:start+emoji.length}:null}
