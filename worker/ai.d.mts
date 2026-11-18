export function aiSeal(secret:string,owner:string,value:any,decode?:boolean):Promise<any>;
export function aiProviderRequest(provider:string,key:string,model:string,prompt:string,context:string,models?:boolean):any;
export function aiApi(request:Request,env:any):Promise<Response>;
