import {loadEmojiCatalog} from './emojiCatalog';
import {iconColors,iconPreference,loadIconCatalog,iconElement} from './iconValue';
type Emoji={unicode:string;label:string;group?:number;order?:number;tags?:string[];skins?:Emoji[]};
type Choice={value:string;label:string;category:string;search:string;skins?:Emoji[]};
const read=(key:string):string[]=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return []}};
const save=(key:string,value:unknown)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const prefKey='mycel-icon-preferences';
const getPreference=()=>{try{return iconPreference(JSON.parse(localStorage.getItem(prefKey)||'{}'))}catch{return iconPreference(null)}};
const categories:[string,RegExp,string][]=[
 ['문서·업무',/File|Folder|Book|Notebook|Clipboard|Calendar|Briefcase|Chart|Table|List|Archive/,'문서 파일 폴더 책 노트 일정 업무 표 목록'],
 ['사람·소통',/User|Person|Contact|Message|Mail|Phone|Speech|Heart|Smile|Hand/,'사람 사용자 대화 메시지 메일 전화 하트 웃음 손'],
 ['자연·생활',/Sun|Moon|Cloud|Tree|Flower|Leaf|Bird|Cat|Dog|Fish|Bug|Mountain|Waves|Apple|Coffee|Utensils/,'자연 해 달 날씨 나무 꽃 동물 음식 커피'],
 ['이동·장소',/Car|Bus|Train|Plane|Ship|Bike|Map|Pin|House|Building|Church|Tent/,'자동차 버스 기차 비행기 이동 지도 핀 집 건물 장소'],
 ['도구·미디어',/Camera|Video|Music|Mic|Volume|Monitor|Laptop|Computer|Keyboard|Mouse|Wrench|Hammer|Settings|Cog/,'카메라 영상 음악 마이크 소리 컴퓨터 도구 설정'],
 ['기호',/Arrow|Chevron|Circle|Square|Triangle|Check|X$|Plus|Minus|Star|Flag|Lock|Key|Link|Search/,'화살표 원 네모 세모 체크 별 깃발 잠금 열쇠 링크 검색']
];
let dismiss:(()=>void)|undefined;
/** Text inputs accept Unicode; rich editors and representative icons explicitly opt into icons. */
export function showEmojiPicker(anchor:HTMLElement,onSelect:(value:string)=>void,remove=false,options:{icons?:boolean;initial?:'emoji'|'icon'}={}){
 dismiss?.();const allowIcons=remove||options.icons===true;
 const dialog=document.createElement('dialog');dialog.className='mycel-emoji-picker';dialog.setAttribute('aria-label','이모지와 아이콘 선택');
 const header=document.createElement('header'),tabs=document.createElement('div');tabs.className='symbol-tabs';tabs.setAttribute('role','tablist');
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','아이콘 선택 닫기');header.append(tabs,close);
 const tools=document.createElement('div');tools.className='symbol-tools';
 const search=document.createElement('input');search.type='search';search.placeholder='검색';search.setAttribute('aria-label','아이콘 검색');
 const random=document.createElement('button');random.type='button';random.textContent='⤨';random.setAttribute('aria-label','무작위 선택');
 const color=document.createElement('button');color.type='button';color.setAttribute('aria-label','아이콘 색상 설정');color.setAttribute('aria-expanded','false');tools.append(search,random,color);
 const groupBar=document.createElement('div');groupBar.className='emoji-categories';
 const extras=document.createElement('div');extras.className='symbol-extras';
 const favoritesLabel=document.createElement('label'),favoriteMode=document.createElement('input');favoriteMode.type='checkbox';favoritesLabel.append(favoriteMode,' 즐겨찾기 편집');
 const tone=document.createElement('select');tone.setAttribute('aria-label','이모지 피부색');['기본 피부색','밝은 피부','연한 갈색 피부','갈색 피부','진한 갈색 피부','어두운 피부'].forEach((label,i)=>tone.add(new Option(label,String(i))));
 extras.append(favoritesLabel,tone);
 const grid=document.createElement('div');grid.className='emoji-grid';grid.setAttribute('aria-label','선택 목록');
 const palette=document.createElement('div');palette.className='icon-color-popover';palette.hidden=true;palette.setAttribute('role','dialog');palette.setAttribute('aria-label','아이콘 색상');palette.addEventListener('click',e=>e.stopPropagation());
 let tab:'emoji'|'icon'|'upload'=options.initial??'emoji',group='전체',disposed=false,choices:Choice[]=[],visible:Choice[]=[],emojiChoices:Choice[]=[],iconChoices:Choice[]=[];
 let pref=getPreference(),pending:Choice|null=null;
 const cleanup=()=>{disposed=true;dialog.close();dialog.remove();if(dismiss===cleanup)dismiss=undefined;if(anchor.isConnected)anchor.focus({preventScroll:true})};dismiss=cleanup;close.onclick=cleanup;
 const hidePalette=()=>{palette.hidden=true;pending=null;color.setAttribute('aria-expanded','false')};
 dialog.oncancel=e=>{e.preventDefault();if(!palette.hidden)hidePalette();else cleanup()};
 dialog.addEventListener('click',e=>{if(!palette.hidden&&!palette.contains(e.target as Node)&&!color.contains(e.target as Node)&&!(e.target as HTMLElement).closest('.emoji-grid button'))hidePalette();if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cleanup()}});
 const pick=(value:string)=>{const key=tab==='icon'?'mycel-icon-recent':'mycel-emoji-recent';if(!value.startsWith('data:'))save(key,[value,...read(key).filter(x=>x!==value)].slice(0,24));cleanup();onSelect(value)};
 const choose=(item:Choice)=>{if(favoriteMode.checked){const key=tab==='icon'?'mycel-icon-favorites':'mycel-emoji-favorites',favorites=read(key);save(key,favorites.includes(item.value)?favorites.filter(x=>x!==item.value):[...favorites,item.value]);paint();return}if(tab==='icon'){if(pref.ask){pending=item;showPalette();return}pick('icon:'+item.value+':'+pref.color)}else pick(tone.value!=='0'&&item.skins?.[Number(tone.value)-1]?item.skins[Number(tone.value)-1].unicode:item.value)};
 function showPalette(){palette.replaceChildren();palette.hidden=false;color.setAttribute('aria-expanded','true');
  const title=document.createElement('small');title.textContent=pending?pending.label+' · 색상 선택':'기본 아이콘 색상';palette.append(title);
  const swatches=document.createElement('div');swatches.className='icon-swatches';
  for(const c of iconColors){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',c.label);b.setAttribute('aria-pressed',String(pref.color===c.id));b.title=c.label;
   if(pending)b.append(iconElement('icon:'+pending.value+':'+c.id));else{const dot=document.createElement('span');dot.className='color-dot';dot.style.background=c.hex;b.append(dot)}
   b.onclick=()=>{if(pending){const item=pending;hidePalette();pick('icon:'+item.value+':'+c.id)}else{pref={...pref,color:c.id};save(prefKey,pref);paint();showPalette()}};swatches.append(b)}
  palette.append(swatches);
  if(!pending){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=pref.ask;input.onchange=()=>{pref={...pref,ask:input.checked};save(prefKey,pref)};label.append('매번 선택하기',input);palette.append(label)}
 }
 function paint(){if(disposed)return;choices=tab==='icon'?iconChoices:emojiChoices;tools.hidden=tab==='upload';groupBar.hidden=tab==='upload';extras.hidden=tab==='upload';color.hidden=tab!=='icon';tone.hidden=tab!=='emoji';
  for(const b of Array.from(tabs.children))b.setAttribute('aria-selected',String((b as HTMLElement).dataset.tab===tab));
  color.style.color=iconColors.find(c=>c.id===pref.color)!.hex;color.textContent='●';grid.replaceChildren();
  if(tab==='upload'){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';input.setAttribute('aria-label','대표 아이콘 이미지');const hint=document.createElement('p');hint.textContent='PNG, JPG, WebP, GIF · 5MB 이하. 작은 대표 이미지로 저장됩니다.';
   input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('5MB 이하의 이미지 파일을 선택해 주세요.');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!;const scale=Math.min(128/bitmap.width,128/bitmap.height);ctx.drawImage(bitmap,(128-bitmap.width*scale)/2,(128-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();const value=canvas.toDataURL('image/png');if(value.length>70000)throw new Error('더 단순한 이미지를 선택해 주세요.');if(!disposed)pick(value)}catch(e){hint.textContent=(e as Error).message}};grid.append(input,hint);return}
  const query=search.value.trim().toLowerCase(),prefix=tab==='icon'?'mycel-icon':'mycel-emoji',favorites=read(prefix+'-favorites'),recent=read(prefix+'-recent').map(v=>tab==='icon'?v.split(':')[1]:v);
  visible=choices.filter(c=>(group==='전체'||group===c.category||group==='최근'&&recent.includes(c.value)||group==='즐겨찾기'&&favorites.includes(c.value))&&(!query||c.search.toLowerCase().includes(query)));
  if(group==='최근')visible.sort((a,b)=>recent.indexOf(a.value)-recent.indexOf(b.value));
  const fragment=document.createDocumentFragment();for(const item of visible){const b=document.createElement('button');b.type='button';b.title=item.label;b.setAttribute('aria-label',item.label);b.className=favorites.includes(item.value)?'is-favorite':'';
   if(tab==='icon')b.append(iconElement('icon:'+item.value+':'+pref.color));else b.textContent=tone.value!=='0'&&item.skins?.[Number(tone.value)-1]?item.skins[Number(tone.value)-1].unicode:item.value;
   b.onclick=()=>choose(item);fragment.append(b)}grid.append(fragment);
  if(!visible.length){const p=document.createElement('p');p.textContent=choices.length?'검색 결과가 없습니다.':'불러오는 중…';grid.append(p)}
 }
 function setTab(next:typeof tab){tab=next;group='전체';search.value='';hidePalette();groupBar.replaceChildren();const names=tab==='icon'?categories.map(c=>c[0]).concat('기타'):['웃는 얼굴과 감정','사람과 몸','구성 요소','동물과 자연','음식 및 음료','여행 및 장소','활동','사물','기호','깃발'];
  for(const name of ['전체','최근','즐겨찾기',...names]){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-pressed',String(name===group));b.onclick=()=>{group=name;for(const other of Array.from(groupBar.children))other.setAttribute('aria-pressed',String(other===b));paint();grid.scrollTop=0};groupBar.append(b)}paint();
 }
 for(const [id,label] of [['emoji','이모지'],...(allowIcons?[['icon','아이콘']]:[]),...(remove?[['upload','업로드']]:[])] as [typeof tab,string][]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.tab=id;b.setAttribute('role','tab');b.onclick=()=>setTab(id);tabs.append(b)}
 search.oninput=()=>{hidePalette();paint()};favoriteMode.onchange=paint;tone.onchange=paint;color.onclick=()=>{if(!palette.hidden&&!pending)hidePalette();else{pending=null;showPalette()}};random.onclick=()=>{if(visible.length)choose(visible[Math.floor(Math.random()*visible.length)])};
 grid.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=Array.from(grid.querySelectorAll('button')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;const columns=Math.max(1,Math.floor(grid.clientWidth/(buttons[0].getBoundingClientRect().width+4)));const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:index+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-columns:columns);e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,next))]?.focus()};
 dialog.append(header,tools,groupBar,extras,grid,palette);
 if(remove){const b=document.createElement('button');b.type='button';b.className='symbol-remove';b.textContent='제거';b.onclick=()=>pick('');header.insertBefore(b,close)}
 (document.querySelector('.app')??document.body).append(dialog);setTab(tab);dialog.showModal();search.focus();
 void Promise.all([loadEmojiCatalog(),import('emojibase-data/ko/messages.json')]).then(([data,messages])=>{emojiChoices=data.map(e=>({value:e.unicode,label:e.label,category:messages.default.groups.find(g=>g.order===e.group)?.message??'기호',search:e.search,skins:e.skins}));paint()}).catch(()=>{grid.textContent='이모지를 불러오지 못했습니다. 다시 열어 주세요.'});
 if(allowIcons)void loadIconCatalog().then(({icons})=>{const seen=new Set<string>();iconChoices=Object.entries(icons).filter(([,node])=>{const key=JSON.stringify(node);if(seen.has(key))return false;seen.add(key);return true}).map(([name])=>{const match=categories.find(c=>c[1].test(name));return {value:name,label:name.replace(/([a-z])([A-Z])/g,'$1 $2'),category:match?.[0]??'기타',search:name+' '+name.replace(/([a-z])([A-Z])/g,'$1 $2')+' '+(match?.[2]??'')}});paint()}).catch(()=>{grid.textContent='아이콘을 불러오지 못했습니다. 다시 열어 주세요.'});
 return cleanup;
}
export function insertEmojiText(value:string,start:number,end:number,emoji:string,maxLength=Infinity){const next=value.slice(0,start)+emoji+value.slice(end);return next.length<=maxLength?{value:next,cursor:start+emoji.length}:null}
