import {beforeEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),info:vi.fn(),upload:vi.fn()}));
vi.mock('../src/services/supabase',()=>({supabase:{rpc:api.rpc,storage:{from:()=>({info:api.info,upload:api.upload})}}}));
import {deliverAttachment,type Attachment} from '../src/features/messages/attachments';
const a:Attachment={id:'key',room_id:'room',sender_id:'alice',name:'note.txt',size:5,mime:'application/octet-stream',path:'alice/key'};
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('navigator',{onLine:true});api.rpc.mockImplementation((name)=>({abortSignal:async()=>({data:name==='send_attachment'?{id:'message',attachment_id:'key'}:a,error:null})}));});
it('uploads before committing the message and uses immutable paths',async()=>{
 api.info.mockResolvedValue({error:{message:'missing'}});api.upload.mockResolvedValue({error:null});
 const result=await deliverAttachment(a,new File(['hello'],'note.txt'),()=>{});
 expect(result.id).toBe('message');expect(api.upload).toHaveBeenCalledWith('alice/key',expect.any(Blob),expect.objectContaining({upsert:false,contentType:'application/octet-stream'}));
 expect(api.rpc.mock.calls.map(x=>x[0])).toEqual(['prepare_attachment','send_attachment']);
});
it('reuses a completed upload after a reload or lost commit response',async()=>{
 api.info.mockResolvedValue({data:{},error:null});await deliverAttachment(a,undefined,()=>{});expect(api.upload).not.toHaveBeenCalled();expect(api.rpc).toHaveBeenLastCalledWith('send_attachment',{p_id:'key'});
});
it('does not send a message when upload failed',async()=>{
 api.info.mockResolvedValue({error:{message:'missing'}});api.upload.mockResolvedValue({error:Error('offline')});
 await expect(deliverAttachment(a,new File(['hello'],'note.txt'),()=>{})).rejects.toThrow('offline');expect(api.rpc).toHaveBeenCalledTimes(1);
});
it('asks for the original file if upload never completed before reload',async()=>{
 api.info.mockResolvedValue({error:{message:'missing'}});await expect(deliverAttachment(a,undefined,()=>{})).rejects.toThrow(/다시 선택/);expect(api.upload).not.toHaveBeenCalled();
});
