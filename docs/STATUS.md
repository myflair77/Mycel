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
