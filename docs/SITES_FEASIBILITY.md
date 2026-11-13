# Sites 인증·실시간 검증과 대안 비교
2026-11-13. 문서/로컬 구현 계약 검증. 배포 및 실제 다중 계정 통신 실험은 하지 않음.

## 결론
Sites 단독으로 독립 이메일 가입 + 다중 방 실시간 채팅이 운영 가능하다는 증거는 아직 부족하다. 불가능 판정은 아니다.
새로 확인한 공식 문서는 외부 identity provider를 요구할 수 있음을 명시한다. 따라서 외부 인증 자체가 금지/불가능하다고 해석해서는 안 된다. 구체 제공자 설정, 콜백, 토큰 검증, ChatGPT 비회원 접근은 실증 필요.
권고: Sites 프런트엔드를 우선 유지하되 Supabase Auth + Postgres + Realtime + Storage를 별도 백엔드로 쓰는 혼합 구성을 검증할 후보 1순위로 삼는다. 아직 적용 승인/가입/연결은 하지 않았다.

## 증거와 한계
|항목|확인 결과|판정|
|---|---|---|
|Sites D1/R2|공식 data-and-connections 및 설치 스킬|문서상 지원|
|Sites ChatGPT 로그인|플랫폼 sign-in 경로 및 identity headers|문서·starter 구현 확인|
|Sites 외부 인증|공식 문서에 external identity provider 언급|개념상 지원 안내, 자체 이메일 운영 미검증|
|Sites native 이메일 비밀번호|현 스킬/도구에서 signup/reset/SMTP 구성 계약 찾지 못함|미확인; SIWC 이메일 헤더를 자체 이메일 인증과 혼동 금지|
|Sites WebSocket 업그레이드|스킬/템플릿/도구에 명시 계약 없음|미검증|
|Sites 방별 Durable Objects|hosting manifest 공개 항목에 DO 없음|프로비저닝 경로 미확인|
|Cloudflare 자체 WS/DO|Cloudflare 공식 문서 확인|Sites 지원을 뜻하지 않음|
|로컬 mock 로그인|starter는 loopback 한정 시뮬레이션|독립 계정 증거로 사용 불가|

공개 사이트가 익명 요청을 받을 수 있다는 사실과 외부 인증 기반 데이터 권한 검증은 별개다. private 사이트 앞의 ChatGPT gate를 브라우저용 bypass token으로 우회하지 않는다.
메모리 Set에 socket을 저장하는 단일 Worker 구현은 다중 isolate/재시작/다중 방 검증 없이 운영 가능으로 판정하지 않는다.

## 대안
|구성|이메일 로그인|실시간·저장|장점|검증/운영 부담|
|---|---|---|---|---|
|Sites 단독|네이티브 자체 이메일 미확인|D1/R2 확인, WS/방 조정 미확인|호스팅 통합|현재 요구 충족 불확실|
|Sites UI + Supabase|Auth 이메일/비밀번호|Postgres 저장 + Realtime 구독|관계/고유 제약/SQL 이식성; 화면 유지|Sites CSP/외부 HTTPS·WSS/콜백 실험, SMTP, RLS 필요|
|일반 정적 호스팅 + Supabase|동일|동일|Sites 연동 문제 시 UI 코드 재사용|호스팅 이전·도메인·배포 관리|
|Sites 또는 별도 UI + Convex|Convex Auth 또는 OIDC 공급자|반응형 query 구독 + DB|TypeScript 중심 실시간 개발|인증 선택, 함수별 권한 검사, 데이터/함수 모델 이식 작업|
|직접 Workers + DO + D1/R2 + 인증 제공자|외부 인증 제공자|DO 방 관리 + D1/R2|세밀한 제어|직접 배포·실시간·재접속·부하·인증 운영 부담 큼|

Supabase 초기에는 저장된 메시지를 구독하고 재접속 시 DB를 조회한다. Postgres Changes는 구독자마다 권한 검사를 하므로 규모가 커지면 부하 측정 후 private Broadcast 방식을 검토한다.
Supabase 기본 메일 발송은 프로젝트 팀 주소로 제한되므로 일반 초대 베타에도 custom SMTP/메일 제공자 준비가 필요하다. 가격은 미견적: DB/백업/스토리지/트래픽/실시간 사용량/메일 발송/AI 비용을 별도 계산해야 한다.
Convex는 함수별 인가를 직접 작성한다. 자동 실시간이 자동 보안을 의미하지 않는다.
AI 실행 워커는 어느 대안에서든 메신저 요청 처리와 분리한다. 채팅 백엔드를 고른다고 Dot/Codex의 외부 제어 API까지 검증된 것은 아니다.

## 배포 승인 후 수용 시험
1. 신규 테스트 전용 Site, 테스트 데이터만 사용. 기존 사이트 변경 없음.
2. WS echo의 HTTP 101/메시지 왕복 검증 (채팅 완성 판정과 분리).
3. 독립 브라우저 A/B와 서로 다른 방에서 권한 있는 전달/권한 없는 전달 거절 검증.
4. DB 커밋 후 ack, 중복 키 단일 저장, 새로고침/오프라인 복구 검증.
5. 외부 인증 후보는 ChatGPT 미로그인 상태에서 이메일 인증/복구/로그아웃/만료 검사. provider 세션과 Site gate 구분.
6. 공개·공유 정책은 별도 승인. owner-private만으로 일반 가입 요구를 검증했다고 주장하지 않음.
7. 실패 시 Sites UI → 대안 백엔드 직접 연결 검사(CSP, CORS, WSS, redirect), 다시 실패하면 정적 호스팅 이전 후보.

## 출처
- https://learn.chatgpt.com/docs/sites/data-and-connections (외부 identity provider, D1/R2, SIWC)
- Sites 1.1.6 SKILL.md 및 references/identity-and-secrets.md, storage.md, templates/vinext-starter/README.md, app/chatgpt-auth.ts
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/realtime/postgres-changes
- https://docs.convex.dev/auth/overview
- https://docs.convex.dev/realtime
