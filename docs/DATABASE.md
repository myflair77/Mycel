# 데이터 모델 초안
UUID를 계정 기본키로, 변경 가능한 username을 정규화된 고유키로 관리한다.

profiles, friend_requests, friendships, blocks, chat_rooms, chat_members, messages, read_states, attachments, invitations, reports를 분리한다.

친구 쌍과 1:1 방의 정렬된 두 UUID 조합에 UNIQUE. 메시지는 (sender_id, idempotency_key) UNIQUE 및 (room_id, sequence) UNIQUE. 서버가 순번을 할당하며 (room_id, sequence) 인덱스로 커서 페이지 조회한다.

친구 삭제는 메시지 삭제와 별개. 읽음 순번은 단조 증가. 그룹 탈퇴 시 이후 접근 거절을 기본안으로 검토. 방장 이양은 트랜잭션으로 진행.

파일 본문은 비공개 객체 저장소, 메타데이터만 DB. DB와 파일의 백업/복원을 함께 검증한다. DB 엔진 확정 후 제약·트랜잭션·권한 정책을 migration으로 구체화한다.
