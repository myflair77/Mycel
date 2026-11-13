# Supabase 데이터 모델
현재 migration: migrations/0001_supabase_chat.sql.
profiles.id는 auth.users UUID. username 고유/소문자 3–24자.
chat_rooms.direct_key는 정렬된 사용자 UUID 쌍 UNIQUE. chat_members는 방/사용자 복합키.
messages는 sender/idempotency_key 및 room/sequence UNIQUE. 방별 순번으로 조회.
클라이언트는 SELECT만, 생성/전송은 인증된 RPC로 수행. RLS는 방 참여를 검사.
친구·차단·그룹·읽음·첨부파일은 다음 마이그레이션에서 추가. 기존 기록을 삭제하지 않는다.
