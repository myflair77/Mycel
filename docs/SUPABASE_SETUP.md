# Supabase 개발 연결
## 현재 상태
사용자가 Sites UI + Supabase 백엔드 채택 승인. 프로젝트 연결 미완료.
Supabase 플러그인은 검색에서 발견했고 설치/연결 안내를 제공했으나 아직 연결 확인되지 않았다.
Docker/Supabase CLI는 PATH에서 발견되지 않았다.

## 개발 전용 프로젝트
기존 서비스 DB가 아닌 새 개발 프로젝트/브랜치를 선택한다.
migrations/0001_supabase_chat.sql은 신규 스키마용이며 한 번만 마이그레이션으로 적용한다.
profiles 자동 생성 trigger, rooms/members/messages, RLS, RPC, Realtime publication 포함.
friend_requests/차단/검색 공개 범위/그룹/파일은 아직 없음. 정확한 사용자 ID로 직접 방을 여는 기술 베타이며 공개 운영 전 친구/차단 정책과 검색·방 생성 제한을 추가한다.

## Auth와 메일
Email signup 활성화, 이메일 확인 유지. 테스트 편의를 위해 확인 절차를 끄거나 admin 확인으로 대체하지 않는다.
Site URL/redirect allowlist에 localhost 개발 origin과 승인된 게시 origin만 등록한다.
외부 테스트 주소의 확인 메일은 custom SMTP가 필요할 수 있다. 메일 발송 서비스 가입/비용은 별도 승인.
사용자 소유의 테스트 이메일 두 개를 사용. 기존 계정 재사용은 signup 검증이 아니므로 별도 기록.
비밀번호/관리 키는 채팅에 붙이지 말고 로컬 비밀 설정 또는 서비스의 안전한 입력 경로로 설정.

## 로컬 연결
.env.local에 .env.example의 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 설정.
publishable 또는 기존 anon 키만 허용; service_role/secret 키 금지.
Vite는 시작/빌드 시 환경값을 읽으므로 dev 서버 재시작 후 다시 빌드.
현재 build/가 배포 산출물이다. 이전 dist/는 Windows 접근 오류로 보존된 구형 산출물이며 배포 금지.
Sites 등록 시 static.directory=build 사용. D1/R2는 현재 앱에 불필요.
인증 토큰은 Supabase SDK가 관리하고, 권한 검사는 PostgreSQL RLS와 RPC에서 수행한다.

## 두 계정 검증
.env.test.example을 무시되는 .env.test로 복사하고 프로젝트 공개 설정과 테스트 전용 두 계정 정보를 설정.
- npm run test:integration -- --signup : 신규 두 계정 실제 signup 요청
- 각 계정에서 받은 이메일 인증 완료
- npm run test:integration : 독립 로그인 → 동일 방 생성 → B 구독 → A 저장 → B 실시간 이벤트 → 중복/충돌 → 오프라인 복구 → 권한 거절
성공 로그에 비밀번호/토큰은 출력하지 않음. 테스트 메시지는 개발 DB에 남기고 자동 삭제하지 않는다.
세 번째 비참여자 검사, 실제 독립 브라우저, Sites 게시 origin CSP/CORS/WSS/로그인 callback은 추가 검증.
이 스크립트는 서버 통합 검증이며 UI E2E 완료를 대신하지 않는다.

## 로컬 SQL 검사
npm test: PGlite PostgreSQL 엔진에 테스트 auth 스키마/uid를 만들어 RLS/RPC 검사.
Supabase Auth/메일/Realtime을 에뮬레이션한 성공으로 보고하지 않는다. replication publication 부분만 로컬 SQL 시험에서 제외한다.
