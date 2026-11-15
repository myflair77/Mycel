/** Clipboard images use PNG for broad interoperability. Original downloads stay intact. */
export function imageCopySupported(){return typeof ClipboardItem!=='undefined'&&typeof navigator.clipboard?.write==='function'&&(!ClipboardItem.supports||ClipboardItem.supports('image/png'))}
export async function clipboardPng(blob:Blob):Promise<Blob>{
 if(!blob.type.startsWith('image/'))throw Error('이미지 형식을 확인하지 못했습니다. 원본을 다운로드해 주세요.');
 if(blob.type==='image/png')return blob;
 let source:CanvasImageSource,width:number,height:number,release:()=>void;
 if(typeof createImageBitmap==='function'){
  const bitmap=await createImageBitmap(blob);source=bitmap;width=bitmap.width;height=bitmap.height;release=()=>bitmap.close();
 }else{
  const url=URL.createObjectURL(blob),img=new Image();
  try{await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('이 이미지 형식을 복사할 수 없습니다. 원본을 다운로드해 주세요.'));img.src=url})}catch(e){URL.revokeObjectURL(url);throw e}
  source=img;width=img.naturalWidth;height=img.naturalHeight;release=()=>URL.revokeObjectURL(url);
 }
 let canvas:HTMLCanvasElement|undefined;
 try{
  if(!width||!height||width>16384||height>16384||width*height>32000000)throw Error('해상도가 커서 이미지 복사를 지원하지 않습니다. 원본을 다운로드해 주세요.');
  canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw Error('이미지를 준비하지 못했습니다. 다운로드를 이용해 주세요.');context.drawImage(source,0,0);
  return await new Promise<Blob>((resolve,reject)=>canvas!.toBlob(result=>result?resolve(result):reject(Error('이미지 변환에 실패했습니다. 다운로드를 이용해 주세요.')),'image/png'));
 }finally{release();if(canvas){canvas.width=0;canvas.height=0}}
}
export function copyImage(blob:Blob):Promise<void>{
 if(!imageCopySupported())return Promise.reject(Error('이 브라우저는 이미지 복사를 지원하지 않습니다. 다운로드를 이용해 주세요.'));
 // Start clipboard.write during the click, even while PNG conversion is pending.
 const png=clipboardPng(blob);void png.catch(()=>{});
 try{return navigator.clipboard.write([new ClipboardItem({'image/png':png})])}catch(e){return Promise.reject(e)}
}
