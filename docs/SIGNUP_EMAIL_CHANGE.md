# 인증 전 이메일 변경 적용 안내

이 변경은 새 계정을 만들지 않습니다. 기존 UUID, 사용자 ID, 프로필 및 초대 문맥을 유지합니다.
기존 이메일과 가입 비밀번호를 Supabase Auth에서 검증한 후, 미인증 이메일 계정만 Auth Admin API로 변경합니다.
이메일 인증을 우회하거나 계정/자료를 삭제하지 않습니다. 관리자 키는 Supabase Edge 환경 내부에만 있습니다.

## 서버 적용 순서

1. 기존 프로젝트 SQL Editor:
   https://supabase.com/dashboard/project/xpbfgppttnqmpevpumhd/sql/new
   migrations/0033_signup_email_change.sql 전체를 새 쿼리에서 한 번 실행합니다.
   이 파일은 호출 제한 테이블, service_role 전용 RPC, 동시 인증/변경 방지 트리거만 추가합니다.
   기존 계정/일정/메시지 자료를 수정하거나 삭제하지 않습니다.

2. 기존 프로젝트 Edge Functions:
   https://supabase.com/dashboard/project/xpbfgppttnqmpevpumhd/functions
   새 함수 이름을 signup-email로 정하고 Editor의 index.ts에
   supabase/functions/signup-email/index.ts 전체를 붙여넣어 배포합니다.
   이 함수에 한해서 Verify JWT를 끕니다. 미인증 사용자는 JWT가 없으므로
   함수 내부에서 기존 이메일/비밀번호와 미인증 상태를 직접 검증합니다.
   다른 함수의 JWT 설정은 바꾸지 않습니다.
   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY는 Supabase가 제공하는
   서버 환경변수를 사용합니다. 키를 채팅이나 프런트엔드 설정에 복사하지 않습니다.

3. 위 두 항목 적용 후 프런트엔드 공개 사이트를 배포합니다.
   프런트엔드만 먼저 배포하면 변경 요청이 실패하므로 서버 적용 확인 전에는 공개하지 않습니다.

## 검증

- 인증 대기에서 이메일 주소 변경 -> 새 이메일 + 가입 비밀번호 -> 새 주소로 인증.
- 가입할 때 선택한 사용자 ID가 동일하고, 새 계정/프로필이 생성되지 않아야 합니다.
- 인증 완료한 계정, 틀린 비밀번호, 다른 계정의 이메일은 변경하지 않아야 합니다.
- 두 창에서 동시에 변경/인증하면 오래된 요청은 전체 롤백됩니다.
- 이메일 변경 후 발송 실패는 별도로 표시하며, 새 이메일에서 인증 메일 다시 보내기를 사용합니다.
- 기존 주소의 인증 링크가 새 주소를 인증하지 않는지도 실제 시험 계정으로 확인해야 합니다.
- 실제 인증 메일 수신/링크 사용과 Supabase 운영 Auth 버전의 동작은 로컬 모의 테스트와 별도로 확인합니다.

자동 검증: npm run check, npm test, Vite + Worker production build.
기능 전용: npx vitest run tests/signup-email.test.ts tests/signup-email-db.test.ts.
브라우저 모의 검증 페이지: /tests/auth-retry-fixture.html (개발 서버 전용).

2026-11-21 적용 기록: 운영 SQL 0033 실행 성공, signup-email Edge 함수 배포(22:42 KST) 확인. 실제 계정을 변경하지 않는 오류/호출 제한 smoke check 통과. 실제 이메일 수신과 링크 인증은 미검증.
