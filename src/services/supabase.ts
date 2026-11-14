import {createClient} from '@supabase/supabase-js';
const authHash=new URLSearchParams(typeof location==='undefined'?'':location.hash.slice(1));
export const initialAuthFlow=authHash.has('error')?'error':(['recovery','magiclink','email_change'].includes(authHash.get('type')??'')?authHash.get('type'):null);
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=import.meta.env.VITE_PUBLIC_PREVIEW !== 'true' && url && key ? createClient(url,key) : null;

