export const iconColors = [
 {id:'default',label:'기본',hex:'#555550'},{id:'gray',label:'회색',hex:'#a5a39b'},
 {id:'brown',label:'갈색',hex:'#946f57'},{id:'yellow',label:'노랑',hex:'#bd9440'},
 {id:'orange',label:'주황',hex:'#c57829'},{id:'green',label:'초록',hex:'#588466'},
 {id:'blue',label:'파랑',hex:'#527da7'},{id:'purple',label:'보라',hex:'#8d68ac'},
 {id:'pink',label:'분홍',hex:'#af538e'},{id:'red',label:'빨강',hex:'#bd534a'}
] as const;
export type IconColor = typeof iconColors[number]['id'];
export function parseIcon(value:unknown){
 if(typeof value!=='string')return null;
 const m=/^icon:([A-Z][A-Za-z0-9]{0,79}):([a-z]+)$/.exec(value);
 const color=m&&iconColors.find(c=>c.id===m[2]);
 return m&&color?{name:m[1],color}:null;
}
export const isUploadedIcon=(value:unknown):boolean=>typeof value==='string'&&value.length<=70000&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value);
export function iconPreference(value:unknown):{color:IconColor;ask:boolean}{
 const p=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return {color:iconColors.find(c=>c.id===p.color)?.id??'default',ask:p.ask===true};
}
let catalog:Promise<typeof import('lucide')>|undefined;
export const loadIconCatalog=()=>catalog??=import('lucide');
export function iconElement(value:string,fallback='📄'){
 const el=document.createElement('span');el.className='mycel-icon';
 const parsed=parseIcon(value);
 if(parsed){
  el.textContent='◇';el.setAttribute('aria-label',parsed.name+' · '+parsed.color.label);
  void loadIconCatalog().then(({icons,createElement})=>{
   if(!Object.hasOwn(icons,parsed.name))return;
   const svg=createElement(icons[parsed.name as keyof typeof icons]);svg.setAttribute('aria-hidden','true');
   svg.setAttribute('width','1em');svg.setAttribute('height','1em');svg.style.color=parsed.color.hex;
   el.replaceChildren(svg);
  }).catch(()=>{});
 }else if(isUploadedIcon(value)){const image=document.createElement('img');image.src=value;image.alt='사용자 아이콘';el.append(image)}
 else el.textContent=value?.startsWith('icon:')||value?.startsWith('data:')?fallback:value||fallback;
 return el;
}
