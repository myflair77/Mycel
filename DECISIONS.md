
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
