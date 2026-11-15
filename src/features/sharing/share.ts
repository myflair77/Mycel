import '../../../public/share-store.js';
export type SharedItem={id:string;created:number;text:string;files:File[];keys:string[];done:number[];owner:string|null;room:string|null};
declare global {var WeanoShareStore:{list:()=>Promise<SharedItem[]>;claim:(id:string,owner:string,room:string,text:string)=>Promise<SharedItem>;mark:(id:string,index:number)=>Promise<void>;remove:(id:string)=>Promise<void>}}
export const shareStore=globalThis.WeanoShareStore;
export function canShareFile(file:File){try{return !!navigator.share&&!!navigator.canShare?.({files:[file]})}catch{return false}}
export async function sendOutside(data:ShareData){if(!navigator.share)throw Error('이 브라우저는 공유창을 지원하지 않습니다. 복사 또는 다운로드를 이용해 주세요.');try{await navigator.share(data)}catch(e){if((e as Error).name!=='AbortError')throw e}}
