# 배포 (미실행)
GitHub 비공개 저장소 생성/업로드와 Sites 배포는 사용자 승인 후.

새 PC: 저장소 clone → npm ci → npm run check → npm run dev. 소스와 DB/파일 데이터는 별도로 이전/백업한다.
Sites 정적 배포는 .openai/hosting.json project_id + static.directory=dist 필요. Worker는 dist/server/index.js default fetch ESM 필요. 등록 전 가짜 ID를 만들지 않는다.
Sites는 자체 소스 push/버전 저장/배포 절차가 있으며 GitHub push 자동 배포는 가정하지 않는다.
공개 URL의 실시간/인증 검증은 로컬 검증과 별개다.
