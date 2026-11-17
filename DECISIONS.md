
## 2026-11-14 파일 크기와 대화 알림
- 사용자 결정: 유료 전환 없이 Supabase Free, 파일당 50MB 유지.
- 대화 알림 끄기는 해당 계정의 모든 기기에 적용. 메시지 수신과 안 읽은 수는 유지.
- 드래그 앤 드롭은 첨부 파일을 선택하며 전송 버튼으로 보냄.

## 2026-11-14 R2 및 파일 만료 승인
- 로그인·실시간 채팅은 Supabase Free 유지, 신규 파일 저장만 Sites R2로 전환.
- 사용자 승인: 새 파일 30일 보관, 7일 전 안내, 만료 후 원본 삭제 및 메시지/파일명 유지. 기존 파일 자동 삭제 제외.
- 서버 권한은 Supabase 사용자 JWT/RLS로 확인. 서비스 역할 키 없이 HMAC 업로드 영수증을 DB에서 검증.

- 사용자 카카오톡 참고 이미지 반영: 첨부 사진에는 파일 정보를 상시 노출하지 않고 확대 화면으로 이동. 일반 파일은 간결한 카드로 표시.

2026-11-15: 개인 대화방은 self_owner UUID와 unique index로 계정당 하나를 보장한다. 기존 방/메시지를 변경하지 않으며 파일 300MB·30일 정책을 동일 적용한다.

2026-11-15: 표시 환경 조절은 설정 > 화면과 입력에 통합. 상단 표시 행과 대화 더보기의 중복 글자 조절 제거.

## Group chat behavior (2026-11-15)
Groups are separate from direct/self rooms. Maximum 50 active members. Current members can invite their accepted friends and rename the shared room. All members can leave; no ownership handoff is needed. Invite UI discloses visibility of old messages/files. Leave preserves server history for remaining members; re-entry requires invitation. Read counts exclude senders, departed members and messages preceding a member's join. Browser UI polls group roster/read state as a realtime fallback.

2026-11-15: Supersedes initial group history disclosure. Existing members keep their history; future joiners see only messages/files/posts after joining, including after rejoining. A 1:1 addition opens a separate group and preserves the original room. General/team selection and conversion remain a design proposal, not an implemented capability. See docs/GROUP_CHAT_DESIGN.md for unanimous consent and unchanged history boundaries.

## 2026-11-15 — Mycel and team chat
- Official display name is Mycel. Preserve the deployed origin, PWA ID, storage keys and existing data.
- Group conversion requires every current member to explicitly agree within 72 hours; the designated owner must separately accept the role. Reject, expiry, membership/policy change prevents conversion. Existing history floors remain unchanged.
- Team owners/admins manage invitations and notices; owner transfer requires acceptance. Private votes are exposed only as totals and the current user's own vote.
- Shared section heading layout and app-root dialog portals prevent inconsistent headings and transparent group dialogs.
- Desktop detached-chat behavior is documented in docs/DESKTOP_CHAT_WINDOWS.md; this iteration does not implement that design.
- Working checkout moved to D:/(개발)/Mycel/web-messenger. Old residual files are retained until the locked source can be safely cleaned up.

## 2026-11-15 — Team history invitation consent
- Team owners may propose full-history access for a fixed list of invited friends. Default invitations remain after-join only. Each existing member, including the owner, explicitly votes; the deadline is 72 hours, with no implicit consent.
- On unanimous approval the proposing owner completes admission. Final admission rechecks friendship/block/capacity conditions. Only those new members get visible_after_sequence=0; joined/read positions remain at admission to avoid old unread counts. Existing records, expiry and other members' visibility remain unchanged.
- Rejection, cancellation, expiration, membership or policy/owner change prevents admission under the proposal. Individual ballots are private; clients see totals and their own vote. Admission records name the recipients and scope.
- Existing owner transfer remains proposal + recipient acceptance. Ownership/policy changes invalidate active history consent.

## 2026-11-15 — Link previews, public polls and scheduled messages
- Clickable HTTP(S) URLs and lazy metadata cards. HTTPS previews use an authenticated Worker endpoint that verifies message RLS before fetching; no target receives the user's token/cookies. Private-network targets, unsafe redirects, oversized HTML/images and non-image formats are rejected. Failure leaves the original link usable.
- Composer + now offers files, public single-choice polls and scheduled text messages. Poll options 2–10; names/selections are public; users can change their vote before closure. Author or team manager can close. Existing history boundaries apply.
- Scheduled texts are private to the author before sending, editable/cancellable while pending, and dispatched by pg_cron once per minute. Server rechecks write permission/blocking and uses the schedule ID for idempotent sending. Failed jobs remain visible; no browser needs to remain open.
- Current limits: 50 group members, 100 pending scheduled texts per account, schedule within one year. Poll expiry 1 minute–30 days. No payment-plan changes.

## 투표 공개 범위와 선택 개수
신규 투표는 익명이 기본이며 실명은 프로필 이름 공개를 의미한다. 작성자는 1~선택지 수 범위의 최대 선택 수를 지정한다. 참가자는 1개 이상 상한 이하로 골라 명시적으로 제출/변경 저장한다. 익명은 다른 참여자와 방장에게 응답자를 숨기는 모델이며 운영 DB 자체의 무기명 저장은 아니다. 생성 이후 공개 범위/상한을 변경하지 않아 기존 투표자의 기대를 유지한다. 기존 실명 투표는 익명으로 소급 전환하지 않는다.


## 2026-11-17 페이지 저장 상태 정리
- 평소에는 작은 저장 상태 한 줄만 표시. 임시 문서를 현재 편집기 문서와 비교하여 다를 때만 복구 메뉴 표시.
- 복구 메뉴는 플로팅으로 표시하며 본문을 밀어내지 않음. 저장 성공 시 복구 표시 해제.

- 페이지 상단은 목록·댓글·더보기 한 줄로 정리. 자신의 저장 완료 응답은 본문을 다시 설정하지 않아 Enter 후 커서 이동을 방지하고, 외부 변경은 선택 위치를 보존함.

- Enter는 기본 문단·제목·목록 규칙을 유지하고, 노션에서 관찰한 인용 종료와 표 세로 이동만 명시적으로 보완한다. Shift+Enter는 기존 블록 내부 줄바꿈을 유지한다.


## 2026-11-17 블록과 표 편집
- 노션 비교: 목록·인용 맨 앞 Backspace는 서식 해제 후 두 번째 입력에서 이전 블록과 합치기.
- 슬래시 메뉴 방향키·Home/End·Enter/Tab·Esc 및 선택 항목 스크롤.
- 표 행·열 포인터 드래그와 Alt+방향키 이동, 삽입·복제·내용 비우기·삭제, 머리글 행/열, 셀 병합/분할·정렬·배경색. 병합 셀이 있는 표에서는 복제와 열 핸들을 제한하여 구조 보존.
- 블록 6점 핸들은 연한 회색, hover/focus 때 강조. 관련 자동 테스트 8개 통과.


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


2026-11-17: 페이지 목록 상단 여백과 카드를 2줄로 축소. 표 내부 20px 여백으로 행/블록 핸들을 분리하고, 행·열 핸들을 편집기 상대 좌표에 배치하여 세로 스크롤 시 지연을 제거. 내용/서식/권한 변경 없음.


2026-11-18: 노션 비교용 표에서 파란 셀 테두리, 오른쪽 셀 메뉴(글자색/배경색/내용 비우기), Tab 이동 확인. Mycel에 선택 셀 표시와 셀 메뉴, 선택 영역 정렬·병합·분할을 추가. 색상은 셀 속성으로 저장하며 내용 비우기는 셀의 병합/너비/서식 보존. 표 블록 핸들의 pointerdown 기본 선택과 버블링을 차단하고 드래그 중 hover 대상 고정. 참고: https://www.notion.com/help/columns-headings-and-dividers
