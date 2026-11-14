import {it,expect} from 'vitest';
import {prepareDownload,fileMime,fileName,validateFile,MAX_FILE_SIZE} from '../src/features/messages/attachments';
it('detects safe raster previews by bytes and treats active content as downloads',async()=>{
 expect(await fileMime(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])]))).toBe('image/png');
 expect(await fileMime(new Blob(['<svg onload="alert(1)">'],{type:'image/png'}))).toBe('application/octet-stream');
 expect(await fileMime(new Blob(['%PDF-1.7']))).toBe('application/octet-stream');
});
it('rejects empty/oversized files and normalizes unsafe filenames',()=>{
 expect(()=>validateFile({size:0})).toThrow();expect(()=>validateFile({size:MAX_FILE_SIZE+1})).toThrow();expect(()=>validateFile({size:MAX_FILE_SIZE})).not.toThrow();
 expect(fileName('a/b.txt')).toBe('a_b.txt');expect(fileName('a'.repeat(200))).toHaveLength(180);
});

it('preserves downloaded image bytes and MIME, and adds a missing image extension',async()=>{
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);const original=new Blob([bytes],{type:'application/octet-stream'});
 const result=await prepareDownload(original,{name:'사진',size:11});expect(result.name).toBe('사진.png');expect(result.blob.type).toBe('image/png');expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
 expect((await prepareDownload(original,{name:'사진.PNG',size:11})).name).toBe('사진.PNG');await expect(prepareDownload(original,{name:'사진.png',size:12})).rejects.toThrow(/크기/);
});
