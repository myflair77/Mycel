import {useEffect,useRef} from 'react';
import {iconElement} from './iconValue';
export function IconValue({value,fallback='📄',decorative=false}:{value?:string;fallback?:string;decorative?:boolean}){
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{ref.current?.replaceChildren(iconElement(value??'',fallback))},[value,fallback]);
 return <span aria-hidden={decorative||undefined} ref={ref} className="mycel-icon-slot"/>;
}
