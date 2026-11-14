import { useEffect, useState } from 'react';
import { parsePreference, resolveLayout, type LayoutPreference } from '../features/layout/layout';
const key='messenger.layout';
export function useLayout(){
 const [preference,setPreference]=useState<LayoutPreference>(()=>{try{return parsePreference(localStorage.getItem(key));}catch{return 'auto';}});
 const [width,setWidth]=useState(()=>window.innerWidth);
 useEffect(()=>{const resize=()=>setWidth(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[]);
 useEffect(()=>{try{localStorage.setItem(key,preference)}catch{/* Preferences remain usable without storage. */}},[preference]);
 return {preference,setPreference,layout:width<744?'phone':resolveLayout(preference,width)};
}
