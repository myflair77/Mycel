import {parseMentionTimeInput} from './dateMentionModel';

// Separate segments keep native mobile editing from inserting digits into HH:mm.
export function createTimeSegments(label:string,value:string,format:string,onChange:(value:string)=>void){
 const element=document.createElement('span');element.className='date-time-inputs';element.setAttribute('role','group');element.setAttribute('aria-label',label);
 const period=document.createElement('select');period.setAttribute('aria-label',label+' 오전/오후');
 for(const [v,t] of [['am','오전'],['pm','오후']]){const option=document.createElement('option');option.value=v;option.textContent=t;period.append(option)}
 const hour=document.createElement('input'),minute=document.createElement('input');
 for(const [input,name] of [[hour,'시'],[minute,'분']] as const){input.type='text';input.inputMode='numeric';input.maxLength=2;input.required=true;input.pattern='[0-9]{1,2}';input.autocomplete='off';input.setAttribute('aria-label',label+' '+name);input.onfocus=()=>input.select();input.onclick=()=>input.select()}
 const clock=document.createElement('span');clock.className='date-time-segments';const colon=document.createElement('span');colon.textContent=':';colon.setAttribute('aria-hidden','true');clock.append(hour,colon,minute);
 if(format==='12')element.append(period);element.append(clock);
 const setValue=(time:string)=>{const [h,m]=time.split(':');hour.value=format==='12'?String(Number(h)%12||12).padStart(2,'0'):h;minute.value=m;period.value=Number(h)<12?'am':'pm';hour.setCustomValidity('');minute.setCustomValidity('')};
 const commit=()=>{const time=parseMentionTimeInput(hour.value.padStart(2,'0')+':'+minute.value.padStart(2,'0'),format,period.value);const valid=!!hour.value&&!!minute.value&&!!time;hour.setCustomValidity(valid?'':'올바른 시각을 입력해 주세요.');minute.setCustomValidity(valid?'':'올바른 시각을 입력해 주세요.');if(valid)onChange(time!);return valid};
 for(const input of [hour,minute]){
  input.oninput=()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,2);input.setCustomValidity('');if(input.value.length===2){const valid=commit();if(valid&&input===hour){minute.focus();minute.select()}}};
  input.onblur=()=>{if(commit())input.value=input.value.padStart(2,'0')};
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit();input.blur()}else if((input===hour&&(e.key===':'||e.key==='ArrowRight'))||(input===minute&&e.key==='ArrowLeft')){e.preventDefault();(input===hour?minute:hour).focus()}};
  input.onpaste=e=>{const time=parseMentionTimeInput(e.clipboardData?.getData('text/plain')??'',format,period.value);if(time){e.preventDefault();setValue(time);onChange(time);minute.focus();minute.select()}};
 }
 period.onchange=()=>{commit()};setValue(value);
 return {element,setValue};
}
