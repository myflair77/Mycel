# WebMessenger (가칭)
현재 승인 범위: Sites 프런트 + Supabase 백엔드 구현 및 두 계정 검증. 전화번호 친구 찾기와 네이티브 앱은 후속 계획.
표시 이름은 src/config.ts에서 관리.
실제 서버 검증과 로컬 DB 검증을 구분한다. 미연결 상태를 성공으로 표시하지 않는다.
원격 업로드·배포·유료 가입은 사용자 승인 필요. 기존 프로젝트/사이트 변경 금지.
Supabase 공식 Auth만 사용. 브라우저에 service_role/secret 키를 넣지 않는다.
docs/STATUS.md와 DECISIONS.md를 갱신한다.
