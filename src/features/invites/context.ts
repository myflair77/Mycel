const KEY='weano-pending-invite-v1';
export const validInvite=(value:string|null):value is string=>!!value&&/^[a-f0-9]{64}$/.test(value);
export function readInvite(){
 const explicit=new URL(location.href).searchParams.get('i');
 if(explicit!==null){if(validInvite(explicit)){try{localStorage.setItem(KEY,JSON.stringify({token:explicit,until:Date.now()+7*86400000}))}catch{}}return explicit}
 try{const item=JSON.parse(localStorage.getItem(KEY)??'null');if(item?.until>Date.now()&&validInvite(item.token))return item.token}catch{}
 return null;
}
export function clearInvite(){try{localStorage.removeItem(KEY)}catch{}const u=new URL(location.href);u.searchParams.delete('i');history.replaceState(null,'',u.pathname+u.search+u.hash)}
export function inviteUrl(token:string){const u=new URL(location.origin);u.searchParams.set('i',token);return u.href}
export function installShareUrl(){const t=readInvite();return validInvite(t)?inviteUrl(t):location.origin}
