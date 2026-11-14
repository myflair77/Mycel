import {it,expect,vi,beforeEach} from 'vitest';
const upload=vi.hoisted(()=>vi.fn());vi.mock('../src/features/messages/r2',()=>({uploadR2:upload}));
import {deliverAttachment,type Attachment} from '../src/features/messages/attachments';
const a:Attachment={id:'id',sender_id:'a',room_id:'r',name:'test',size:5,mime:'application/octet-stream',path:'a/id'};
beforeEach(()=>{vi.stubGlobal('navigator',{onLine:true});upload.mockReset();upload.mockResolvedValue({id:'message'})});
it('uses R2 for new attachments and preserves retry metadata',async()=>{const file=new File(['hello'],'test');expect((await deliverAttachment(a,file,()=>{})).id).toBe('message');expect(upload).toHaveBeenCalledWith(a,file,expect.any(Function))});
it('rejects wrong file size before uploading',async()=>{await expect(deliverAttachment(a,new File(['wrong size'],'test'),()=>{})).rejects.toThrow(/원본/);expect(upload).not.toHaveBeenCalled()});
it('supports resuming an upload without in-memory bytes',async()=>{await deliverAttachment(a,undefined,()=>{});expect(upload).toHaveBeenCalledWith(a,undefined,expect.any(Function))});
it('rejects offline sends',async()=>{vi.stubGlobal('navigator',{onLine:false});await expect(deliverAttachment(a,undefined,()=>{})).rejects.toThrow(/연결/)});
