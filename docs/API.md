# API 계약 초안 (미구현)
인증 서버에서 UUID를 얻으며 클라이언트 senderId는 신뢰하지 않는다.

- GET /rooms/:id/messages?afterSequence=&limit=: 참여 권한, 최대 100개, 서버 순번 정렬
- POST /rooms/:id/messages: body/idempotencyKey 검증, 차단/참여 검사, DB 커밋 후 반환
- 실시간 message.created: 저장된 Message payload. 누락은 REST 재조회, ID 기준 병합
- 친구 요청/수락/취소/차단: 양쪽 관계와 중복을 트랜잭션 검증
- 파일 다운로드: 매 요청 권한 검사, 비공개 저장소 접근

인증 없음 401, 접근 불가 403, 중복 키 내용 충돌 409, 제한 초과 429. 상세 경로는 백엔드 채택 후 확정.
