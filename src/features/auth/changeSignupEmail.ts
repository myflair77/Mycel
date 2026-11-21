export type SignupEmailInput={email:string;newEmail:string;password:string};
export type SignupEmailResult={emailChanged:true;email:string;mailSent:boolean};
export async function changeSignupEmail(input:SignupEmailInput):Promise<SignupEmailResult>{
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw Error('인증 서버 연결을 확인해 주세요.');
 const response=await fetch(url+'/functions/v1/signup-email',{method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify(input)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.emailChanged)throw Error(result?.error||'이메일 변경을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
 return result;
}

