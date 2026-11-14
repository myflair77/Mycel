import {useEffect,useState} from 'react';
export function useSaved<T>(key:string,initial:T){const [value,setValue]=useState<T>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null')??initial}catch{return initial}});useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}},[key,value]);return [value,setValue] as const}
export function dayLabel(value:string){return new Date(value).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'})}
export function grouped(a:{sender_id:string;created_at:string}|undefined,b:{sender_id:string;created_at:string}){return !!a&&a.sender_id===b.sender_id&&dayLabel(a.created_at)===dayLabel(b.created_at)&&Date.parse(b.created_at)-Date.parse(a.created_at)<60000}
export function links(text:string){return text.match(/https?:\/\/[^\s<>]+/g)??[]}
export function Highlight({text,query}:{text:string;query:string}){if(!query)return <>{text}</>;const at=text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());return at<0?<>{text}</>:<>{text.slice(0,at)}<mark>{text.slice(at,at+query.length)}</mark>{text.slice(at+query.length)}</>}
