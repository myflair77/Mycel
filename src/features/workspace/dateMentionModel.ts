import {validMentionDate} from './mentionModel';
export const dateFormats=[['full','전체 날짜'],['short','날짜 간단히 표기'],['mdy','월/일/년'],['dmy','일/월/년'],['ymd','년/월/일'],['relative','상대']] as const;
export const reminderOptions=[['none','알림 없음'],['at','이벤트 정각'],['5m','5분 전'],['10m','10분 전'],['15m','15분 전'],['30m','30분 전'],['1h','1시간 전'],['2h','2시간 전'],['1d','(09:00) 1일 전'],['2d','(09:00) 2일 전']] as const;
export const dateDefaults={time:'',endDate:'',endTime:'',timeZone:'Asia/Seoul',dateFormat:'full',timeFormat:'24',reminder:'none',reminderUserId:'',reminderRevision:''};
export type DateMentionAttrs=typeof dateDefaults & {target:string;[key:string]:unknown};
export function dateAttrs(attrs:Record<string,any>):DateMentionAttrs{return {target:String(attrs.target??''),...dateDefaults,...attrs}}
export function validMentionTime(value:string){return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)}
export function validTimeZone(zone:string){try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return !!zone}catch{return false}}
export function dayInZone(now:Date,zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:validTimeZone(zone)?zone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(t=>parts.find(p=>p.type===t)?.value).join('-')}
export function dateMentionLabel(input:Record<string,any>,now=new Date()){
 const a=dateAttrs(input),fmt=(day:string)=>{if(!validMentionDate(day))return day;const [y,m,d]=day.split('-').map(Number);switch(a.dateFormat){case 'short':return `${y}. ${m}. ${d}.`;case 'mdy':return `${m}/${d}/${y}`;case 'dmy':return `${d}/${m}/${y}`;case 'ymd':return `${y}/${m}/${d}`;case 'relative':{const delta=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(dayInZone(now,a.timeZone)+'T00:00:00Z'))/86400000);if(delta===0)return '오늘';if(delta===1)return '내일';if(delta===-1)return '어제';} }return `${y}년 ${m}월 ${d}일`};
 const tm=(t:string)=>{if(!validMentionTime(t)||a.timeFormat==='hidden')return '';const [h,m]=t.split(':').map(Number);return ' '+(a.timeFormat==='12'?`${h<12?'오전':'오후'} ${h%12||12}:${String(m).padStart(2,'0')}`:t)};
 return fmt(a.target)+tm(a.time)+(a.endDate?' – '+fmt(a.endDate)+tm(a.endTime):'');
}
export function dateMentionError(a:DateMentionAttrs){if(!validMentionDate(a.target))return '올바른 날짜를 입력해 주세요.';if(a.time&&!validMentionTime(a.time)||a.endTime&&!validMentionTime(a.endTime))return '올바른 시각을 입력해 주세요.';if(!validTimeZone(a.timeZone))return '올바른 시간대를 선택해 주세요.';if(a.endDate&&(!validMentionDate(a.endDate)||(a.endDate+'T'+(a.endTime||a.time||'00:00'))<(a.target+'T'+(a.time||'00:00'))))return '종료 일시는 시작 일시 이후로 선택해 주세요.';return ''}
// Add one wall-clock hour without depending on the device timezone.
export function dateMentionEndAfterHour(day:string,time:string){
 if(!validMentionDate(day)||!validMentionTime(time))return {endDate:day,endTime:''};
 const end=new Date(day+'T'+time+':00Z');end.setUTCHours(end.getUTCHours()+1);
 return {endDate:end.toISOString().slice(0,10),endTime:end.toISOString().slice(11,16)};
}

export function parseMentionTimeInput(value:string,format='24',period='am'):string|null{
 const text=value.trim(),parts=/^(\d{1,2}):(\d{2})$/.exec(text)??/^(\d{2})(\d{2})$/.exec(text);
 if(!parts)return null;let hour=Number(parts[1]);const minute=Number(parts[2]);
 if(minute>59)return null;
 if(format==='12'){if(hour<1||hour>12)return null;hour=hour%12+(period==='pm'?12:0)}else if(hour>23)return null;
 return String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
