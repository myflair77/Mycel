
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

2026-11-18: 셀 메뉴 트리거를 20px 고정 크기와 중앙 SVG 점 세 개로 교정. 기본 메뉴를 224px 소형 패널로 정리하고 글자색/배경색은 색상 하위 화면으로 이동, 메뉴 내부 스크롤 제거.


## 2026-11-18 Personal AI and meeting drafts
Use the existing Supabase user identity for every server AI request, never a client supplied owner ID. Encrypt user API keys in R2 with an HKDF-derived key from the existing runtime secret and per-user/provider context. Rotation of that runtime secret requires re-linking AI credentials. API origins are fixed; local Ollama requests run directly from the user's browser and accept loopback only.
AI cannot invoke arbitrary tools or change sharing. It proposes text; explicit user actions call existing version-checked, permission-checked save/create RPCs. Page application checks unchanged document snapshot; meeting application checks unchanged event body. Personal hierarchy metadata never grants access. Meetings and transcripts follow event retention/ACL/history; no audio blob retention. Public hosted subscription OAuth requires provider setup and remains unavailable, clearly labelled in settings. No unattended agents.

2026-11-18: Lists are editable item blocks, retaining the original wrapper ID on the first item for existing references. Task NodeView explicitly supplies data-type. Subscription website handoff is clearly separate from API/Ollama inference; users copy context intentionally and paste back responses. No claims of automatic web-subscription authentication.

Google Calendar 동기화는 ChatGPT의 사용자별 연결을 사용한다. Mycel 일정 API는 회의록을 제외한 일정 필드만 제공한다.
2026-11-21: 사용자 지시에 따라 Mycel 자체 AI 제거, ChatGPT 예약용 캘린더 MCP 유지. 개인 자료 접근은 나와의 대화로 통합. 휴대폰 탐색은 하단 대화·설정.

2026-11-21: 블록 조작 핸들은 같은 열에서 공통 왼쪽 여백을 사용한다. 제목·목록·인용·표의 내부 들여쓰기는 핸들 위치에 영향을 주지 않는다. 다단은 각 열을 기준으로 한다.

2026-11-21: 주 탐색을 사람·공간·설정으로 정리. 기존 친구 화면을 독립 메뉴로 복원하고 대화 화면 제목만 공간으로 변경. 게시판/게시글 표시명은 노트로 통일. 내부 chats/friends/note 식별자, 데이터, 권한, PWA ID는 유지하며 과거 협업 공간 기능을 복원하지 않는다. 휴대폰은 하단 탐색 유지.

2026-11-21: 캘린더 MCP의 Cloudflare 미지원 redirect:error를 manual로 수정. 3xx는 성공으로 처리하지 않고 재요청하지 않는다. 기존 capability·승인·버전 검사 유지. 일정/노트 상단 중복 큰 제목 제거. 운영 시험 일정 검증 진행 중.

2026-11-21: Google connector 응답에 ETag가 없으면 관측한 동기화 필드의 snapshot을 버전으로 구분한다. 이를 ETag 또는 원자적 동시 수정 보장으로 표현하지 않는다. 정기 실행은 생성하지 않으며 Mycel 변경 승인 정책을 유지한다.

2026-11-21: 인증 대기 화면에 다른 이메일로 다시 가입·인증 메일 재발송·로그인 이동 추가. 기존 미인증 계정이나 인증된 계정의 이메일을 수정/삭제하지 않고 Supabase 공식 signUp/resend만 사용. 재시도는 새 이메일·비밀번호·사용자 ID 입력, 표시 이름·초대 문맥 유지. 이미 점유한 사용자 ID의 재사용은 제공하지 않음.

2026-11-21: 미인증 가입자의 이메일 재시도는 사용자 ID를 재할당하지 않고 기존 Auth 사용자 이메일을 변경한다. 기존 이메일+비밀번호 증명, 미인증 email-only 계정 제한, 확인 완료/비밀번호/이메일 동시 변경에 대한 DB 트랜잭션 guard, 발송/변경 결과 구분을 적용한다. 관리 키를 Sites나 브라우저로 옮기지 않고 Supabase Edge의 기본 비밀 환경에 한정한다. 기존 2026-11-21의 새 사용자 ID 재가입 방식을 대체한다. 운영 0033과 signup-email 서버 적용 완료. 실제 메일 수신 검증과 모의 서버/DB 검증은 구분하여 보고한다.

## 2026-11-21 Resource confirmation and note sharing
- Keep note comments as whole-note, block and selected-text targets; replies are threading, not a separate target kind.
- Resource unread counts use per-user, per-room (or personal) monotonic version receipts. Open only the version actually rendered; a list/tab visit does not clear unread state. Preserve existing ACL and join-history checks by reusing workspace_list.
- Copies shared into rooms are independent personal items with explicit shares ACL, so the selected read/comment/edit setting is effective without broadening room-manager access. Existing room-native permissions remain unchanged.
- Store exact resource IDs in share messages instead of resolving by mutable/duplicate titles. Preserve original text and message identity during backfill.
- App history records room, resource tab and item, with scroll snapshots. Flush note/page edits before navigation; keep local drafts and cancel navigation on save failure. Browser Back closes comment overlays first.
- Note list numbering follows creation order; default display sorts newest first. Sorting/filtering does not renumber visible rows. Display label is 본문편집, without a space.

## 2026-11-21 Note navigation, column filters and toggle editing
- Navigation coalesces requests made during an in-flight save; the final selected destination wins. Editor flush shares its promise and drains newer input before leaving. Title saves use the version returned by this client's document save. RPC requests are bounded to 15 seconds.
- Permission loss never authorizes a write. Preserve an unsaved draft locally and allow navigation when edit permission has been revoked; an actual save failure while edit permission remains still blocks navigation. Read-only transactions are not marked dirty.
- Replace the separate note-filter bar with per-column funnel controls, including title and stable creation-order number ranges. Each column supports sorting and clearing its own filter; latest-created default and persistent per-list choices remain.
- Compared the open Notion desktop test page: Enter on an expanded toggle title creates a first child; on a collapsed title it creates a sibling toggle. Mycel preserves rich text and child content on split, supports > + Space, nested toggles via slash, Tab into a preceding toggle, Shift-Tab out, and Backspace to unwrap. Empty title Enter exits an empty toggle. Toggle controls align with its title rather than its first body paragraph.
- Separate the high-priority toggle input rule from the node schema ordering. Paragraph remains the default block, with explicit paragraph trailing-node configuration to prevent an invalid empty toggle on editor initialization.


## 2026-11-22 · Note presentation and toggle Enter
- Display all granted note capabilities; a capability filter includes higher permission levels. Hide creation-date list column without changing numbering/default creation sort. Keep creation/modified timestamps beside the document title.
- A selected comment is persistent UI state with explicit thread/entry emphasis and local-scroller centering; do not navigate the document just to select a comment.
- User overrides Notion-style closed-toggle continuation: closed title Enter exits into a paragraph; open title Enter enters the toggle body. Handle cancelable mobile beforeinput insertParagraph as well as hardware Enter, without intercepting IME composition or line breaks.

## 2026-11-22 노트의 연결과 블록 전환
- 하위 노트는 루트 공유 권한을 상속한다. 첨부는 채팅 만료 정책과 분리해 영구 보존한다.
- 동기화 블록은 본문을 복제하지 않고 별도 버전 자료를 참조한다. 원본 및 표시 노트 권한을 모두 만족해야 열람·편집 가능하다. 원본 기록과 수정 이력은 자동 삭제하지 않는다.
- 블록 전환은 기존 텍스트 서식과 하위 내용을 보존하며 한 번의 실행 취소로 복원한다. 목록 한 항목의 전환은 앞뒤 목록과 번호를 보존한다. 표·파일을 텍스트로 파괴적으로 바꾸는 동작은 제공하지 않는다.
- 점 6개 메뉴의 선택 강조는 화면 장식으로만 적용하며 노트 내용·이력에 저장하지 않는다.

## 2026-11-22 블록 메뉴 위치
블록 메뉴는 핸들의 클릭 좌표 대신 대상 블록 경계와 실제 메뉴 높이를 기준으로 배치한다. 충분한 여백이 없는 경우 먼저 메뉴 높이를 줄이며, 화면 전체를 차지하는 블록은 활성 첫 줄을 가리지 않는 가장자리 배치를 사용한다.


## 2026-11-22 아이콘과 편집 메뉴
- 이모지는 Unicode 텍스트, 색상 아이콘은 검증된 이름/10색 토큰 및 inline atom으로 저장한다. 사용자 업로드 대표 이미지는 크기가 제한된 PNG로 정규화한다. 임의 SVG/URL은 아이콘 값으로 실행하지 않는다.
- 아이콘 색상 선호는 기기에만 저장하고 실제 선택한 값은 노트에 보존한다. 글자색/배경과 번호 목록 형식 변경은 기존 서식 및 앞뒤 목록 번호를 유지한다.
- 다단의 48px 블록 조작 영역을 단 사이 여백에 확보하고, 경계선의 시각적 두께(1px)와 잡기 영역(12px)을 분리한다. 휴대폰에서는 기존 단 쌓기 방식을 유지한다.
- 탭 본문은 실제 내용의 높이로 계산하고 추가 빈 줄 높이를 예약하지 않는다.


## 2026-11-22 문장 서식과 블록 연결
- 부분 색상은 인라인 mark, 블록 색상은 상속 속성으로 저장하고 각각 독립적으로 초기화한다. 중첩 동기화 편집기는 포커스를 소유한 도구 하나만 표시한다.
- 블록 링크 클릭은 읽기 전용 미리보기로 통일한다. 기존 노트 권한 조회를 거치고 이동 버튼으로만 탐색한다. 영구 블록 ID와 서버 위치 조회로 이동 후 링크를 유지한다.
- 다른 노트로 블록 이동은 원자적 서버 트랜잭션이며 충돌/중복 재시도를 검사한다. 댓글의 공유 범위 또는 노트 소유자 변경이 발생할 이동은 거절한다. 실제 본문/서식 변경만 서버 편집 시각을 갱신하고 단순 위치 이동은 보존한다.
- 이미지 자르기는 원본 바이트를 변경하지 않고 여백 비율만 저장한다. 다운로드는 원본 파일이다. 파일명/용량은 일반 파일에 유지하고 이미지 본문에서는 숨긴다.
- 공통 대표/인라인 아이콘의 새 선택값은 Solid 접두사의 Font Awesome Free 채움형 도형과 10색 토큰이다. 기존 Lucide 저장값을 계속 렌더링한다. UI 조작 버튼은 기존 선형 아이콘을 유지한다. https://fontawesome.com/license/free 의 CC BY 4.0 표시를 포함한다.
- 카테고리 버튼은 목록을 필터링하지 않고 전체 목록의 제목 위치로 이동한다. 검색은 모든 카테고리에 적용한다. 작은 화면은 그림 버튼을 줄바꿈하여 가로 스크롤을 만들지 않는다.

- 노트 날짜 메타데이터는 라벨/일시의 두 열을 공유해 두 행을 정렬하고 수정 일시를 파란색으로 구분한다.

## 2026-11-22 사람 언급 알림
- 알림은 서버에서 저장된 본문을 대상으로 생성한다. 클라이언트가 보내는 알림 요청이나 재시도 payload를 신뢰하지 않는다. 알림 ID는 언급 노드 ID와 같으며 기존 노드 복사/재저장으로 재발송하지 않는다.
- 알림 목록과 목적지 열기 RPC는 수신자 전용이다. 접근 권한은 생성/목록/푸시/열기에서 재확인한다. 푸시 payload에는 본문이나 사람 이름을 포함하지 않는다.
- 앱 목록은 최근 100개를 제공하며 화면 활성 시 15초 주기로 갱신한다. 기존 채팅 읽음 정리는 언급 OS 알림을 지우지 않는다. 앱 아이콘 숫자 배지는 기존 채팅 기준을 유지한다.
- 포털 미리보기는 문서 본문의 computed font-size를 받아 원본보다 확대하지 않는다. 휴대폰 높이는 60dvh 이내이고 긴 내용은 내부에서 스크롤한다.
## 2026-11-22 모바일 언급 입력 경계
- 후보 선택은 pointerdown이 아닌 네이티브 click을 사용한다. 스크롤 제스처에서 선택을 발생시키지 않으며 접촉 중 후보 DOM을 교체하지 않는다.
- IME 종료는 두 프레임 지연으로 추정하지 않는다. 포커스를 이동해 native input 연결을 종료하고 composition 플래그와 editor state 안정화를 기다린 뒤 검색 범위를 다시 구한다. 종료되지 않은 조합은 제한 시간 후 취소한다.
- 인라인 언급의 표시 이름은 native 주변 텍스트와 분리한다. nodeView에는 비어 있지 않은 zero-width guard, CSS label 및 aria-label을 두고 문서/복사 데이터는 기존 schema serializers로 생성한다. 보조 문자는 저장하지 않는다.
## 2026-11-22 날짜 리마인더
- 날짜 표시 기본값은 전체 날짜, 시간 표시 기본값은 24시간이다. 표시 형식 변경은 예약을 재생성하지 않는다. 상대 날짜는 선택 시간대의 오늘/내일/어제에 적용하고 나머지는 전체 날짜로 표시한다.
- 리마인더는 설정한 본인만 받는다. 예약 의미(날짜·시각·시간대·리마인더)가 바뀌면 새 revision을 부여한다. 서버는 저장 완료된 본문만 읽고 recipient를 인증 사용자와 대조한다.
- 예약 ID를 알림 ID로 사용하고 목적지의 mention ID는 별도로 반환한다. 시간·권한·존재 여부를 발송/열기 때 재검사한다. 매분 처리하므로 예정 시각 직후 지연이 발생할 수 있다.
- 시간 숨김은 표시만 숨기고 실제 시각을 보존한다. 날짜만 있는 알림은 09:00, 1/2일 전은 이전 날짜의 09:00 기준이다. 존재하지 않는 DST 현지 시각은 거부한다.
- 휴대폰 하단 탐색은 visualViewport 크기에 맞춘 앱 안에 둔다. 확대 중 viewport 값을 갱신하지 않아 사용자의 줌을 보존한다.
## 2026-11-22 날짜 범위 입력
- 종료일 활성화의 기본 종료값은 시작 현지 날짜·시각에 1시간을 더한 값이다. 날짜만 사용하면 같은 날짜를 유지한다. 이후 사용자가 직접 만든 역순 범위는 자동으로 바꾸지 않고 저장 시 오류로 안내한다.
- 시각 입력은 HHmm과 H:mm/HH:mm을 받으며 저장 형식은 HH:mm이다. 네 자리 숫자의 앞 두 자리는 시, 뒤 두 자리는 분이다. 12시간 모드는 오전/오후와 함께 해석한다.
- 날짜 언급은 리마인더 유무와 관계없이 파란색을 사용한다.

## 2026-11-22 날짜 입력 후속 결정
- 이전의 시작 변경 시 역순 범위 수동 수정 규칙을 변경한다. 시작을 바꿔 종료보다 늦어지면 종료를 1시간 뒤로 자동 보정한다. 종료를 직접 잘못 입력한 경우는 계속 검증 오류로 처리한다.
- 시각은 시/분 선택 덮어쓰기와 두 자리 후 다음 영역 이동을 사용한다. 시각 값은 완성되거나 포커스를 벗어날 때 반영하며 미완성/범위 밖 값은 저장하지 않는다.
- 날짜 설정은 적용 버튼 없이 유효한 변경을 즉시 반영한다. 비동기 리마인더 검증은 순서를 보장하며 저장 실패는 창에 안내한다. 날짜 선택은 @ 메뉴 키보드 탐색의 마지막 항목이다.

## 2026-11-22 공간 검색·도구와 탭 순서
- 검색 범위는 현재 선택한 공간 탭이다. 대화는 기존 메시지 검색을 사용하고 노트/일정은 같은 공간의 접근 가능한 자료 제목을 검색한다. 본문 검색은 이번 범위에 포함하지 않는다.
- 검색은 탭 줄 오른쪽에 두고 검색 영역은 바로 아래 연다. 상단 공간 이름 줄에는 설정과 동일한 글자 크기 컨트롤을 둔다.
- 새 기본 순서는 일정/노트/대화다. 기존 개인별 저장 순서는 마이그레이션하거나 초기화하지 않는다.
- 드래그를 마칠 때 원래 위치로 복귀한 뒤 재정렬하지 않고 실제 미리보기 위치를 기준으로 애니메이션한다. prefers-reduced-motion에서는 애니메이션을 생략한다.
- 날짜 선택 창은 달력을 먼저 보여주고 시작/종료를 그 아래 일시 설정 그룹에 배치한다. 표시 형식과 리마인더는 별도 그룹으로 구분한다.

## 2026-11-22 알림 안내와 새 글자 기준
- 알림 권한은 사용자 동작으로 요청한다. 설치/로그인을 권한 허용으로 취급하지 않는다. 허용만 받고 서버 등록에 실패한 상태를 완료로 표시하지 않는다.
- 설치 앱의 미등록 사용자에게 창 세션당 첫 안내를 제공한다. 나중에/닫기 후에는 상단 안내를 유지한다. 직접 끈 알림을 자동으로 다시 켜지 않는다. 지원하지 않는 환경에는 설치/지원 브라우저 안내를 제공한다.
- 알림 상태와 현재 대화 presence는 ChatWorkspace의 단일 useDevicePush에서 관리하며 설정과 안내가 공유한다.
- 글자 배율 기준은 desktop=1.2, tablet/phone=1.4이며 표시하는 퍼센트는 그 기준에 대한 사용자 배율이다. 기존 배율 중복 적용을 막기 위해 v2 저장값을 처음 100%로 시작한다.
- 노트 목록은 기기와 무관하게 같은 배율 공식을 사용한다. 목록 도구는 작은 글자/충분한 터치 높이를 사용하고 공유 노트 목록·휴지통을 독립 버튼으로 둔다.

## 2026-11-22 휴지통과 개인별 표 보기
- 노트의 30일 보관은 휴지통으로 옮긴 시점 기준이다. 기존 휴지통 항목은 마이그레이션 시점부터 30일 유예한다. 보존 중인 하위 노트가 있으면 상위 노트를 먼저 지우지 않는다. 완전 삭제는 하위 항목까지 보여 주고 최신 버전과 모든 항목의 관리 권한을 다시 확인한다.
- 일정의 휴지통 정책은 변경하지 않는다. 노트의 삭제 큐는 기존 서명된 R2 보관 정리 경로에 통합하고 공유 첨부는 마지막 참조가 사라질 때만 정리한다.
- 댓글 개수는 해결되지 않은 스레드의 삭제되지 않은 댓글/답글 수이며 답글의 종류는 루트 댓글을 따른다. 명칭은 노트 댓글/블록 댓글/인라인 댓글로 통일한다.
- 표 제목 행/열은 셀 종류를 전환하는 서식 기능이다. 정렬·필터는 첫 행 전체가 제목인 병합 없는 표에서 제공한다. 조건은 계정·노트·표별 기기 저장값이며 공유 원본을 정렬하거나 삭제하지 않는다. 읽기 전용 투영에서 원본 보기로 돌아오면 원래 순서를 유지한다. 제목 셀 ID로 조건을 식별하여 열 이동 시 대상이 뒤바뀌지 않게 한다.
- 본문 선택은 마우스를 놓기 전에는 도구막대를 표시하지 않는다. 블록 이동은 전용 핸들로 유지하고 선택 문장의 native drag 이동을 억제한다. 다단 너비 조절은 표와 같은 col-resize를 사용한다.

- 2026-11-22: 노트 목록과 블록 본문 기본 글꼴은 같은 토큰을 공유한다. 표 개인 정렬·필터 상태의 편집은 안정된 셀 ID에 대한 최소 내용 변경으로 원본에 반영하며 행 순서는 변경하지 않는다. 편집 중인 셀은 화면 재정렬로 제거하지 않는다. 사용자 표기는 노트 댓글/블록 댓글/인라인 댓글이며 기존 데이터 분류 phrase는 유지한다.

- 2026-11-22: 모든 기기의 기존 기본 글자 크기 90%를 새 100%로 정의한다. desktop 1.08, tablet/phone 1.26 배율과 v3 저장 키를 사용한다. 기존 저장된 확대 배율은 이 기준 전환에서 초기화하며 이후 선택은 보존한다.
- 위 90% 조정 요청의 최종값은 정확히 desktop 17px, tablet/phone 20px이다. 16px 기준 배율 1.0625/1.25로 확정하며 v3 최초 100% 동작은 유지한다.
- 2026-11-22: 표 정렬·필터 버튼 내부 SVG는 14px/선 두께 2를 사용한다. 클릭 영역 크기는 유지한다.
- 2026-11-22: 표 제목의 정렬과 필터는 별도 버튼/메뉴로 제공한다. 꺾인 표시 대신 세로 화살표/깔때기를 쓰며 버튼은 25×24px, 내부 SVG는 타이트한 viewBox의 20px다. 정렬 중에는 해당 방향 화살표를 표시한다.
- 2026-11-22: 표 정렬·필터 버튼의 최종 지정값은 20×20px / 내부 SVG 16×16px, 옅은 파란색 배경이다. 버튼을 확대하지 않는다.

## 2026-11-22
- Main navigation order is stored per user in this browser/device. Notification portal uses a keyed slot to preserve DOM/tab order.
- Active-block tracking accepts SVG targets so toggle triangles behave like block content.
- Table cell padding is uniformly 8px, including title rows/columns; remove extra header right padding and paragraph vertical margins.

- Callout icon buttons inherit body font size for line-height alignment, while glyphs remain 22px. Table controls use transparent backgrounds with subtle outlines, including dark mode.
