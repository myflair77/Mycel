const calendarIdField = { type:'string', format:'uuid' };
const calendarVersionField = { type:'integer', minimum:1 };
const calendarTextField = { type:'string' };
const calendarBody = {type:'object', additionalProperties:false, properties:Object.fromEntries(
 ['start','end','description','location','timezone','recurrence_rule','recurrence_instance_id','all_day','cancelled']
 .map(key=>[key,{type:['all_day','cancelled'].includes(key)?'boolean':'string'}]))};
const calendarWriteFields = {id:calendarIdField,request_id:calendarIdField};
const calendarObservation = {type:['object','null'],properties:{version:{type:['string','integer']},deleted:{type:'boolean'}},required:['version','deleted'],additionalProperties:false};
const calendarSpecs = [
 ['calendar_plan_change','양쪽 관측값과 매핑을 비교하여 수정·충돌·보류를 구분합니다. 쓰기는 실행하지 않습니다.',{direction:{type:'string',enum:['import','export','both']},mycel:calendarObservation,google:calendarObservation,mapping:{type:['object','null'],properties:{mycel_version:{type:'integer'},google_version:{type:'string'}},required:['mycel_version','google_version'],additionalProperties:false}},['direction','mycel','google','mapping']],
 ['calendar_pair','사용자가 내 일정에서 발급한 5분 연결 코드로 이 계정을 연결합니다.',{code:calendarIdField},['code']],
 ['calendar_list','선택한 Google 캘린더와 동기화 방향 확인.',{},[]],
 ['calendar_get_sync_status','연결 상태와 마지막으로 확인한 매핑 시각을 조회합니다.',{},[]],
 ['calendar_get_events','개인 일정 기간 조회. from 포함, until 제외. 100개면 마지막 id를 after_id로 넘깁니다.',{from:{type:'string',format:'date'},until:{type:'string',format:'date'},after_id:calendarIdField},['from','until']],
 ['calendar_get_changes','since 이후 변경 및 휴지통 항목 조회. 100개씩 id 순서로 끝까지 조회하세요. 다음 실행은 이전 실행 시작 전부터 겹쳐 읽고 버전으로 중복 제거합니다.',{since:{type:'string',format:'date-time'},after_id:calendarIdField},[]],
 ['calendar_get_event','개인 일정과 양쪽의 마지막 확인 버전 조회. id 또는 google_id 사용.',{id:calendarIdField,google_id:calendarTextField},[]],
 ['calendar_create_event','개인 일정 생성 제안. Mycel에서 승인 후 동일 인자로 재호출합니다.',{...calendarWriteFields,title:calendarTextField,body:calendarBody},['id','request_id','title','body']],
 ['calendar_update_event','확인한 버전의 일정 변경 제안. 변경할 필드만 보내세요.',{...calendarWriteFields,version:calendarVersionField,title:calendarTextField,body:calendarBody},['id','request_id','version']],
 ['calendar_delete_event','일정을 휴지통으로 이동하는 제안. Mycel에서 승인이 필요합니다.',{...calendarWriteFields,version:calendarVersionField},['id','request_id','version']],
 ['calendar_record_sync','양쪽 실제 결과를 다시 읽은 후에만 일치한 버전을 기록합니다. 기존 매핑은 previous_google_version 필수.',{...calendarWriteFields,version:calendarVersionField,google_id:calendarTextField,google_version:calendarTextField,previous_google_version:calendarTextField},['id','request_id','version','google_id','google_version']]
];
const mycelCalendarTools = calendarSpecs.map(([name,description,properties,required])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}}));

export async function calendarMcp(request,env){
 const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return respond({},405);
 let id=null;
 try{
   const message=await request.json();
   id=message.id??null;
   if(message.jsonrpc!=='2.0')return respond({jsonrpc:'2.0',id,error:{code:-32600,message:'Invalid request'}});
   let result;
   if(message.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
   else if(message.method==='tools/list')result={tools:mycelCalendarTools};
   else if(message.method==='tools/call'){
     const caller=request.headers.get('oai-authenticated-user-id');
     if(!caller)return respond({jsonrpc:'2.0',id,error:{code:-32001,message:'Sites 인증이 필요합니다.'}},401);
     const {name,arguments:args={}}=message.params??{};
     const tool=mycelCalendarTools.find(t=>t.name===name);
     if(!tool||!args||typeof args!=='object'||Array.isArray(args)||tool.inputSchema.required.some(k=>!(k in args))||Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k))||JSON.stringify(args).length>50000)
       return respond({jsonrpc:'2.0',id,error:{code:-32602,message:'잘못된 도구 또는 인자입니다.'}});
     if(name==='calendar_plan_change')return respond({jsonrpc:'2.0',id,result:{content:[{type:'text',text:planCalendarChange(args)}]}});
     if(!/^[a-f0-9]{64}$/i.test(env.CALENDAR_MCP_SECRET??''))throw Error('연결 서버 설정이 필요합니다.');
     const credential=await mac(env.CALENDAR_MCP_SECRET,'mycel/calendar/v1/'+caller);
     const pairing=name==='calendar_pair';
     const response=await fetch(SB+'/rest/v1/rpc/'+(pairing?'calendar_pair':'calendar_connector'),{
       method:'POST',headers:{apikey:PK,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000),
       body:JSON.stringify(pairing?{p_code:args.code,p_secret:credential}:{p_tool:name,p_args:args,p_secret:credential})});
     if(!response.ok)throw Error('계정 연결, 입력과 최신 일정 버전을 확인하세요.');
     const value=await response.json();
     if(pairing && value!==true)throw Error('연결 코드가 만료되었거나 올바르지 않습니다.');
     result={content:[{type:'text',text:JSON.stringify(value)}]};
   }else return respond({jsonrpc:'2.0',id,error:{code:-32601,message:'Unknown method'}});
   return respond({jsonrpc:'2.0',id,result});
 }catch(error){
   return respond({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:['연결 서버 설정이 필요합니다.','계정 연결, 입력과 최신 일정 버전을 확인하세요.','연결 코드가 만료되었거나 올바르지 않습니다.'].includes(error.message)?error.message:'캘린더 요청을 완료하지 못했습니다.'}]}});
 }
}

