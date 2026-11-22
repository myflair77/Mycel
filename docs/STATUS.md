# 진행 상황 — 2026-11-14

## 완료
- Supabase 무료 플랜에서 profiles/chat_rooms/chat_members/messages 생성, RLS 및 함수 권한 확인, messages Realtime 등록 확인.
- Sites 공개 배포 v2: 로그인/회원가입 버튼 분리 및 실제 Supabase 연결 활성화.
- 인증 Site URL을 공개 사이트로 설정.
- 사용자 보고: 노트북 myflair24와 휴대폰 myflair의 회원가입/이메일 인증/로그인 완료.
- 사용자 보고: 양방향 메시지가 페이지 새로고침 없이 도착하고 새로고침 후에도 대화 유지.
- 위 기기 간 결과는 사용자 확인이며 자동 통합 스크립트 성공이나 WebSocket 경로 단독 검증으로 간주하지 않는다. 앱에 5초 조회 복구도 있다.

## 이번 작업
- 대화 목록과 헤더에 상대 프로필 표시. 기존 참여자 RLS 범위 안에서만 조회.

## 남은 검증과 개발
- 실제 서버의 비참여자 격리, 중복 재전송, 연결 중단 복구 자동 검증.
- 친구 요청/수락/차단 및 검색·방 생성 속도 제한.
- 읽음 상태, 그룹, 파일 권한.
- 전화번호 친구 찾기, 네이티브 앱, AI 연동은 후속 계획.
- 실사용 계정과 메시지는 보존한다.

## 친구 기능 — 2026-11-14
- 0002_friends.sql 원격 적용 성공. 세 테이블의 RLS와 직접 쓰기 차단 확인.
- 정확한 ID 검색, 친구 요청/수락/거절, 받은/보낸 요청, 친구 목록, 차단/해제 UI 구현.
- 검색 20회/60초, 요청 10회/3600초: 실패 요청도 계산. 계정별 고정 시간 창이며 전역/IP 제한은 아님.
- 거절/차단으로 종료한 관계는 24시간 재요청 대기. 차단 해제로 친구 관계가 자동 복구되지는 않음.
- 신규 대화는 수락 후 생성. 기존 대화는 유지. 차단 중 양방향 새 전송 금지, 이력 읽기 유지.
- 로컬 PGlite 포함 12개 테스트 통과. 원격 두 기기의 새 친구 UI 수락/거절/차단 확인은 사용자 실기 검증 대기.

## 2026-11-14 추가 확인 및 개선
- 사용자 실기 확인: 친구 요청/수락 후 양쪽 목록 표시, 차단 중 양방향 전송 거절, 이력 유지, 해제 후 전송 복구.
- 새 메시지 송수신/방 로드 후 메시지 목록을 최하단으로 이동. 휴대폰 방 재표시/키보드 높이 변경 시에도 최하단 정렬.
- 거절 및 24시간 재요청 제한의 두 실제 계정 실기 검증은 아직 대기.

- 사용자 화면 및 보고 확인: 차단/해제 후 24시간 재요청 제한 안내가 표시되고 상대 휴대폰에 새 요청이 생성되지 않음. 거절 버튼 자체의 실기 검증은 별도 대기.

## 읽음 기능 및 글자 크기 — 2026-11-14
- chat_reads, mark_chat_read/get_chat_activity RPC 및 Realtime 원격 적용 성공. RLS 활성/직접 갱신 금지 확인.
- 대화 목록 안 읽은 수, 송신 메시지 읽음 표시. 활성·표시·포커스 상태의 방에서만 읽음 처리. 조회 누락 구간은 읽음 처리하지 않음.
- 기존 기록은 실제 읽음 여부를 알 수 없어 방을 열기 전에는 안 읽은 메시지로 집계될 수 있음.
- 로컬 테스트 15개 통과. 실제 두 기기 읽음 검증은 사용자 확인 대기.
- 모든 화면 메시지 본문 14px, 휴대폰/태블릿 목록·버튼·제목 축소. 입력칸 16px 유지.

## 2026-11-14 대화 관리·파일 50MB
- 0008, 0009를 실제 Supabase SQL Editor에서 실행해 Success 확인. 무료 플랜 유지.
- 마지막 메시지/시간과 최신 대화 정렬, 대화 검색/위치 이동, 계정 단위 대화 알림 끄기. 읽음/기존 대화 유지.
- 파일 드래그 앤 드롭 첨부, 파일당 50MiB(화면 50MB) 제한을 앱·RPC·테이블·버킷에 적용.
- 표준 업로드 대기 상한을 10분으로 확대. 중단 후 재전송은 전체 파일을 다시 전송할 수 있으며 TUS 이어올리기는 아직 미구현.
- 로컬 권한/검색/알림 차단/재개 및 첨부 경계 검증 통과. 실제 10MB 초과 파일 전송과 두 기기 UI 검증은 사용자 확인 필요.

## 2026-11-14 R2 전환 및 30일 보관
- Supabase Auth/DB/Realtime 및 무료 플랜 유지. Sites Worker + R2 BUCKET으로 신규 파일 저장.
- 원본을 4MiB 조각으로 나누어 업로드, 해시 검증 및 변경 불가 경로 사용. 파일당 제한은 현재 50MiB 유지.
- 기존 Supabase 첨부는 인증 프록시로 읽기 유지. 기존 원본은 이전/삭제하지 않았으며 기존 저장 사용량은 남음.
- 새 R2 첨부: 전송 확정 후 30일 expires_at, 7일 이내 만료 예정 목록/파일 카드 안내. 만료 시 다운로드 410, 매시간 정리 후 original_deleted_at 기록. 대화/파일명 유지.
- 0010–0012 실제 Supabase 적용, 매시간 15분 정리 cron 등록 확인. 영수증 키는 Sites secret와 접근 제한 DB에만 저장.
- 인증/잘못된 원본/누락 조각/만료/메타데이터 보존 테스트 통과. 공개 사이트 실제 두 기기 신규 파일 송수신 검증 대기.
- 300MB 이상은 R2 구조상 가능성을 확인했으나 Sites 경유 실기 검증 미완료. 현재 지원 상한과 구분.

## 첨부 메시지 표시 간소화
- 사진은 이미지 미리보기만 표시, 클릭 시 확대/저장/유효기간 제공.
- 파일은 파일명·유효기간·용량과 원형 다운로드 아이콘. 만료/오류 상태와 기존 파일 접근 유지.

## 2026-11-14 300MB 및 메시지 표시
- 0013을 Computer Use로 Supabase SQL Editor에서 실행, Success 확인. 새 R2 파일에 300MiB(화면 300MB) 적용. 기존 Supabase 버킷은 50MiB 유지.
- 75개 4MiB 조각 전송/다운로드 SHA-256 일치와 상한 초과 거절을 포함해 55개 로컬 테스트 통과. 실제 공개 사이트 300MB 전송 검증은 별도.
- 메시지 시각을 말풍선 바깥 중앙 방향 하단에 배치, 1:1 상대 미확인 숫자 1 표시.
- 메인 상단 글자 크기 1% 증감/100% 복원, 기기별 저장(70~200%).
- UI-UX-REVIEW.md에 기기별 세부 개선안 및 검증 기준 작성. 전체 개편은 제안 단계.

### 공개 배포 및 실전 검증 완료
- Sites v18 / commit 12d7bf67cb149d7a48a299dbfae66c6ed8f010d3 / deployment appgdep_6af8506a0a2481919f526bb2711d0f0d succeeded.
- 공개 설치형 Edge 메신저 myflair24 → myflair 대화에 Weano-300MB-test.bin 전송 완료, 30일 만료일 및 미확인 1 표시 확인.
- 파일 크기 314572800 bytes, 공개 사이트에서 다시 다운로드 후 원본과 SHA-256 일치: 9513874F667530753B1A014BC68D284AB99A0C2CBC3DF0C44455D19E2DE9AC25.
- 실제 UI 글자 100→101→100 확인. 휴대폰 수신 계정에서의 300MB 다운로드 실기는 사용자 검증 대기.

## 2026-11-14 대화 중심 UI·UX 개편
- 친구/대화/설정 탐색 분리, 최근 대화 첫 화면, 목록 검색·고정·안 읽음 필터. 설정에 프로필/기기 알림/입력 설정.
- 가용 뷰포트 높이, 좁은 창 1열, 모바일 하단 탐색 및 대화 집중 모드, 상대 이름 상시 표시. 목록 접기/너비 조절.
- 더보기의 차단 확인·대화별 알림·파일 서랍·별도 대화창. 팝업 창마다 outbox 분리, 서버 읽음 동기화 재사용.
- 방별 브라우저 초안, IME 보호 Enter/Shift+Enter, 붙여넣기·드롭·최대 10개 순차 첨부, 파일 진행률/전송량/취소/재시도.
- 취소는 진행 중 조각 응답 후 미확정 조각 삭제. 이미 manifest 확정 또는 전송 완료 파일은 삭제 거절. 파일 시간당 20개/300MiB/30일 정책 유지.
- 날짜 구분·연속 메시지 묶음, 검색어 강조 및 원문 이동, 사진/파일/링크 서랍, 사진 확대·축소·이동.
- 기존 자동 하단 이동 기본 유지, 이전 대화 읽기 보존은 선택 설정. 홈 배지의 닫힌 기기 동기화는 기존 보류 유지.
- typecheck 및 56개 테스트 통과. 로컬 미리보기 HTTP 200 및 인증 화면 렌더링 확인. 실기 폴드/태블릿/다중 창·새 UI 검증은 별도 기록.
- 새 시각 디자인 레퍼런스는 사용자 선택 대기. 현재 흰색·회색·파란색 기조 유지.
- 公開 v19 배포 성공: appgdep_6af8561d75208191b3a08c7df45cb915. 로그인된 실제 앱에서 모바일 폭 대화 첫 화면·이름·입력창·서랍 로드 및 별도 창 생성·같은 대화 유지 확인. 최대화한 데스크톱 2열 배치 확인.
- 사진 로드 후 하단 위치 보존과 대화창 제목 보완. 실제 갤럭시 소프트 키보드/폴드 전환은 사용자 실기 확인 필요.


## 2026-11-14 화면 개편
밝은 디자인, 친구 검색/목록 중심 배치, 상단 요청·차단 관리, 목록 옆 새로 고침 적용. 검색 제한 안내는 제목 옆 버튼과 바깥 클릭/Escape로 닫히는 팝오버. 테마는 설정에서 라이트/다크/시스템 선택하고 저장. 글자 크기는 기존 localStorage 저장 키를 유지하며 재시작 시 복원(사이트 데이터 삭제 시 초기화).

상단 화면 모드는 접근성 이름을 유지한 드롭다운만 표시하며 좌우 설명은 제거.
## 2026-11-14 프로필·계정 복구 및 차단 확인
- 설정에서 닉네임/아이디/이메일/비밀번호를 각각 변경. 프로필 UUID는 변경하지 않음.
- 0014_account_profile.sql 적용: 프로필 RPC, 이름 변경 30일 제한, 이전 ID 30일 보류, 가입시 재사용 우회 방지, 기존 권한 유지.
- 닉네임 1~30자, ID 기존 규칙(영문·숫자·밑줄 3~24자), 이메일/비밀번호 변경시 현재 비밀번호 재확인.
- Supabase 공식 Auth 복구/OTP 사용. 아이디 찾기는 자동가입 금지; 인증 후 현재 ID 조회. 루트 콜백으로 다른 기기에서 이메일 링크 처리.
- Worker 복구 요청: Origin 검사, HMAC된 이메일/IP별 CAS 요청 제한, 60초 이메일 재발송/시간당 5회, IP 시간당 20회, 계정 유무 일반응답. 메일 서비스 오류는 성공으로 표시하지 않음.
- 비밀번호 변경 후 다른 세션, 재설정 후 전체 세션 refresh token 해제. 기존 JWT는 만료까지 유효할 수 있음.
- 친구/대화 차단은 동일한 앱 확인 모달에서 취소 또는 차단하기 선택 후 실행.
- 60개 자동 테스트 통과. 실제 계정 비밀번호·이메일은 임의 변경하지 않음. 메일 도착/양쪽 인증/재로그인은 사용자 확인 필요.

2026-11-14: 친구 검색 이용 안내 버튼을 정보 아이콘+둥근 보조 버튼으로 정리. 네이티브 회색 테두리 제거, hover/open/focus 및 다크 테마 대응. 안내 팝오버는 제한별 행과 재요청 안내로 구성.
2026-11-14: 프로필 변경/중복 확인/저장/취소/재발송과 계정 복구·차단 확인 버튼을 공통 형태로 통일. 브라우저 기본 스타일 제거, 저장과 차단은 색상으로 구분, 모바일 터치 영역/포커스/비활성 상태 유지.
2026-11-14: 모바일 최초 이용 설치 가이드. Android Edge는 Chrome으로 다시 열기/주소 복사, Android Chrome 앱 설치 단계, 설치 후 알림 설정 및 갤럭시 배지 조건 안내. 기기 플랫폼으로 분기(창 너비 아님), iOS 별도 Safari 안내. 닫으면 기기 브라우저에 기억, 설정에서 다시 열기. 배지는 해당 갤럭시 실측 결과로 표현하며 모든 환경 보장하지 않음.
## 2026-11-14 친구 초대
- 친구 화면 초대 링크 생성/공유/복사/만료. 7일, 동시에 10개·일 20개 생성 제한. 원본 토큰은 생성 시만 반환하고 DB에는 SHA-256 해시만 보관.
- 링크 미리보기는 초대한 사람의 현재 닉네임만 공개. 이메일과 내부 계정 ID는 익명에 노출하지 않음.
- 가입 메타데이터의 초대 토큰을 profile 생성 트리거가 검증해 pending_friend_invites에 연결. 인증 완료 기기가 달라도 본인 계정에서 복원.
- 기존 회원 로그인, 이미 친구/요청 중/받은 요청/자기 초대/차단/만료 처리. 명시적 친구 요청 버튼 후 기존 request_friend RPC를 호출하므로 기존 수락·거절·차단·횟수 제한 유지.
- 여러 탭의 초대가 달라지면 서버 pending ID와 화면의 ID 일치를 확인하여 잘못된 상대 요청 방지.
- Android Chrome 전환과 복사에 초대코드 유지, 인증 토큰/임의 쿼리 제외. iOS Safari/홈 화면, Mac Safari Dock 안내. 데스크톱 Edge 허용.
- 실제 Galaxy/Apple 설치 및 새 계정 이메일 인증은 기기별 사용자 확인 필요.

2026-11-15: 나와의 대화 구현. 계정당 단일 개인방, 소유자만 접근, 텍스트/R2 파일/검색 재사용, 미읽음·푸시 제외. 실기기 간 동기화 검증은 배포 후 진행.

2026-11-15: 화면 모드·글자 크기 조절을 설정으로 이동. 상단 행 제거 및 모바일 하단 탐색/대화 높이 재배치. 저장한 글자 배율은 설정 진입 전에도 적용.

2026-11-15: 메시지 메뉴·답장·전달·수정·삭제·중요 표시, 게시판·공지 및 검색창 6곳 지우기 구현. 0017 운영 DB 적용 성공. 타입 검사 및 67개 테스트 통과. 모바일 길게 누르기와 두 기기 동기화는 실기기 확인 필요.

2026-11-15: 외부 앱 공유 및 공유 수신 구현. 메시지 메뉴 → 다른 앱으로 공유, 파일 준비 후 Web Share API와 복사/다운로드 대안. share_target POST를 SW에서 수신해 IndexedDB에 보관, 로그인 후 대화 선택·미리보기·명시적 전송. 최대 10개/합계 300MB/텍스트 4000자/대기 3건·24시간. 계정·대화 원자적 고정과 안정적인 전송 UUID로 재시도 중복 방지. 74개 테스트 통과. 로컬 브라우저에서 수신 후 나와의 대화 전송 및 Windows 공유창 호출 확인. Galaxy OS 공유 대상 등록/실제 사진·파일 왕복은 사용자 기기 검증 필요.

2026-11-15: 공유 화면을 시스템 공유와 복사·다운로드로 분리. 사진 이미지 복사 추가(PNG 클립보드, JPEG/GIF/WebP 변환, 사용자 클릭 시 write 시작, 비지원/권한 거부/대형 해상도 안내). 자동 테스트 78개 통과, 브라우저 테스트에서 JPEG 복사 완료 확인. 자동 붙여넣기는 브라우저 도구의 가상 클립보드 제한으로 미검증; 실제 카카오톡 붙여넣기는 사용자 확인 필요.

## 2026-11-15 — Groups and layout polish
- 0018 adds group rooms and membership RPCs without replacing existing direct rooms or attachments. Up to 50 active members; friends-only invitations; blocked pairs rejected; any member may rename/invite; leave requires UI confirmation and revokes room access without removing history/files.
- New invitees can see earlier history; joins are initialized at current sequence, and prior messages do not count as their unread. Group read counts use active members and join/read positions, with sender names.
- Conversation refresh moved to sticky list header. Profile labels/values use 12/14px scaled typography with bold values and soft backgrounds. Compact tablet navigation rail stays 48px across all sections.
- Local validation: 82 tests passed, including group membership/reads/access/idempotency and existing regression suites. Actual two-device group testing remains user-assisted.

## 2026-11-15 — Group history boundary
- 0019_group_history.sql applied successfully to production Supabase through Edge SQL Editor. Existing membership visibility starts at zero; future joins start after the room sequence at admission. Existing messages and files are not removed.
- Direct chat → add people creates a separate group with the original peer and selected friends. The private room is preserved without copying its history.
- Message RLS, search, conversation preview, reply/forward/edit/delete, posts, flags, attachment reads/downloads, and idempotent send retries respect the history boundary. R2 download authorization uses attachment RLS on every request.
- Late-join read tracking starts at the visibility floor. Rejoining establishes a new boundary; explicit forwarding creates a newly shared message.
- Validation: 84 automated tests and TypeScript checks passed; added database regression confirms pre-migration members retain old records. Live DB migration success verified; three-account device verification remains outstanding.
- General/team selection and consent-based conversion are design only: docs/GROUP_CHAT_DESIGN.md.
- Browser QA found the more-menu history cleanup immediately cancelled the new group dialog. Group dialogs now participate in overlay navigation and render outside the collapsible list, including on mobile.

## 2026-11-15 — Mycel release preparation
- Official branding changed to Mycel without changing origin, installation ID or persisted settings keys.
- Friends/chat/settings headings share typography and spacing. Group dialogs inherit app theme through an app-root portal, with an opaque surface fallback.
- General/team selection, role management, owner acceptance and unanimous conversion are implemented. 0020_team_chat.sql is locally validated but production application is waiting for approval after the SQL editor retained old text on the first attempt. The editor now contains only 0020.
- Local tests: 88 passing across 31 files; production build passes. Actual multi-device team conversion remains to be verified after production DB application.
- Detached desktop chat windows have a detailed design in DESKTOP_CHAT_WINDOWS.md; implementation is a future task.
- New checkout: D:/(개발)/Mycel/web-messenger. Git object integrity verified. Source remnants in the old locked folder are preserved; readable residual files match the copied versions.
- Production update: user executed the prepared 0020 SQL after approval review required manual confirmation. Supabase SQL Editor returned Success. No rows returned. Team DB migration is now applied; deployment can proceed.

## 2026-11-15 — Previous-history invitations
- Added 0021_history_invitation.sql and per-invitation consent UI. Default after-join access unchanged; team owner proposes named recipients, current members unanimously approve, owner completes admission within 72h.
- Full-history access includes accessible old messages/attachments/posts/notices, never restores deleted or expired original files. Ordinary re-invites do not reuse prior consent.
- Five database tests cover history/file/post access, unchanged unread positions, repeat/unauthorized calls, rejection/expiry/cancel, owner transfer, membership/policy changes and final-invite rollback.
- Production DB application and browser verification pending at this source preparation point.
- Production: 0021 applied successfully in Supabase SQL Editor. 0022 polling/scheduling RPCs applied; 0023 registered pg_cron job 3 for minute-by-minute dispatch. No existing messages/files were removed.
- Added clickable links/metadata cards, public polls and scheduled texts in the composer + menu. Validation: 100 tests across 34 files passed, TypeScript and production build passed. Production UI and real cron delivery are checked separately after deployment.

## 2026-11-15 익명 및 복수선택 투표 확장
- 새 투표 기본 익명, 실명 선택 가능. 작성자가 항목 수 이내 최대 선택 수 지정(최소 선택 1).
- 투표 제출/선택 변경 저장으로 한 번에 원자적 교체, 중복/범위/최대 개수 서버 검증.
- 익명 결과 RPC는 이름/사용자 ID/다른 사람별 응답을 반환하지 않으며 합계와 본인 선택만 제공. 방장도 동일. DB 운영자는 관리상 원시 데이터 접근 가능.
- 기존 공개 단일선택 투표 보존 및 구버전 RPC 호환. 게시 후 익명 여부 변경 불가.
- 0024_poll_options.sql 로컬 DB 테스트 통과. 운영 DB 실행은 자동 승인 검토가 명시 승인 부족으로 차단하여 미적용. 공개 사이트 배포도 새 스키마 적용 후 진행 필요.

- 후속: 사용자 0024 실행 승인 후 운영 DB 적용 성공 확인. 전체 101개 테스트 및 빌드 통과. 공개 배포 진행.


## 2026-11-15 — 개인·공간·대화 개편
- 주 탐색: 나 / 공간 / 대화 / 친구 / 설정. 공간 내부 채팅·일정·노트 동등 탭.
- 공간 채팅은 기존 chat_rooms ID를 대화 탭과 함께 사용. 메시지/읽음/알림 중복 생성 없음. 기존 일반 대화 자동 전환 없음.
- 개인·공간 캘린더 월간/목록, 일정 생성·수정·취소·휴지통 복원.
- 블록 노트, 표·링크·체크·순서·복제, 자동 저장 및 같은 블록 버전 충돌 감지, 기기 임시 입력 복구.
- 개인 원본의 공간 복사 권장, 명시적 원본 공유 read/comment/edit. 공간 소유 자료는 작성자 퇴장 후 유지.
- 일정·노트·수정 이력·댓글 이력·휴지통 자동 삭제 없음. 기존 첨부 파일 보관 정책과 독립. 노트 첨부/AI는 제외.
- 운영 Supabase 0025/0026 실행 Success 확인. DB 권한/영구보존/복사/댓글이력 7개 테스트 통과, 기존 포함 전체 테스트 106개 통과 후 2개 추가 검증 완료.
- 일정 자동 푸시 리마인더·반복 일정은 별도 후속 확장. 자료 갱신은 5초 간격; 글자 단위 동시 커서 편집은 지원하지 않음.
- 공개 배포와 실제 브라우저 검증은 이 기록 이후 진행.

- 공개 v41 배포 및 GitHub 735f41d 푸시 완료. 로그인된 운영 화면에서 검증용 단독 공간 생성, 메시지 전송→대화 탭 동일 메시지 확인, 일정 생성·수정, 노트 제목·블록·표 저장 및 재열기, 댓글과 이력 표시 확인.
- 390×844 휴대폰 / 768×1024 태블릿 크기에서 공간 채팅·캘린더 표시 확인. 실제 갤럭시 기기의 사용자 검증은 별도.
- 저장 응답 중 추가 입력을 보존하도록 블록 저장 직렬화 및 서버 조회의 오래된 응답 방지 보완. 최종 재배포 진행.

## 2026-11-16 — 내 메시지 색상
- 보낸 메시지와 전송 중 메시지를 연한 파란색(#e0edff) 배경, 검은색 계열(#111) 글씨로 변경. 공통 스타일로 기기·테마에 동일 적용.

## 2026-11-16 Mycel icon and page blocks
- Applied approved blue/white M icon to manifest, favicon, navigation and notifications.
- Renamed user-facing notes to pages; added per-block + and six-dot actions, slash search with keyboard selection, adjacent insertion and duplication.
- Existing block IDs, permissions and permanent revision histories retained.
- Supabase migration 0027 applied: SQL Editor returned Success. No rows returned.
- TypeScript check and 109 tests across 35 files passed. Public browser verification follows publication.

## 2026-11-16 Icon replacement
- Replaced app, navigation, favicon and notification icons with the user-selected cf2cb58c artwork. Versioned asset URLs retain existing PWA identity.

## 2026-11-16 Page interactions
- Added pointer/touch block dragging, insertion markers, auto-scroll, Escape cancellation and keyboard move alternatives.
- Added up to four columns, adjustable widths, single-column reset and narrow-screen stacking.
- Added selection-quote comments with immutable original text and conservative reattachment after edits.
- Enter at block end inserts a block; Shift+Enter retains a line break; Markdown shortcuts and block type conversion preserve existing workflows.
- DB and permission tests passed locally; live SQL and browser verification in progress.
- Live Supabase migration 0028 succeeded. Public browser verified drag-to-two-columns, persisted 52% width, quote-comment creation and jump-to-selected-text.
- Full suite: 110 tests passed, plus 2 new pure interaction tests passed. New-block focus now runs after the refreshed block is mounted.


## 2026-11-16 — 배지·스크롤 수정 및 설치 안내
- v48 배포 성공: 알림 표시 후 최신 숫자 배지 적용, 동일 계정 알림 재연결 시 기존 알림 보존, 서비스 워커 미지원 시 전경 배지 보완.
- 주기적인 메시지 갱신에서 사용자의 위쪽 스크롤 위치를 보존.
- 배포 소스 전체 113개 테스트 및 빌드 통과. GitHub main b48748c 반영.
- 설치 안내에 브라우저별 알림 등록, 앱 설치와 알림 켜기의 차이, Chrome 수신 확인 후 Edge 알림 해제 절차 추가. f50ff6a GitHub 반영, v49 배포 진행.
- 사용자가 Chrome 알림 켜기 이후 정상화를 보고했으나 데스크톱 숫자 실기기 검증은 미완료. CUA 브라우저 목록 요청이 반복 시간 초과.
- 페이지 편집기/0029(운영 DB 적용됨) 변경은 작업 폴더에 보존. 전체 작업 트리 115개 테스트 통과. 아직 공개 배포하지 않음.
- 공간 제거 및 나·대화 중심의 자료 소유/추가/복사/공유 권한 개편은 남은 작업. 완료로 보고하지 않음.

## 2026-11-16 — 개인·대화 중심 개편 준비
- 탐색: 나·대화·친구·설정. 각 대화에 채팅/일정/페이지 탭. 기존 공간 생성 UI와 팀채팅 전환 제한 제거. 기존 방/자료 ID 보존.
- 내 목록 연결 추가·제거와 개인 독립 복사 구분. 자료와 수정/댓글 이력의 자동 삭제 없음.
- 연속 블록 편집기, 서식 선택 도구, / 메뉴, 블록 이동/다단/열 너비, 인용 댓글 표시. 기존 블록 변환 테스트 추가.
- 타입 검사/118개 테스트/워커 빌드 통과. 운영 0029는 이전에 적용 성공. 0030은 로컬 DB 검증 통과, 운영 적용 대기.
- 브라우저 연결 시간 초과로 사용자에게 0030 실행을 요청함. 운영 적용 확인 전 개편 화면 배포하지 않음.
- 데스크톱/모바일 실제 화면 및 데스크톱 숫자 배지 검증은 미완료. 기존 배지·스크롤 수정과 설치 안내는 v49까지 배포 성공.


## 2026-11-17 페이지 저장 상태 정리
- 평소에는 작은 저장 상태 한 줄만 표시. 임시 문서를 현재 편집기 문서와 비교하여 다를 때만 복구 메뉴 표시.
- 복구 메뉴는 플로팅으로 표시하며 본문을 밀어내지 않음. 저장 성공 시 복구 표시 해제.

- 페이지 상단은 목록·댓글·더보기 한 줄로 정리. 자신의 저장 완료 응답은 본문을 다시 설정하지 않아 Enter 후 커서 이동을 방지하고, 외부 변경은 선택 위치를 보존함.

- 노션 데스크톱 비교 페이지에서 문단 분리, Shift+Enter, 제목·목록·체크·인용·표 Enter를 직접 확인. 인용 끝은 일반 문단 생성, 표는 다음 행 같은 열 이동(마지막 행 유지). 관련 자동 테스트 5개 통과.


## 2026-11-17 블록과 표 편집
- 노션 비교: 목록·인용 맨 앞 Backspace는 서식 해제 후 두 번째 입력에서 이전 블록과 합치기.
- 슬래시 메뉴 방향키·Home/End·Enter/Tab·Esc 및 선택 항목 스크롤.
- 표 행·열 포인터 드래그와 Alt+방향키 이동, 삽입·복제·내용 비우기·삭제, 머리글 행/열, 셀 병합/분할·정렬·배경색. 병합 셀이 있는 표에서는 복제와 열 핸들을 제한하여 구조 보존.
- 블록 6점 핸들은 연한 회색, hover/focus 때 강조. 관련 자동 테스트 8개 통과.

- 공개 사이트 실제 검증: 슬래시 방향키 선택·제목 해제, 행/열 포인터 드래그, 열 복제, 배경색, 다시 열기 후 내용 보존 확인. 표 선택 시 텍스트 풍선 도구 겹침 제거 및 복제 후 선택 유지 보완.


## 2026-11-17 표·블록 조작 개선
- 행/열 SVG 점 6개 방향·중앙 정렬, 첫 줄 블록 핸들, 오른쪽 댓글 버튼.
- 슬래시 방향키를 캡처 단계에서 처리하고 현재 선택을 명확히 표시.
- 병합 셀과 연결된 행/열을 한 묶음으로 이동·복제하여 셀 내용·서식·너비 유지. 드롭 위치 안내 및 180ms 이동 애니메이션, 동작 줄이기 설정 존중.
- 병합 셀 왕복 이동·복제·저장 변환과 기존 Enter/Backspace 회귀 테스트 14개 통과.

- 실제 공개 화면에서 슬래시 ↓/Enter, 병합 행 드래그, 병합 행·열 복제 확인. 전체 130개 테스트 통과.
- 페이지 왼쪽 여백 고정, 블록 첫 줄 핸들 및 오른쪽 댓글 아이콘 추가.
- 달력 요일 중앙·날짜 상단 작은 글씨, 일요일 및 2026–2027 대한민국 공휴일 빨간색. 미제공 연도 안내. 출처: 우주항공청 2026·2027 월력요항(2026.6.29 변경 포함).
- 대화 목록 접기 후 뒤로가면 목록 복원. 메시지별 점 세 개 제거, 우클릭/길게 누르기/Shift+F10 유지.

- 나 화면은 내 일정·내 페이지 탭으로 구성. 나와의 대화는 대화 탭의 자기 채팅 바로가기 버튼으로 구분.
- 나/대화의 자료 선택은 둥근 상단 모서리와 콘텐츠에 연결되는 활성 탭 디자인을 공통 적용.
- 블록 추가 +를 SVG로 변경해 점 6개와 중심선을 일치시키고 그립 표시 크기를 10×15px(가로형 15×10px)로 확대.


2026-11-17: 페이지 목록 상단 여백과 카드를 2줄로 축소. 표 내부 20px 여백으로 행/블록 핸들을 분리하고, 행·열 핸들을 편집기 상대 좌표에 배치하여 세로 스크롤 시 지연을 제거. 내용/서식/권한 변경 없음.


2026-11-18: 노션 비교용 표에서 파란 셀 테두리, 오른쪽 셀 메뉴(글자색/배경색/내용 비우기), Tab 이동 확인. Mycel에 선택 셀 표시와 셀 메뉴, 선택 영역 정렬·병합·분할을 추가. 색상은 셀 속성으로 저장하며 내용 비우기는 셀의 병합/너비/서식 보존. 표 블록 핸들의 pointerdown 기본 선택과 버블링을 차단하고 드래그 중 hover 대상 고정. 참고: https://www.notion.com/help/columns-headings-and-dividers

2026-11-18: 셀 메뉴 트리거를 20px 고정 크기와 중앙 SVG 점 세 개로 교정. 기본 메뉴를 224px 소형 패널로 정리하고 글자색/배경색은 색상 하위 화면으로 이동, 메뉴 내부 스크롤 제거.


## 2026-11-18 AI and personal navigation
- Implemented personal page tree using optional body.mycel_parent metadata, preserving permission and versioned save RPCs. No inherited permission changes.
- Friends nested in conversation navigation; settings modal; responsive personal drawer.
- User-scoped encrypted API credentials (OpenAI, Anthropic, Gemini) in R2. HKDF domain separation + AES-GCM bound to authenticated Supabase UUID/provider. No credentials returned to browser.
- AI panel, model discovery, explicit context, draft editing/copy, guarded apply to page, creation of personal pages/events through existing RPCs. Ollama loopback connections stored per user/device.
- Event meeting notes, browser SpeechRecognition transcription with consent, summary application and reviewed task-to-event registration. Original audio is not retained. Unsupported browsers show a text fallback; this is not system-audio capture.
- Notion research: inline AI / permission-filtered search / interactive Agent / autonomous Custom Agents are distinct. This release excludes autonomous execution and subscription OAuth.
- Local tests: 137 passed before final navigation changes; TypeScript and production build passed. Provider-paid requests and physical microphone recognition require user-configured credentials/device testing; not claimed verified.
- Deployment verification pending.

- Production version 66 deployed successfully; authenticated UI verified personal page list, friends within conversations, settings modal and AI connections panel. Corrected a shared search-wrapper flex rule that stretched personal sidebar spacing. Real paid inference / microphone / Ollama runtime remain user-device checks.

## 2026-11-18 list editing and AI onboarding
- Fixed task-item NodeView data-type so checkbox and editable paragraph share one row.
- Each top-level list item gets a handle target and independently saved block. Original list ID stays with first item; rich marks, checked state, order start and column metadata survive roundtrip. Existing pages are not rewritten until edited.
- Bullet/task indentation adjusted inward relative to numbered markers.
- Added API/Ollama step-by-step help and explicit subscription website copy/open/paste workflow. This is not automatic subscription inference or OAuth integration; hosted ChatGPT integration requires provider onboarding, and no provider credential/cookie extraction is used.
- Validation: 137-test suite passed; 2 new list regressions passed (targeted 10 tests); production build passed. Browser regression pending.

- Live Chrome regression passed: [] + space keeps text beside checkbox; Enter creates the next task; second item duplication affects only that item. Added API key format rejection before provider requests and suppressed browser login autofill on AI fields.

- Windows 로컬 Mycel용 ChatGPT 구독 연결 추가. Codex CLI 응답 검증과 Mycel OAuth 동의 검증을 구분한다.

- AI 패널에서 내 페이지 제목 검색 후 결과를 선택해 기존 편집기로 이동한다. Windows Chrome 로컬에서 실제 페이지 열기와 휴대폰 레이아웃의 본문 고정을 확인했다. Android 실기기 확인은 남아 있다.

Google Calendar 연동 1단계: 개인 일정 단건 조회 RPC 0031 추가. 운영 미적용. 예약 실행 및 무인 쓰기 미검증.
0032와 Sites /mcp, 개인 일정 연결·승인 화면을 로컬 구현. 시험 DB에서 승인·버전 충돌·재시도·휴지통·해제 검증. 운영 DB, ChatGPT 플러그인 설치, 예약 호출은 미검증.
2026-11-21: 운영 DB 0031·0032 적용 성공. 대화·설정으로 탐색 단순화, 휴대폰 하단 메뉴, 게시판 이름 적용. Mycel AI 제거. 캘린더 MCP 유지. 개인 자료는 나와의 대화에서 접근. 실제 MCP 동기화 검증 진행 중.

2026-11-21: 블록 +/그립 가로 위치를 목록 들여쓰기 대신 편집기·다단 열의 공통 기준선에 고정. 첫 줄 중앙 정렬, 구분선 중앙 정렬, 크기·내용 변경 시 위치 갱신. 저장 자료·권한 변경 없음.
검증: TypeScript 통과. 브라우저에서 14개 블록의 열별 왼쪽 좌표 및 첫 줄 중앙 일치 확인, 390px 폭에서 여백 유지. 기존 build/icons의 Windows EPERM으로 별도 출력 경로에서 Vite 및 Worker 빌드 완료.

2026-11-21: 주 탐색을 사람·공간·설정으로 정리. 기존 친구 화면을 독립 메뉴로 복원하고 대화 화면 제목만 공간으로 변경. 게시판/게시글 표시명은 노트로 통일. 내부 chats/friends/note 식별자, 데이터, 권한, PWA ID는 유지하며 과거 협업 공간 기능을 복원하지 않는다. 휴대폰은 하단 탐색 유지.

2026-11-21: 캘린더 MCP의 Cloudflare 미지원 redirect:error를 manual로 수정. 3xx는 성공으로 처리하지 않고 재요청하지 않는다. 기존 capability·승인·버전 검사 유지. 일정/노트 상단 중복 큰 제목 제거. 운영 시험 일정 검증 진행 중.

## 2026-11-21 Calendar production verification completed
- Public version 77, source 06329c936b5b27bceac20ae9c494f5a1a59cb7d0: Cloudflare unsupported redirect:error replaced by manual; rejects redirects without forwarding credentials. TypeScript, production build and 145 tests passed.
- User-authorized account pairing through actual Mycel calendar_pair succeeded. calendar_list and calendar_get_sync_status return both / primary. No fabricated authenticated headers or privileged database bypass.
- One explicitly labelled fixture only: Mycel f77f0c5e-e9b5-4e6f-aa54-dc0e9eaa43c4; Google b5sv4gnud3i7s6sdfe73q7vcrg. Existing events were not changed. Fixture retained on both sides, final time 2026-11-22 09:20–09:25 Asia/Seoul; Google reminders off, transparent, no other guests.
- Real flow: Mycel create approval -> version 1 -> same request retry returns version 1 -> create Google -> re-read both and record mapping -> Google edits title/time/description -> plan preview_update_in_mycel -> approved Mycel update version 2 -> re-read/record -> Mycel edit version 3 -> plan preview_update_in_google -> Google update -> re-read matching title/start/end/description/location -> record -> plan unchanged.
- Google connector read_event does not expose etag/updated. This fixture used an explicit normalized content snapshot string as google_version, not an asserted ETag. This detects observed content changes but does NOT guarantee atomic compare-and-swap on Google; unattended concurrent writers remain unverified.
- No recurring schedule created. Per-change Mycel approval remains required; unattended scheduled execution is not claimed verified.
- Duplicate large calendar/note headings removed and checked on production UI.

2026-11-21: 인증 대기 화면에 다른 이메일로 다시 가입·인증 메일 재발송·로그인 이동 추가. 기존 미인증 계정이나 인증된 계정의 이메일을 수정/삭제하지 않고 Supabase 공식 signUp/resend만 사용. 재시도는 새 이메일·비밀번호·사용자 ID 입력, 표시 이름·초대 문맥 유지. 이미 점유한 사용자 ID의 재사용은 제공하지 않음.
검증: 실제 메일/계정 생성 없이 로컬 Auth mock으로 가입→인증 대기→새 이메일 재가입, 표시 이름/초대 유지, 이메일/비밀번호/ID 초기화, 미인증 로그인→재발송 확인. 실제 메일 수신 검증은 수행하지 않음.

2026-11-21: 인증 전 이메일만 변경하는 개선 구현. AuthPanel의 새 계정 재가입 대신 기존 이메일+가입 비밀번호 확인 후 이메일만 변경. 사용자 ID·UUID·프로필·초대 문맥 유지. Supabase Edge 함수 signup-email에서 Auth password 검증 및 Admin API 호출, 이메일 인증 자동 완료 금지. 0033에 service_role 전용 호출 제한과 Auth 트랜잭션 내 동시 인증/변경 방지 guard 추가.
검증: TypeScript 통과, 전체 154 tests 통과(신규 9개 포함), Vite/Worker 빌드 통과. 운영 0033 SQL 적용 성공 및 signup-email Edge 함수 배포 확인(22:42 KST). 실제 서버의 잘못된 요청 거절과 호출 제한 확인; 기존 계정 변경/시험 메일 발송은 하지 않음. Admin 목록의 identities 생략을 고려해 단건 조회 후 자격 검증. 실제 메일 수신·새 인증 링크·최종 화면 검증은 별도 확인 필요. 컴퓨터 유즈 종료 후 프런트엔드 배포 진행. docs/SIGNUP_EMAIL_CHANGE.md 참고.

## 2026-11-21 Notes, comments, resource activity and navigation
- Three comment targets: whole note, block, selected text. Compact threaded drawer shows target, author, time and body; phone drawer opens on the right, accounts for visual viewport and closes before view navigation. Replies remain attached to their original thread.
- Larger bold note title; persistent toggle blocks via + and /토글 with rich-text roundtrip and keyboard behavior.
- Note list is a sortable/filterable table: creation-order number, title, creator, own permission, created/modified timestamps. Default is newest creation first. Numbers do not change with filtering/sorting; list sort/filter state survives opening a note and returning in the same session.
- Sharing (original or independent copy) uses explicit read/comment/edit ACL labels: 열람만 허용, 열람·댓글 허용, 열람·댓글·본문편집 허용. Shared message metadata links directly to the exact note/event; legacy share messages gain references without changing body or ID.
- 대화·일정·노트 tabs show unread message count / distinct new-or-modified item counts. User/scope/version receipts only acknowledge an opened visible item, not the whole tab. Own changes, revoked access, trash and join-history boundaries are covered by SQL tests.
- View back/forward integrates browser history, resource IDs, scroll restoration and calendar/list state. Flush edits before leaving; stop on save failure instead of discarding drafts.
- Production migrations 0034 and 0035 applied successfully through Supabase SQL Editor on 2026-11-21 23:18 KST. Existing content, accounts, files, comments and revision history retained. No recurring automation created.
- Validation: npm run check, npm test (50 files / 168 tests), npm run build all passed. SQL tests cover account/scope isolation, late join visibility, revoked access, version receipts, all three copy permissions and duplicate retry. Chrome UI fixture: 392 CSS-pixel phone drawer aligned to right edge; native Back closes only drawer; title edit -> calendar -> Back retains saved title; note table/default descending creation sort verified.
- Limits: UI fixture uses mock RPC, while permissions use real PostgreSQL-compatible PGlite migration tests. Physical Android keyboard/touch and real multi-device realtime delivery were not exercised. Build emits existing large-JS-chunk advisory, not an error.
- Public release/GitHub publication follows this source verification.

- Version 80 deployed successfully; GitHub/source 36eb0abc0b457f53428f6dc9e6af08923e7ca78a. Live authenticated PWA showed default 4→1 creation order, real creator/permission/date columns, event count 2 and note count 2. Opening one note changed its count 2→1; comment drawer and native Back worked. No messages/comments were sent.
- Live verification exposed an existing no-op autosave on opening the editor: Tiptap setEditable emitted update even without document changes. Disable that emission and ignore non-document update transactions, so viewing a note does not advance its content revision/modified date or notify other participants. Follow-up release verification follows.
- No-op autosave regression verified in Chrome fixture: opening the note, opening/closing comments and calendar/back navigation produced 0 save RPCs; editing body then navigating produced exactly 1, and returning restored the new text without another save. Full 168 tests, TypeScript and production build pass after this fix.

## 2026-11-21 Note editing navigation and usability follow-up
- Fixed dropped tab/list requests while saving and shared pending editor save promises. Pending title writes now use this client's returned document version. Bounded workspace RPC requests to 15 seconds.
- Reproduced revoked edit permission in the local fixture: draft remained visible, server save count stayed at 3, and List navigation succeeded. Reopening after refresh showed the available local-draft recovery control. Read-only edits are not sent to the server.
- Reproduced delayed writes (700 ms per RPC): immediately selected Schedule then Chat after editing; final selected tab was Chat, with content saved and restored on reopening.
- Note list has a funnel beside every column title; removed the separate filter block and note title search above the table. Filter/sort combinations retain original numbers. Checked title filtering/clearing and narrow-viewport popup placement through Chrome.
- Notion desktop comparison used its existing comparison page and a clearly labelled test toggle. Expanded title Enter inserts a new first child; collapsed title Enter inserts a sibling toggle. Mycel now implements those cases, nested insertion/indent/outdent, > Space, empty-toggle prompt and title-aligned controls. Existing rich child content and IDs round-trip through existing storage.
- No DB migration or access-policy change. Existing messages, files, calendar integration, note permissions, comments and histories are retained.
- Physical Galaxy device verification remains outstanding; local browser checks do not certify Android hardware behavior. Public deployment and GitHub push are the remaining release steps for this follow-up.
- Final validation: npm run check passed; npm test passed 182 tests / 51 files. The default Windows build output directory failed with EPERM on build/icons; the same Vite production build and build-r2 worker bundling succeeded in a clean temporary output directory, the generated Worker was copied back, while copying unchanged icon files into the locked default build directory was denied. Public deployment will rebuild the pushed source remotely if local archive packaging remains unavailable.


## 2026-11-22 · Note readability and phone toggle input
- Comment body/author/timestamps enlarged. Selecting a quoted comment or comment entry centers it within the comment scroller and retains thread/entry emphasis; supports keyboard selection and reduced motion.
- Note list shows cumulative read/comment/body-edit capabilities; permission filters match included capabilities. Creation date column removed; stable creation-order numbering and newest-created default remain. Note title has two-line creation/updated metadata, right aligned and wrapping on phones.
- Main navigation order: 공간 → 사람 → 설정.
- Closed toggle title Enter now creates an ordinary sibling paragraph (explicit user preference); open title Enter enters its body. Android beforeinput insertParagraph uses the same command without a keydown; composition/noncancelable events are not intercepted. Collapse places a hidden-body caret at the title end. Arrow uses an 8×10 triangle in a 16px icon; empty body gray, populated body text color.
- Chrome 390×844 fixture QA: slash toggle insertion, open/closed mobile-style beforeinput, inner text retention, external paragraph placement; modified note → 일정/대화/목록 with delayed saves and content retained. Comment selection emphasis verified visually. Physical Galaxy/IME not available; viewport/input-event simulation is not a real-device pass.
- 185 tests and type check passed before final packaging. No DB migrations, account, content or permission-policy changes.

## 2026-11-22 — 노트 확장 및 전환 메뉴
- 하위 노트 /노트, 상위 노트 권한 상속, 트리 목록과 경로 탐색. 하위 노트 이동은 서버 API만 제공하며 UI는 후속.
- /이미지·/파일, 붙여넣기·드롭 업로드, 영구 보존 첨부와 복제 노트 접근 권한.
- 전체·블록·선택 문장 댓글을 플로팅 창으로 통일. 블록 전체 댓글 대상 표시.
- /탭 및 토글 제목 1·2·3, 빈 토글은 윤곽 삼각형, 내용이 있으면 채운 삼각형.
- /동기화, 복사하여 동기화, 원본/대상 양쪽 권한 검사, 버전 충돌 방지, 영구 수정 이력, 동기화 해제.
- 점 6개 메뉴의 전환 하위 메뉴: 텍스트·제목·목록·체크박스·인용·토글. 현재 형식 체크, 내용 손실 위험이 있는 전환 비활성화. 메뉴가 열린 블록 전체에 파란 선택 표시.
- 운영 Supabase에 0036·0037·0038 적용: Aside SQL Editor에서 각각 Success. No rows returned 확인. 기존 데이터 삭제 없음.
- 자동 검사: TypeScript 성공, Vitest 54개 파일 / 196개 테스트 성공. 로컬 UI에서 댓글, 하위 노트, 탭, 토글 Enter, 동기화 전파·해제, 전환·선택 표시 확인.
- 휴대폰 크기와 beforeinput은 시뮬레이션 검증. 실제 Galaxy 키보드 및 운영 첨부 업로드 검증은 아직 완료되지 않음.
- 위 항목이 이전 초안의 DB 미적용·오른쪽 댓글 패널 기록을 대체함. 배포 결과는 완료 후 기록.

### 배포 및 운영 확인 완료
- 공개 사이트 v83 배포 성공. GitHub main에 기능 소스 커밋·푸시 완료.
- 운영 시험 노트에서 점6개 메뉴의 블록 전체 선택 강조·전환 메뉴, 동기화 블록 생성, 하위 노트 생성·권한 상속 표시, 제목/본문 수정 직후 일정 이동 및 뒤로 복귀 후 내용 보존 확인.
- 검증은 새 시험 노트에서만 수행했으며 기존 노트 내용은 변경하지 않음. 운영 자료 식별자는 공개 기록에 포함하지 않음.
- 파일 chooser는 Chrome ChatGPT 확장의 file URL 접근 제한으로 실패. 실제 운영 업로드/다운로드는 미검증이며, Worker/DB 자동 테스트만 통과. 실제 Galaxy IME도 미검증.
- 로컬 배포 archive 패키징 실패 후 동일 소스로 서버 빌드하여 배포 완료.

## 2026-11-22 — 블록 메뉴 배치
- + / 점6개 / 전환 메뉴를 대상 블록 바깥에 배치: 왼쪽, 오른쪽, 아래/위의 여유 공간 순으로 판단.
- 화면에 큰 블록이 가득 찬 경우 메뉴 높이를 줄여 활성 줄 반대쪽 가장자리로 배치. 스크롤·창 크기·가상 키보드의 visualViewport 변화에 맞춰 갱신.
- TypeScript 검사 및 위치 회귀 테스트 6개 통과. 로컬 브라우저 390×844에서 +와 전환 메뉴가 블록을 가리지 않는 것을 실제 DOM 경계로 확인. 실제 휴대폰 기기 검증은 아님.


## 2026-11-22 — 아이콘·블록 메뉴·탭 간격
- 공통 선택기: 이모지/아이콘/업로드, 검색·최근·즐겨찾기, 10색과 기본 색상/매번 선택하기. Unicode 이모지와 공개 Lucide 아이콘을 사용하며 Notion의 전용 도형 목록을 복제하지 않음.
- 노트 본문에서 :fire·:웃음 추천, 방향키/Enter 선택, 문장 중간 /아이콘·/이모지 삽입. 노트·탭 대표 아이콘 및 기존 일정 대표 선택기 연동.
- 동기화 블록 안내는 선택한 동안 블록 위에 표시. 전환/색/목록 형식은 별도 인접 메뉴, 메뉴 아이콘 표시. 한 단으로 펼치기는 다단 내부에서만 표시.
- 선택된 탭 재클릭으로 이름·아이콘·링크 메뉴 표시. 한 줄 탭의 고정 최소 높이 제거. 다단은 64px 간격으로 조작 여백을 확보하고 경계는 오른쪽 + 앞의 1px 선으로 표시.
- 클립보드 파일 items 대체 경로 및 동기화 블록 이미지 붙여넣기를 기존 첨부 API로 연결. 업로드 중 권한 변경 시 삽입 중단.
- 검증: TypeScript 및 59개 파일/213개 테스트 통과. 브라우저에서 문장 보존 이모지·아이콘 삽입, 탭 재클릭 메뉴, 탭 안 텍스트 붙여넣기, 390px 모바일 색상/보조 메뉴, 단 너비 조절/펼치기, 1px 경계와 버튼 비겹침 확인. 한 줄 탭 패널 높이가 본문 한 줄 높이와 같음 확인.
- 실제 Galaxy IME와 운영 이미지 붙여넣기는 별도 실기 검증이 남음. 기존 자료·권한·PWA 식별자·DB 스키마 변경 없음.

- 추가: 클릭한 일반 블록은 편집 중 은은한 파란 테두리, 동기화 블록은 선택 중 노란 테두리만 표시. 다른 블록/제목으로 이동할 때 이전 테두리 해제와 편집 중 유지 확인. 화면 장식이며 저장 데이터에는 포함하지 않음.
- 회원가입 이메일 입력칸에 실제 수신 가능한 주소와 인증 링크 완료 절차 안내. 버튼은 인증 메일 받기로 명시. 발송 후 주소·재발송·주소 변경 기능 유지.
- 최종 자동 검증: 60개 파일/215개 테스트 및 TypeScript 통과.

### 버전 86 배포 완료
- 공개 사이트 버전 86 배포 성공, 기능 소스 커밋 68aa2bf와 GitHub main 일치 확인.
- 운영 시험 하위 노트에서 클립보드 PNG 업로드·저장·새로고침 후 이미지 재표시 성공. 파일 설명 칸 클릭 시 해당 파일 블록의 편집 테두리 표시 확인. 위 운영 이미지 붙여넣기 미검증 기록을 대체함.
- 회원가입 안내와 인증 메일 받기 버튼은 로컬 브라우저에서 확인했으며 실제 가입 메일은 새로 발송하지 않음. 실제 Galaxy 키보드 검증은 남아 있음.
- 로컬 archive 포장 실패로 동일 푸시 소스의 서버 빌드를 사용. PWA 식별자·인증·RLS·기존 자료를 변경하지 않음.


## 2026-11-22 — 문장 서식·이미지 도구·블록 연결·콜아웃
- 문장 선택 시 글자색/배경색과 서식 도구, 더보기 블록 메뉴 표시. 전체 블록 색 상속 오류 및 동기화 편집기 중복 선택 도구 수정.
- 탭 제목 드래그 정렬, 사용자별 공간 자료 탭 순서(이 브라우저 저장), 다단 경계 1px 및 같은 너비 맞추기/경계 더블클릭.
- 이미지 hover/tap 도구: 댓글·캡션·비파괴 자르기·확대·원본 다운로드·더보기. 양쪽 가장자리 전체 드래그 리사이즈. 이미지의 파일명/용량 표시 제거, 빈 캡션은 편집 종료 시 숨김.
- 블록 링크는 권한 확인 후 읽기 전용 플로팅 미리보기, 바깥 클릭/Escape 닫기, 원본 이동 버튼에서만 위치 이동 및 일시 강조. 블록 이동 후에도 ID로 현재 위치를 조회.
- 블록 옮기기와 서버 기준 편집자/최종 편집 일시. 0039_block_actions.sql을 Aside의 기존 Supabase 프로젝트에 적용하여 성공 확인. page_block_info/page_block_move 존재, authenticated execute=true, anon execute=false 확인. 기존 블록의 미상 편집 시각은 다음 실제 수정부터 기록.
- 블록 이동은 두 노트 편집 권한, 버전 충돌 및 재시도 중복 방지, 첨부 연결, 하위 노트/동기화 참조 처리. 댓글 공개 범위/소유자가 달라지는 이동은 거절. 권한/원자성은 로컬 PGlite 검증이며 실제 사용자 자료를 이동한 검증은 아님.
- /콜아웃 및 전환 메뉴: 기본 전구, 배경/글자색, 이모지·색상 아이콘·업로드 대표 이미지, 내부 내용 보존. 빈 마지막 줄 Enter로 빠져나오기.
- 공통 아이콘 선택 목록을 Font Awesome Free의 채움형 1,421개로 변경. 기존 Lucide 토큰 표시 및 최근/즐겨찾기 호환 유지. 10색, 기본 색, 매번 선택 옵션 유지. public/font-awesome-LICENSE.txt와 SVG 저작자 표기 포함.
- 이모지/아이콘 카테고리는 그림 버튼으로 이동하며 전체 목록에 텍스트 구분 제목 표시. 가로 스크롤 제거, 최근/즐겨찾기·검색 유지.
- 로컬 브라우저 확인: 부분/전체/동기화 글자색, 탭 정렬, 이미지 파일명/빈 캡션 숨김, 양쪽 리사이즈, 자르기/확대/원본 다운로드, 단 너비 균등, 콜아웃 생성·아이콘 선택·다른 화면 이동 후 본문 유지, 링크 붙여넣기·미리보기·닫기·원본 강조, 채움형 빨강 하트 선택. 390×844에서 카테고리 이동과 가로 넘침 없음, 미리보기 폭 366px 및 내용 높이 맞춤 확인.
- 휴대폰 검증은 브라우저 화면/입력 시뮬레이션. 실제 Galaxy 키보드/터치 기기 검증은 별도 남음. 공개 배포 결과는 아래에 기록.

- 최종 자동 검사: 64개 파일 / 226개 테스트, TypeScript, 프로덕션 Vite/Worker 빌드 성공.

- 노트 제목 옆 날짜를 생성 일자 / 수정 일자로 통일하고 공통 열로 정렬. 수정 일시만 파란색으로 표시.

### 버전 87 배포 완료
- 공개 사이트 버전 87 배포 성공. 기능 소스 6a9f09e8b827505c9d051a0cc3a0469a419bc2b7 GitHub main 푸시 완료.
- 로컬 archive 포장 실패로 동일 소스의 서버 빌드를 사용. 226개 자동 테스트 및 로컬 브라우저 확인 결과는 위와 같으며, 배포 후 실제 Galaxy/운영 블록 이동 검증은 수행하지 않음.

## 2026-11-22 — 공간 언급·짧은 블록 참조·이미지 배치
- 노트 본문 @: 같은 공간 참여자와 게시 노트(하위 노트 포함), 오늘/내일/어제·날짜 직접 선택. 서버에서 노트 접근과 게시 공간을 확인하고 검색 범위를 제한. 사람 언급은 인라인 참조이며 알림 발송, 날짜 알림 예약은 이번 범위에 포함하지 않음.
- 0040_note_mentions.sql을 Aside의 기존 Supabase SQL Editor에서 실행하여 Success 확인. 공간 밖 조회·공유 해제·익명 호출 거절은 로컬 PGlite 테스트로 검증.
- 블록 URL은 본문 앞 30자(공백 포함, 줄바꿈 축약)와 말줄임으로 자동 표시. 플로팅 미리보기의 표시 이름 변경, 바깥 클릭 닫기, 원본 이동 버튼 지원. 미리보기를 body 포털로 옮겨 상위 레이아웃에 잘리는 문제 수정.
- 이미지의 실제 좌우 가장자리와 리사이즈 영역을 일치시키고 원본 비율 유지. 이미지 도구에서 왼쪽/가운데/오른쪽 맞춤 선택 및 저장.
- TypeScript 및 65개 파일/230개 테스트 통과. 로컬 브라우저에서 사람·날짜·노트 언급 삽입/복원, 짧은 링크 붙여넣기/이름 변경/미리보기/이동, 이미지 양쪽 드래그·세 가지 맞춤·저장 후 복원 확인. 실제 Galaxy 터치 및 운영 계정으로 새 기능의 전체 흐름 검증은 별도 남음.
### 버전 88 배포 완료
- 공개 사이트 버전 88 배포 성공. 기능 소스 bea567ba36abaceda2b20ee1d7c5e854f7fdf5e5 GitHub main 푸시 완료.
- 로컬 archive 포장 실패 후 동일 소스 서버 빌드로 배포. TypeScript/프로덕션 빌드 성공 및 230개 자동 테스트 통과. 추가로 동기화 블록의 달력 날짜 선택을 브라우저에서 확인하고 포커스 이동 시 목록이 일찍 닫히는 문제 수정.
- 배포 성공은 Sites 배포 상태로 확인했으며 실제 운영 사용자 노트의 새 기능 조작은 수행하지 않음.
## 2026-11-22 언급 알림·모바일 미리보기 보완
- 새 사람 언급을 노트 저장과 함께 영구 알림으로 기록한다. 같은 공간 참여·노트 권한·차단을 검사하고 mention ID로 재시도 중복을 방지한다. 기존 언급·자기 언급은 소급 알림을 만들지 않는다.
- 앱의 알림 목록 및 기존 Web Push 큐에 연결했다. 알림 클릭 시 서버에서 현재 접근 권한/위치를 다시 확인하여 노트의 언급으로 이동한다. 탭/토글은 표시 상태만 열고 원본 문서를 수정하지 않는다. 삭제/권한 회수된 언급은 표시·전송하지 않는다.
- 0041 SQL을 Aside의 Supabase SQL Editor에서 적용하여 Success 확인. 기존 push-dispatch Edge Function의 mentionId payload 추가도 Aside에서 배포했고 Last deployed a minute ago 확인.
- 한글 IME 조합 중 선택 시 조합을 먼저 확정하고 최종 범위를 교체한다. Chromium IME 입력으로 @민 → @민간인 선택 후 뒤에 민이 남지 않음을 확인.
- 블록 미리보기는 원문 편집기의 글자 크기를 사용한다. 휴대폰은 화면 높이 제한과 내부 스크롤, 이미지 높이 제한을 적용한다. 390×844 브라우저에서 원문/미리보기 모두 14px 및 창 358×160px 확인.
- 수정 일자 라벨과 일시 모두 #2563eb 적용 확인.
- 로컬 PGlite 권한/재시도/동기화/삭제/푸시 큐 및 SW 테스트 포함 65파일 238테스트 통과. 브라우저 fixture에서 알림 클릭 → 둘째 탭 자동 열기 → 실제 언급 포커스 확인. 실사용 두 계정의 새 언급 수신 및 실제 휴대폰 OS 푸시는 아직 별도 검증하지 않았다.- 공개 Sites v89 배포 성공: 소스 94fb73de342109adf39120436e8094c1a3451b41, deployment appgdep_6b027b57831c8191a751e48e63509104. Windows archive helper 실패 후 동일 원격 소스의 서버 빌드로 성공했다. GitHub main에 소스 커밋 푸시 완료.
- TypeScript 및 Vite/Worker 빌드 통과. 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site
## 2026-11-22 — 삼성 키보드 언급 입력과 터치 목록
- 언급 후보의 pointerdown 즉시 선택을 제거하고 완료된 click에서만 선택한다. 터치 스크롤은 브라우저에 맡기며 손가락 접촉 중 검색 결과 DOM 교체를 미룬다.
- 언급 선택 시 IME 연결을 종료하고 조합 종료 및 편집기 상태 안정화를 기다린 후 최종 검색 범위를 교체한다. 1.5초 내 조합이 끝나지 않으면 삽입하지 않는다. 커서는 언급 뒤로 명시적으로 이동한다.
- 언급 표시 이름은 CSS/접근성 이름으로 표시하여 Android IME 주변 텍스트에서 분리한다. 비어 있는 atom 옆 첫 조합이 중복되는 Chromium 동작을 막기 위해 화면 전용 zero-width guard를 둔다. 저장/클립보드는 기존 schema의 실제 이름과 ID를 보존한다.
- 로컬 Chromium 터치/IME 시뮬레이션: 긴 후보 목록 스와이프 시 삽입 없이 스크롤, 탭 완료 후 1회 삽입, @민 조합 중 선택 후 잔여 민 없음, 공백 제거 후 ㅇ→으→은 입력 시 @민간인은, 일반 텍스트/HTML 복사에 언급 이름과 ID 유지 확인.
- TypeScript 및 66개 파일 / 241개 테스트 통과. Vite 빌드 통과. 실제 Android 삼성 키보드 기기는 연결되지 않아 실기 검증은 남아 있다. DB/알림/권한 변경 없음.
### 버전 90 배포 완료
- 공개 Sites v90 배포 성공: 소스 835a84c52457ecb09abc61c3424579e67eb60c6e, deployment appgdep_6b028d2436508191a0def8d135c4e064. Windows archive helper 실패 후 동일 원격 소스의 서버 빌드로 성공했다.
- GitHub main 소스 푸시 및 원격 SHA 일치 확인. TypeScript, 241개 테스트, Vite/Worker 빌드 통과.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/
- 삼성 키보드 실기 검증은 수행하지 않았으며 로컬 Chromium 터치/IME 시뮬레이션 결과와 구분한다.
## 2026-11-22 — 날짜 언급 시간·리마인더와 모바일 하단 탐색
- 날짜 언급 클릭 시 달력, 종료일, 시간, 시간대, 날짜/시간 표시 형식과 리마인더를 설정한다. 기본값은 전체 날짜 / 24시간이며 상대 날짜와 오전·오후 12시간, 시간 숨김도 지원한다. 시간 숨김은 예약 시각을 지우지 않는다.
- 저장된 날짜 언급에서 본인 리마인더를 생성한다. 날짜만 지정하면 해당 시간대 09:00, 1/2일 전 옵션은 해당일 09:00이다. 분 단위 cron 처리, 재시도 중복 방지, 변경·삭제 시 기존 예약 취소, 접근 권한 재검사를 구현했다.
- 날짜 알림은 앱 알림 목록 및 기존 Web Push 경로에 연결된다. 알림 ID와 날짜 언급 ID를 구분하며 클릭 시 숨겨진 탭/토글을 열고 해당 위치로 이동한다.
- Aside에서 0042 SQL 적용 완료(cron job 4). 실제 서버에서 mycel-date-reminders 매분 실행/active=true, anon dispatch=false, authenticated preview=true, 서울 09:00의 30분 전 UTC 환산값을 확인했다. push-dispatch Edge Function도 Aside에서 배포 후 Last deployed a minute ago 확인.
- 알림 아이콘·라벨을 수직 중앙 정렬하고 배지를 종 아이콘에 고정했다. 휴대폰 앱 높이/상단 위치가 visualViewport를 따르며 확대 제스처 중 갱신을 멈춘다.
- 검증: 67개 파일 / 251개 자동 테스트 통과. 로컬 브라우저에서 기본값, 15:30→오후 3:30, 저장 후 복원, 시간 숨김 시 15:30 유지, 알림 클릭→둘째 탭 날짜 위치 이동을 확인했다. 390×844 터치 시뮬레이션에서 메뉴 화면 내 배치(360×820), 스와이프 스크롤 시 리마인더 미변경 확인. 480px 가시 높이 CSS 시뮬레이션에서 하단 탐색 bottom=480 및 아이콘 옆 배지 확인.
- 실제 삼성 키보드 기기 및 실사용 계정의 예약 푸시 수신은 아직 검증하지 않았으며, 로컬 DB/브라우저 결과와 구분한다.
### 버전 91 배포 완료
- 공개 Sites v91 배포 성공: 소스 384c98dda491774a54f72b99d6daed2dc960623a, deployment appgdep_6b02becf82a48191ab5f4dd6393fd77f. Windows archive helper 포장 실패 후 동일 원격 소스 서버 빌드로 성공했다.
- GitHub main에 기능 커밋 푸시 및 원격 SHA 일치 확인. TypeScript, 251개 테스트, Vite/Worker 빌드 통과.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/
## 2026-11-22 — 날짜·시각 입력 보완
- 시작 날짜/시각과 종료 날짜/시각을 각각 같은 그룹에 배치했다. 종료일을 켜면 시작보다 1시간 뒤로 기본 설정하고 자정을 넘으면 종료 날짜도 다음 날로 바꾼다. 역순 범위는 기존 저장 검증으로 거부한다.
- 시작·종료 시각 모두 1635 같은 네 자리 숫자를 16:35로 해석한다. 편집 중에도 저장값은 정규화하고 입력창을 벗어나면 콜론을 표시한다. 12시간 모드에서는 오전/오후 선택을 함께 반영한다.
- 리마인더 유무와 관계없이 본문의 날짜 언급을 파란색으로 표시한다.
- TypeScript 및 날짜 모델 7개 테스트 통과. 로컬 브라우저에서 1635 입력, 종료 기본값 17:35, 1805 종료 입력 저장/재열기, 23:30→다음 날 00:30, 시작/종료 그룹 배치와 파란색 렌더링 확인. 실제 삼성 키보드 기기 검증은 수행하지 않았다.
### 버전 92 배포 완료
- 공개 Sites v92 배포 성공: 소스 395301ed8eb2e88a372dbedcfdc9031f5ff2493b, deployment appgdep_6b02c37b5e5881918c08938831172e93. 로컬 archive 포장 실패 후 동일 소스 서버 빌드로 성공했다.
- GitHub main 기능 소스 푸시 완료. TypeScript, 날짜 모델 7개 테스트, Vite/Worker 빌드 통과 및 로컬 브라우저 검증 완료.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 시·분 덮어쓰기와 즉시 반영
- 시/분을 독립적인 숫자 입력으로 구성했다. 클릭/포커스 시 해당 영역을 선택하고 시 두 자리를 입력하면 분으로 이동한다. 15:40의 시에서 16, 이어서 39를 입력하면 16:39, 분에서 35를 입력하면 분만 35가 된다. 네 자리 시각 붙여넣기, 오전/오후 및 키보드 이동을 지원한다.
- 시작 날짜/시각 변경으로 종료가 시작보다 빨라지면 종료를 시작의 1시간 뒤로 보정한다. 정상적인 미래 종료값은 유지한다.
- 적용 버튼을 없애고 유효한 날짜/시각/형식/리마인더 변경을 즉시 편집기에 반영한다. 리마인더 검증 요청을 직렬화하고 뒤늦은 응답이 최신 선택을 덮어쓰지 않게 한다. 날짜 변경에도 기존 날짜 nodeView를 유지하여 창을 닫지 않는다.
- @ 후보의 위/아래 이동에 날짜 선택을 추가했다. 오늘→내일→어제→날짜 선택, 역방향 이동, Enter로 날짜 입력 및 실제 날짜 삽입을 로컬 브라우저에서 확인했다.
- 로컬 브라우저에서 시·분 덮어쓰기/연속 입력, 종료 자동 보정, 날짜·리마인더 즉시 반영/재열기, 12시간 입력, 잘못된 24시 거부, 자정 날짜 넘김, 390px 화면 배치를 확인했다. 느린 리마인더 응답 중 5분→10분 변경 시 최신 10분 유지도 확인했다. 삼성 키보드 실기 검증은 하지 않았다.
- 검증: TypeScript, 67개 파일/254개 자동 테스트, Vite/Worker 빌드 통과.
### 버전 93 배포 완료
- 공개 Sites v93 배포 성공: 소스 03a2fee7f7725cfb154d5d8c16d657cf0f344474, deployment appgdep_6b02c71b8d4c8191bcf56625b670602f. 로컬 archive 포장 실패 후 동일 원격 소스 서버 빌드로 성공했다.
- GitHub main 기능 커밋 푸시 완료. TypeScript, 254개 자동 테스트, Vite/Worker 빌드 및 로컬 브라우저 검증 통과.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 날짜 설정 정리와 공간 도구 배치
- 날짜 선택 창을 달력 → 일시 설정(종료일/시간 포함, 시작/종료 날짜·시각, 시간대) → 표시 형식 → 리마인더 순으로 정리했다. 기존 즉시 반영 동작을 유지한다.
- 검색 버튼을 공간 탭 줄 오른쪽으로 옮겼다. 현재 탭에 따라 대화 검색 또는 같은 공간의 노트/일정 제목 검색을 연다. 자료 결과 선택은 저장/권한 검사를 포함한 기존 이동 경로를 사용한다.
- 기존 상단 돋보기 자리에는 설정과 같은 FontSizeControl을 배치했다. 1% 축소/확대, 100% 복원, 설정창과 값 공유 및 저장을 유지한다.
- 공간 탭 기본 순서는 일정 → 노트 → 대화다. 이미 저장된 사용자별 순서는 보존한다. 드래그 중 다른 탭이 부드럽게 비켜나고 놓을 때 현재 화면 위치에서 최종 위치로 이동한다. 키보드 순서 이동에도 애니메이션을 적용하고 동작 줄이기 설정을 존중한다.
- 검증: TypeScript 및 254개 자동 테스트 통과, 후속 드래그 변경 뒤 탭 테스트 2개 재통과. 브라우저에서 제목 검색/빈 결과/결과 열기/일정 전환, 글자 크기 증가/감소, 기본 순서 및 드래그·키보드 이동/재로드 유지 확인. 날짜 창 320/390px, 상단 도구의 320px 구성 하네스에서 가로 넘침 없음 확인. 실제 휴대폰 기기 검증은 하지 않았다.
### 버전 94 배포 완료
- 공개 Sites v94 성공: 소스 fe0acc980ba3d3d081b98bbb17bba5dce8b2791e, deployment appgdep_6b02cf327f508191841b4125ac1fd21d. 로컬 archive 포장 실패 후 동일 원격 소스를 서버에서 빌드하여 배포했다.
- GitHub main 소스 푸시 완료. TypeScript, 254개 자동 테스트, 후속 탭 테스트 및 Vite/Worker 빌드 통과.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 설치 앱 알림 안내와 글자 크기 기준
- 로그인한 설치 앱에서 알림 미등록 시 안내창을 표시한다. 같은 창 세션에서 나중에를 누르면 자동 재표시를 억제하고, 화면 상단에 알림 켜기 안내를 유지한다. 일반 브라우저에서도 상단 안내로 등록할 수 있다.
- 알림 설정과 안내창은 단일 기기 상태를 공유한다. 사용자 클릭으로 권한을 요청하며, 서버 구독 등록과 Worker 사용자 연결이 성공한 후 안내를 숨긴다. 차단/지원하지 않는 환경에는 허용 방법을 안내하고, 등록 실패는 재시도할 수 있다. 이미 알림이 켜진 기기에는 안내하지 않는다.
- 안내 배너가 본문을 가리지 않도록 데스크톱/태블릿/휴대폰 그리드에 별도 상단 행을 추가한다. 기존 활성 대화 push presence 갱신을 유지한다.
- 새 100%는 데스크톱 기존 120%, 태블릿·휴대폰 기존 140%다. 기존 120/140% 저장값을 다시 곱하지 않도록 새 배율 저장 키를 사용하며 새 기준은 최초 100%로 시작한다. 이후 사용자 변경을 저장하고 설정/상단 버튼에서 공유한다.
- 고정 rem이던 노트 목록 제목/번호/생성자/권한/일시와 필터 글자가 전체 배율을 따르게 했다. 노트 목록 보조 버튼은 더 작은 12px 기준을 사용하며 모바일 터치 높이 44px를 유지한다.
- 공유 노트 목록과 휴지통을 별도 선택 버튼으로 배치하고 선택 상태를 표시한다. 노트 만들기는 우측 끝으로 이동했다.
- 검증: TypeScript, 68개 파일/261개 자동 테스트 통과. 브라우저 테스트 하네스에서 첫 안내, 나중에 후 배너 유지/재로드, 권한 차단, 서버 실패, 재시도 성공 후 안내 제거 및 설정 동기화를 확인했다. 글자 샘플은 새 100%에서 데스크톱 19.2px/태블릿·휴대폰 22.4px(기존 16px 기준), 모바일 101%에서 22.624px로 확인했다. 390px 화면에서 알림 창 가로 넘침 없음 및 목록 버튼 양끝 배치, 휴지통 전환 확인. 실제 기기의 OS 권한창과 실 푸시 수신은 이번 검증에 포함하지 않았다.

## 2026-11-22 — 휴지통 보관, 탐색·댓글 배치, 표와 텍스트 선택
- 노트 휴지통에 개별/전체 선택과 완전 삭제를 추가했다. 권한 4인 항목만 선택할 수 있고, 서버의 하위 노트/버전 검증 후 삭제한다. 복사본이 공유하는 첨부파일은 보존하고 참조가 없는 파일만 R2 정리 큐에 넣는다.
- migrations/0043_note_trash_retention.sql을 Supabase xpbfgppttnqmpevpumhd에 실제 적용했다. 휴지통 전환 시 trashed_at을 기록하고 30일 후 5분 간격 작업으로 삭제한다. 복원 후 다시 버리면 새로 30일을 계산한다. 기존 8개 항목에는 적용 시점부터 유예기간을 부여했으며 최초 만료는 2026-12-22 21:15:57 KST다. cron 작업 ID 5 활성, 일반 사용자 purge 및 익명 삭제 권한 없음, 누락된 timestamp 0개를 서버에서 확인했다. 실제 사용자 노트를 검증 목적으로 삭제하지 않았다.
- 앞/뒤 화면 이동은 공간 탭 줄 왼쪽으로 옮겼다. 공간 목록으로 돌아가기 버튼은 휴대폰에만 표시한다. 일정과 노트 목록의 공간 이름·자동 보존 안내 줄은 제거했다.
- 노트 목록 버튼은 제목 아이콘 앞에 배치했다. 제목 아래에 노트 댓글·블록 댓글·문구 댓글 개수와 종류별 열기 버튼을 두고 구분선 |는 연하게 표시한다.
- 시/분 입력을 13:23처럼 붙여 표시한다. 문장 선택 도구막대는 노트 콘텐츠 경계를 넘지 않도록 제한한다.
- 다단 경계의 col-resize가 공통 버튼 cursor:pointer보다 우선하도록 수정하고, 댓글 버튼이 경계를 덮지 않도록 경계의 우선순위를 높였다.
- 표 행·열 점 핸들 메뉴에 제목 행/열 전환, 글자색·배경색, 방향별 삽입, 복제, 내용 비우기, 삭제를 제공한다. 제목 전환은 임의의 선택 행/열에 적용되며 병합 셀과 연결된 범위를 함께 처리한다. 내용/서식/셀 너비/병합 상태를 유지한다.
- 첫 행 전체가 제목 셀인 표의 각 제목 셀에 정렬·필터 버튼을 제공한다. 숫자 및 자연순 정렬, 값 선택, 문구 포함, 빈 값 제외와 여러 열 조건 조합을 지원한다. 개인 보기는 별도 읽기 전용 표로 렌더링하여 원본 행 순서와 공유 문서를 변경하지 않는다. 사용자·노트·표별 localStorage에 설정을 저장한다. 원본 보기/편집은 조건을 해제하며 키보드나 알림으로 원본에 진입할 때도 원본을 보여준다. 병합 셀이 있으면 정렬·필터를 제한한다.
- 텍스트 드래그 중에는 서식 메뉴를 숨기고 블록 핸들 이동을 억제한다. 기존 선택 내부에서 새 드래그는 텍스트 이동 대신 새 선택을 만들며 native text drag를 막는다. 서버 본문 갱신도 선택 중이면 pointerup/cancel 뒤 반영한다.
- 검증: TypeScript 및 70개 파일/273개 자동 테스트, Vite 및 R2 Worker 빌드 통과. 로컬 DB에서 권한/하위노트/동시수정/30일 만료/복원/파일 공유 보존을 검증했다. 브라우저 하네스에서 휴지통 개별·전체 삭제 및 취소, 댓글 종류별 표시, 제목 행/열·색상·복제·비우기·삭제, 정렬/필터/새로고침 유지/원본 복귀(노트 저장 0회), 390px 필터 메뉴 경계, 다단 드래그 col-resize를 확인했다. 문장 선택 58→118자로 확장 중 메뉴 숨김, pointerup 후 표시, 기존 선택 내부 재선택 59자 및 원문/저장 횟수 불변, 이후 굵게 적용을 확인했다. 실제 삼성 키보드·OS 알림 수신은 이번 검증에 포함하지 않았다.
### 버전 95 배포 완료
- Sites 공개 v95 배포 성공: source 01bf669594bd7dfc9efe744d2ddcc9714492ab13, deployment appgdep_6b02e413d4d88191af996b1c8ba2cfe9. 로컬 archive 패키징 실패 후 동일 커밋의 원격 빌드로 배포했다.
- GitHub main에 동일 구현 커밋 푸시 완료. TypeScript, 273개 자동 테스트 및 프런트/Worker 빌드 통과.
- 공개 URL: https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 목록 글꼴, 개인 표 보기 편집, 인라인 댓글 및 터치 핸들
- 노트 목록의 제목/열 제목/생성자/권한/일시/개수와 노트 블록 본문은 동일한 --note-content-font-size를 사용한다. 새 100%와 사용자 확대 배율을 유지한다. 미확인 표식의 글자 중간 줄바꿈을 방지한다.
- 개인 정렬·필터 보기에서 셀을 눌러 편집할 수 있다. 안정된 셀 ID로 원본 셀의 변경된 내용만 반영하며 원본 행 순서와 숨겨진 행, 셀 속성 및 기존 서식은 보존한다. 편집 중에는 투영 화면 재정렬을 미루고 셀을 벗어나면 조건을 재평가한다. 읽기 권한에서는 편집할 수 없다. 원본과 편집 기준 내용이 달라진 경우 오래된 내용으로 덮어쓰지 않는다.
- 표 정렬·필터 버튼의 작은 문자 기호를 20px SVG로 교체했다. 버튼 크기는 유지한다.
- 사용자에게 표시되는 댓글 종류, 작성 버튼, 선택 대상 및 접근성 이름을 인라인 댓글로 통일했다. 저장된 phrase 분류와 기존 댓글/개수는 유지한다.
- 마우스 선택 드래그 억제 조건을 터치와 분리했다. 터치 pointerdown으로 블록을 선택하면 추가/이동 핸들이 표시되고 터치 스크롤 중에는 위치 선택을 반복하지 않는다.
- 검증: TypeScript 및 71개 파일/276개 자동 테스트 통과. 브라우저 하네스에서 정렬 후 원본 셀 수정/원본 순서 유지, 필터에서 제외되는 값 편집 후 화면에서만 숨김, 읽기 권한 편집 차단, 새 댓글 명칭, 20px 아이콘을 확인했다. 기본 목록/본문 글자는 desktop 19.2px, tablet/phone 22.4px로 각각 일치했다. 터치 이벤트로 두 핸들 표시와 추가 메뉴를 확인했다. 실제 휴대폰 및 삼성 키보드는 이번 검증에 포함하지 않았다.
### 버전 96 배포 완료
- Sites 공개 v96 성공. source f03d60c8a4b4de80fc6ba58b6de97bf9534b2b1b, deployment appgdep_6b02e9f04f708191ac275f3a22bf49d9. 로컬 패키징 실패 후 동일 소스의 원격 빌드로 배포했다.
- GitHub main 푸시, TypeScript/276개 테스트/Vite 및 Worker 빌드 완료. URL: https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 글자 크기 90%를 새 100%로 조정
- 데스크톱 기본 배율 1.2→1.08, 태블릿·휴대폰 1.4→1.26. 노트 본문과 목록은 새 100%에서 각각 17.28px/20.16px다.
- 저장 키 v3로 새 기준은 100%부터 시작한다. 기존 v2 확대값이 새 기본값에 다시 곱해지지 않는다. 이후 1% 조절, 100% 복원, 기기별 기본 배율 및 사용자 설정 저장은 유지한다.
- 최종 사용자 지정: 비율 계산값 대신 desktop 17px(1.0625), tablet/phone 20px(1.25)를 새 100%로 확정했다. v97은 저장만 하고 배포하지 않았으며 최종 배율로 다시 빌드한다.
### 버전 98 배포 완료
- 최종 기본 글자 크기 desktop 17px/tablet·phone 20px 적용. TypeScript, 관련 7개 테스트, Vite/Worker 빌드 통과.
- GitHub main 3cc6332c6ce0a2558f1cb694f3037e28a4c58786 푸시 완료. Sites v98 deployment appgdep_6b02ec5fcb088191a2ddc5e853531249 성공. 로컬 패키징 실패 후 같은 커밋의 원격 빌드로 배포했다. v97은 미배포다.
- https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 표 정렬·필터 아이콘 크기 조정
- 사용자 피드백에 따라 버튼의 크기/위치는 유지하고 내부 SVG만 20→14px, 선 두께 2.4→2로 축소했다. 노트 글자 크기 설정은 유지한다.

## 2026-11-22 — 정렬과 필터 버튼 분리
- 꺾인 화살표를 제거하고 각 제목 셀에 정렬(양방향 세로 화살표)과 필터(깔때기)를 나란히 배치했다. 각 버튼은 기존 25×24px를 유지하며 내부 아이콘은 20px의 타이트한 viewBox로 채웠다. 각 기능이 적용되면 해당 버튼만 활성 색상을 표시한다.
- 정렬 버튼에는 정렬 메뉴만, 필터 버튼에는 필터 메뉴만 표시한다. 제목 오른쪽 여백을 두 버튼 폭에 맞췄다.
- 브라우저 하네스에서 버튼 크기 유지, 각 메뉴 분리, 내림차순+문구 필터 동시 적용과 두 활성 표시를 확인했다.
### 버전 100 배포 완료
- 버튼 분리 최종 source c69b62d0615e1bc64b1349626a1474b25163db11 GitHub main 푸시. TypeScript 및 Vite/Worker 빌드 통과. 브라우저에서 메뉴 분리와 복합 정렬/필터 검증 완료.
- Sites v100 deployment appgdep_6b02efce98c881919382fe3d0e51ea1f 성공. 로컬 패키징 실패 후 동일 소스로 원격 빌드했다. URL https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 — 표 버튼 최종 크기와 배경
- 정렬·필터 버튼을 각각 20×20px, 내부 아이콘을 16×16px로 조정했다. 버튼 간격 2px 및 제목 여백도 조정했다.
- 흰색 배경 대신 옅은 파란색 #eaf2ff를 사용하며 활성 상태는 #d6e6ff로 구분한다. 어두운 테마는 대응하는 짙은 파랑을 사용한다.

## 2026-11-22 navigation and editor refinements
- Main rail/bottom navigation: desktop drag, touch long-press, Alt+arrow reorder; per-user local persistence and reduced-motion-aware transitions.
- Toggle SVG pointer targets now receive the normal active-block outline. All table cells, including headers, use 8px padding and zero paragraph margins.
- Verified: desktop drag/reload and no accidental navigation; synthetic touch long-press/drop; browser toggle outline and computed table padding. Native CDP touch emulation did not reliably target the fixture; physical Samsung device testing remains outstanding. TypeScript and 4 focused tests passed.
- v101 table controls deployment succeeded (20px buttons, 16px icons, pale blue backgrounds).
- v102 production deployment succeeded: e31673c7c26a8a96aced956686ab9f20009d408b; appgdep_6b02f4553a508191a32699fcbd929005. GitHub main pushed. Local archive packaging failed; supported remote build fallback succeeded. https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 callout and table controls
- Callout icon: transparent borderless button, centered against first text line; reset conflicting workspace button styles and first/last paragraph margins. Desktop and phone-layout browser fixture centers differ by less than 0.01px; icon picker still opens.
- Table sort/filter controls: transparent backgrounds, subtle 1px borders, active icon/border color; 20px controls and 16px icons retained. Browser computed dimensions verified.
- v103 deployment succeeded: 04959b54790237c259268779da1b1b84127d4f8c; appgdep_6b02f5bc6c648191b358a96b3688bf01. GitHub main pushed. Local package failure handled by successful remote build. https://web-messenger-jbh.myflair.chatgpt.site/

## 2026-11-22 stable editor save status
- Reserve 5em for the editor status label so save pending/saving/saved text cannot shift the icon button. Longer failure/action messages wrap without truncation.
- TypeScript and production build passed. v104 deployed successfully: 03c7959055e1d0fce36e176ffa51460b1f18e036; appgdep_6b02f7e4fc788191965f8ad42d9af57f. GitHub pushed. Local archive packaging failed; remote build succeeded.

## 2026-11-22 compact table header controls
- Sort/filter buttons 16x16px, SVG 15x15px; transparent background and thin border retained. Reserve 44px at the right of controlled header cells in source and projected tables. Browser verified dimensions and long text wrapping before controls.
- Refined centered headers: short labels center in the full cell; fit-content labels translate left only as they approach the 36px control reserve, then wrap. Browser checked short, medium, and multi-line text. Header inner width is refreshed on table layout changes; presentation-only custom property mutations are ignored.
- TypeScript/build passed; v105 production deployment succeeded: bc376e9149d396098461530c88391559fdfdd134; appgdep_6b02fa6297e081918669a59f878615aa. GitHub pushed. Local packaging failed; remote build succeeded.

## 2026-11-22 table controls above header
- Move sort/filter controls above cells: 16x8px buttons, 15x7px SVGs, 2px gap; transparent background/thin border retained. Invisible hit area is 18x20px. Reserve a stable strip above the table.
- Remove header width restrictions, translations and width-tracking mutations; normal full-width centered text restored. Browser measured dimensions/gap, zero center offset, controls above cells, and working sort menu.
