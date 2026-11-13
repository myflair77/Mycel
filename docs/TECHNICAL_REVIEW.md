# 0단계 기술 검토 — 2026-11-13

## 실제 확인
Windows PowerShell, Git 2.53.0.windows.2, Node v24.14.1, npm 11.11.0. 워크스페이스는 빈 폴더였다. 샌드박스 기본 읽기가 거절되어 승인된 권한 실행으로 확인했다.
GitHub CLI: 권한 실행에서 인증 정상. 기본 샌드박스의 invalid token 응답은 재확인에서 해소. 토큰은 저장하지 않음. 신규 원격 저장소는 생성하지 않음.
Sites list_sites 읽기 성공. 기존 다른 사이트는 수정하지 않음.

## 비교
|항목|Sites 우선안|Supabase 대안|
|---|---|---|
|실행|Cloudflare Worker ESM|프런트 별도 호스팅 + 관리형 백엔드|
|영속 데이터|D1 (문서 확인)|Postgres|
|파일|R2 (문서 확인)|Storage|
|인증|ChatGPT 로그인 문서 확인; 독립 이메일 미확인|Auth 이메일/비밀번호 지원 문서 확인 필요|
|실시간|WebSocket/DO 바인딩 미확인|Realtime + RLS 후보|
|선정|실험 통과 전 보류|승인 후 적용 검토|

Cloudflare 자체는 Workers WebSocket 및 Durable Objects 방 조정을 지원하지만, 그것이 Sites에서 해당 바인딩을 지원한다는 증거는 아니다.

출처:
- 설치된 Sites 1.1.6 SKILL.md, references/storage.md, references/identity-and-secrets.md (2026-11-13 열람)
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/realtime/authorization.mdx

완료 조건: Sites 독립 로그인/실시간 가능 여부 확인 또는 대안 승인, 두 독립 세션의 저장/재접속 실험. 현 단계는 기술 검증 일부 완료이며 전체 0단계 완료로 주장하지 않는다.

추가 문서 확인: Supabase 이메일/비밀번호 인증과 Realtime 권한 문서 열람. https://supabase.com/docs/guides/auth/passwords 및 https://supabase.com/docs/guides/realtime/authorization . 대안 비교 근거이며 실제 프로젝트 연결/검증은 하지 않았다.
