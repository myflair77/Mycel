# 진행 상황 — 2026-11-13
## 이번 완료
Sites UI + Supabase 백엔드 채택을 사용자 승인에 따라 반영.
공식 Supabase SDK, 이메일 signup/signin, Auth 세션, 1:1 채팅 컴포넌트와 실제 API 연결 코드 작성.
Postgres migration: 참여자 RLS, 정확한 ID 방 생성, 방/발신자 쓰기 직렬화, 저장 후 ack, 중복 방지, 분당 메시지 제한.
Realtime 구독 이벤트로 DB 조회, 재구독/주기/온라인 복구 및 ID 중복 병합.
두 계정 실제 서버 통합 스크립트 작성.
전화번호 친구 찾기와 Android/iOS 네이티브 앱을 ROADMAP.md의 후속 계획에 반영.
## 실행한 검증
Vitest 11개 통과 (화면 모드 9, 메시지 병합 1, PostgreSQL 권한/RPC 통합 1).
PGlite: A/B 동일 방, DB 메시지 저장, 재시도 단일 행, 충돌 거절, 비참여자 C 읽기/전송 거절, anonymous 읽기 거절, 직접 발신자 위조 insert 거절.
TypeScript 및 Vite build 통과. build/ 산출물 사용.
브라우저: 로그인→가입 전환, 연결 미설정 안내/가입 버튼 비활성 확인.
실제 test:integration 실행은 필요한 설정 없음으로 BLOCKED(exit 2). 성공으로 간주하지 않음.
## 문제와 해결
dist/assets 파일 접근 오류가 반복되어 기존 산출물은 보존하고 build/로 출력 변경.
SQL 테스트 Node 타입 누락은 @types/node 추가로 해결.
## 미완료/필요 정보
Supabase 플러그인 연결/개발 프로젝트 선택, DB migration 적용, 공개 URL/key 설정, 인증 메일 수신 가능한 테스트 주소 두 개 및 인증.
실제 signup/메일/서버 WebSocket/브라우저 간 전송/배포 URL 검증 아직 미수행.
친구/차단/그룹/파일 미구현. 현재는 기술 베타 코드이며 공개 서비스/MVP 완료 아님.
## Git/배포
변경은 로컬 커밋 예정. 기존 커밋 e77ac57. 원격 업로드/배포/가입/요금 변경 없음.
오른쪽 http://127.0.0.1:5173/ 미리보기 유지.
## 다음
Supabase 연결 후 SUPABASE_SETUP.md 절차대로 실제 두 계정 검증 재개.
Sites 게시 테스트는 원 계획의 별도 배포 승인 조건에 따라 처리.
