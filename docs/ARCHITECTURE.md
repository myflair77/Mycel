# 구조
2026-11-13

채택: React + TypeScript + Vite + CSS. 프런트엔드 src, 백엔드 어댑터 계약 src/services/messenger.ts, 서버 server, 마이그레이션 migrations.

Sites 우선 후보: Worker ESM fetch handler + D1 + R2. Sites의 배포 형식과 저장소 지원은 설치된 Sites 1.1.6 스킬에서 확인. 현재 클라이언트는 정적 dist 빌드이며 서버 런타임은 미채택.

실시간 전달은 영속 저장의 대체가 아니다. 권한 검사 → 중복 키 조회 → 트랜잭션 저장/순번 할당 → 성공 응답 → 이벤트 전달. 재연결은 마지막 서버 순번 이후를 다시 조회한다. 같은 키에 다른 본문은 충돌로 거절한다.

Sites 네이티브 인증은 ChatGPT 로그인으로 설명되어 있다. ChatGPT 계정 없는 이메일 가입과 외부 인증 호환성은 미확인. WebSocket/방별 조정 Durable Objects 바인딩은 현재 Sites 문서에서 확인되지 않았다. 미지원으로 단정하지 않는다.
