import {createTimeSegments} from './timeSegments';
import {validMentionDate} from './mentionModel';
import {supabase} from '../../services/supabase';
import {dateAttrs,dateFormats,reminderOptions,dateMentionLabel,dateMentionError,dateMentionEndAfterHour,adjustMentionEndAfterStart,dayInZone,type DateMentionAttrs} from './dateMentionModel';
export function openDateMention(anchor:HTMLElement,initial:Record<string,any>,apply:(attrs:Record<string,any>)=>boolean,remove:()=>void){
 let a=dateAttrs(initial),saved=dateAttrs(initial),month=a.target.slice(0,7),dead=false,busy=false,pending=false,closing=false;const popup=document.createElement('form');popup.className='date-mention-popover';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','날짜·시간·리마인더');popup.tabIndex=-1;
 const heading=document.createElement('strong');heading.textContent='날짜·시간';const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='×';closeButton.setAttribute('aria-label','날짜 설정 닫기');closeButton.onclick=()=>close();const header=document.createElement('header');header.append(heading,closeButton);popup.append(header);
 const preview=document.createElement('output');preview.className='date-mention-preview';popup.append(preview);
 const fields=document.createElement('div');fields.className='date-mention-fields';popup.append(fields);
 function dateGroup(title:string){const group=document.createElement('fieldset');group.className='date-mention-range-group';const legend=document.createElement('legend');legend.textContent=title;group.append(legend);fields.append(group);return group}
 const startGroup=dateGroup('시작'),endGroup=dateGroup('종료');
 function field(group:HTMLElement,label:string,el:HTMLElement){const l=document.createElement('label');l.append(document.createTextNode(label),el);group.append(l);el.setAttribute('aria-label',label);return el}
 const date=document.createElement('input');date.type='date';date.required=true;date.value=a.target;field(startGroup,'시작 날짜',date);
 const calendar=document.createElement('div');calendar.className='date-mention-calendar';popup.append(calendar);
 const options=document.createElement('div');popup.append(options);
 function option(label:string,el:HTMLElement){const l=document.createElement('label');l.append(document.createTextNode(label),el);options.append(l);el.setAttribute('aria-label',label);return el}
 function select(label:string,values:readonly (readonly [string,string])[],value:string,onChange:(v:string)=>void){const el=document.createElement('select');for(const [v,t]of values){const o=document.createElement('option');o.value=v;o.textContent=t;el.append(o)}el.value=value;option(label,el);el.onchange=()=>{onChange(el.value);refresh();void persist()};return el}
 function toggle(label:string,checked:boolean,fn:(v:boolean)=>void){const el=document.createElement('input');el.type='checkbox';el.checked=checked;option(label,el);el.onchange=()=>{fn(el.checked);refresh();void persist()};return el}
 const end=toggle('종료일',!!a.endDate,v=>{Object.assign(a,v?dateMentionEndAfterHour(a.target,a.time):{endDate:'',endTime:''})});const endDate=document.createElement('input');endDate.type='date';endDate.value=a.endDate;field(endGroup,'종료 날짜',endDate);
 select('날짜 형식',dateFormats,a.dateFormat,v=>a.dateFormat=v);
 const include=toggle('시간 포함',!!a.time,v=>{a.time=v?'09:00':'';if(v&&a.endDate)Object.assign(a,dateMentionEndAfterHour(a.endDate<a.target?a.target:a.endDate,a.time));else a.endTime='';drawTime()});
 const startTimeFields=document.createElement('div'),endTimeFields=document.createElement('div');startGroup.append(startTimeFields);endGroup.append(endTimeFields);
 function drawTime(){
  startTimeFields.replaceChildren();endTimeFields.replaceChildren();if(!a.time)return;
  let endControl:ReturnType<typeof createTimeSegments>|undefined;
  for(const isEnd of [false,...(a.endDate?[true]:[])]){
   const label=document.createElement('div');label.className='date-time-row';const title=isEnd?'종료 시각':'시작 시각';label.append(document.createTextNode(title));
   const control=createTimeSegments(title,isEnd?a.endTime||a.time:a.time,a.timeFormat,value=>{
    if(isEnd)a.endTime=value;else {a.time=value;if(adjustMentionEndAfterStart(a)){endDate.value=a.endDate;endControl?.setValue(a.endTime)}}
    preview.textContent='@'+dateMentionLabel(a);void persist();
   });
   if(isEnd)endControl=control;label.append(control.element);(isEnd?endTimeFields:startTimeFields).append(label);
  }
 }
 select('시간 형식',[['hidden','숨김'],['12','12시간'],['24','24시간']],a.timeFormat,v=>{a.timeFormat=v;drawTime()});
 const zones=Array.from(new Set(['Asia/Seoul','UTC',a.timeZone,Intl.DateTimeFormat().resolvedOptions().timeZone,...Intl.supportedValuesOf('timeZone')]));select('시간대',zones.map(z=>[z,z==='Asia/Seoul'?'서울 · GMT+9':z] as const),a.timeZone,v=>a.timeZone=v);
 const reminder=select('리마인더',reminderOptions,a.reminder,v=>a.reminder=v);
 const info=document.createElement('small');info.textContent='리마인더를 설정한 본인에게 알립니다. 날짜만 지정한 경우 09:00 기준입니다.';popup.append(info);const error=document.createElement('p');error.setAttribute('role','alert');popup.append(error);
 const actions=document.createElement('footer');const del=document.createElement('button');del.type='button';del.textContent='날짜 언급 삭제';del.onclick=()=>{remove();close()};const status=document.createElement('span');status.setAttribute('role','status');actions.append(del,status);popup.append(actions);
 const drawCalendar=()=>{calendar.replaceChildren();const [y,m]=month.split('-').map(Number),head=document.createElement('header');const prev=document.createElement('button'),next=document.createElement('button'),now=document.createElement('button'),title=document.createElement('strong');title.textContent=`${y}년 ${m}월`;prev.type=next.type=now.type='button';prev.textContent='‹';next.textContent='›';now.textContent='오늘';prev.setAttribute('aria-label','이전 달');next.setAttribute('aria-label','다음 달');const shift=(n:number)=>{const d=new Date(Date.UTC(y,m-1+n,1));month=d.toISOString().slice(0,7);drawCalendar()};prev.onclick=()=>shift(-1);next.onclick=()=>shift(1);now.onclick=()=>{a.target=dayInZone(new Date(),a.timeZone);date.value=a.target;month=a.target.slice(0,7);adjustMentionEndAfterStart(a);refresh();void persist()};head.append(title,now,prev,next);calendar.append(head);const grid=document.createElement('div');grid.className='date-calendar-grid';for(const day of ['일','월','화','수','목','금','토']){const label=document.createElement('small');label.textContent=day;grid.append(label)}const offset=new Date(Date.UTC(y,m-1,1)).getUTCDay();for(let i=0;i<42;i++){const d=new Date(Date.UTC(y,m-1,i-offset+1)),value=d.toISOString().slice(0,10),b=document.createElement('button');b.type='button';b.textContent=String(d.getUTCDate());b.setAttribute('aria-label',value);b.setAttribute('aria-pressed',String(value===a.target));if(d.getUTCMonth()!==m-1)b.classList.add('outside-month');if(value===dayInZone(new Date(),a.timeZone))b.classList.add('today');b.onclick=()=>{a.target=value;date.value=value;adjustMentionEndAfterStart(a);refresh();void persist()};grid.append(b)}calendar.append(grid)};
 const position=()=>{if(dead)return;const r=anchor.getBoundingClientRect(),v=visualViewport,x=v?.offsetLeft??0,y=v?.offsetTop??0,w=v?.width??innerWidth,h=v?.height??innerHeight;popup.style.maxHeight=Math.max(120,h-24)+'px';popup.style.width=Math.min(360,w-24)+'px';popup.style.left=Math.max(x+12,Math.min(r.left,x+w-popup.offsetWidth-12))+'px';popup.style.top=Math.max(y+12,Math.min(r.bottom+8,y+h-popup.offsetHeight-12))+'px'};
 function refresh(){endGroup.hidden=!a.endDate;endDate.value=a.endDate;preview.textContent='@'+dateMentionLabel(a)+(a.reminder!=='none'?' ◷':'');drawTime();drawCalendar();position()}
 date.onchange=()=>{a.target=date.value;if(validMentionDate(date.value)){month=date.value.slice(0,7);adjustMentionEndAfterStart(a);refresh();void persist()}};endDate.onchange=()=>{a.endDate=endDate.value;refresh();void persist()};
 async function persist(){
  if(dead)return;pending=true;if(busy)return;
  busy=true;
  try{while(pending&&!dead){
   pending=false;const snapshot={...a};error.textContent=dateMentionError(snapshot);
   if(error.textContent||!popup.checkValidity()){status.textContent='입력 확인 필요';closing=false;return}
   if(JSON.stringify(snapshot)===JSON.stringify(saved)){status.textContent='저장됨';continue}
   status.textContent='저장 중…';
   const changed=['target','time','timeZone','reminder'].some(k=>snapshot[k]!==saved[k]);let update:Record<string,any>={...snapshot,label:dateMentionLabel(snapshot)};
   if(snapshot.reminder!=='none'&&changed){const {data,error:err}=await supabase!.rpc('date_reminder_preview',{p_attrs:snapshot});if(err)throw err;update.reminderUserId=data.user_id;update.reminderRevision=crypto.randomUUID()}
   else if(snapshot.reminder==='none'){update.reminderUserId='';update.reminderRevision=''}
   if(dead)return;if(pending)continue;
   if(!apply(update))throw Error('편집 권한 또는 날짜 위치가 변경되었습니다.');
   Object.assign(a,{reminderUserId:update.reminderUserId,reminderRevision:update.reminderRevision});saved={...a};status.textContent='저장됨';
  }}catch(e){if(!dead){error.textContent=(e as Error).message||'설정을 저장하지 못했습니다.';status.textContent='저장 실패';closing=false}}
  finally{busy=false;if(pending&&!dead)void persist();else if(closing)close()}
 }
 popup.onsubmit=e=>{e.preventDefault();(document.activeElement as HTMLElement)?.blur();void persist()};
 function dismiss(){if(popup.contains(document.activeElement))(document.activeElement as HTMLElement).blur();closing=true;void persist()}
 closeButton.onclick=dismiss;
 const outside=(e:PointerEvent)=>{if(!popup.contains(e.target as Node)&&!anchor.contains(e.target as Node))dismiss()},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();dismiss();anchor.focus()}};
 function close(){if(dead)return;dead=true;popup.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',position);visualViewport?.removeEventListener('resize',position);visualViewport?.removeEventListener('scroll',position);document.removeEventListener('scroll',position,true)}
 document.body.append(popup);refresh();document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',position);visualViewport?.addEventListener('resize',position);visualViewport?.addEventListener('scroll',position);document.addEventListener('scroll',position,true);popup.focus({preventScroll:true});return close;
}