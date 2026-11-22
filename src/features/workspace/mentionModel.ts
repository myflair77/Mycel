export type MentionKind='person'|'note'|'date';
export type MentionRow={kind:MentionKind;id:string;label:string;detail?:string};
export function mentionTrigger(text:string){const m=/(?:^|[\s(（])@([^@\n\ufffc]{0,100})$/.exec(text);return m?{query:m[1],offset:text.length-m[1].length-1}:null}
export function dateValue(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function validMentionDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);return y>=1000&&y<=9999&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d}
export function dateMentions(query:string,now=new Date()):MentionRow[]{
 const q=query.trim().toLowerCase();const rows=[['오늘',0,'today'],['내일',1,'tomorrow'],['어제',-1,'yesterday']] as const;
 const result:MentionRow[]=rows.filter(([label,,en])=>!q||label.includes(q)||en.includes(q)).map(([label,offset])=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);return {kind:'date' as const,id:dateValue(d),label:dateValue(d),detail:label}});
 const normalized=q.replace(/[./]/g,'-').replace(/^(\d{4})-(\d{1,2})-(\d{1,2})$/,(_,y,m,d)=>`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
 if(validMentionDate(normalized)&&!result.some(r=>r.id===normalized))result.push({kind:'date',id:normalized,label:normalized,detail:'날짜'});return result;
}
