# Windows에서 ChatGPT 구독으로 Mycel 사용하기

1. Windows에 Node.js 22.12 이상과 Git을 설치합니다. 이 저장소를 내려받고 프로젝트 폴더에서 `scripts/Mycel-PC.cmd`를 실행합니다. 처음 실행할 때 인터넷으로 공식 OpenAI DevKit을 받습니다. 개인용 로컬 배포입니다.
2. 열린 로컬 Mycel에 본인의 Mycel 계정으로 로그인합니다. 공개 사이트와 같은 Supabase 프로젝트 설정이 필요합니다. 새 체크아웃에서는 .env.example을 참고해 .env.production에 해당 프로젝트의 공개 URL과 publishable key를 지정하세요.
3. AI → 내 연결 → ChatGPT 구독 · Mycel PC → ChatGPT로 계속을 누릅니다. 브라우저에서 본인의 계정을 선택하고 Mycel PC가 구독 한도를 사용할 수 있도록 동의합니다.
4. 모델을 선택하고 질문·작성에서 요청을 보냅니다. 결과는 Mycel 안에서 확인하며 사용자가 선택하면 페이지에 적용할 수 있습니다. 로그인 시 모델 목록과 실제 질문의 응답은 별개입니다.
5. 연결 해제는 같은 내 연결 메뉴에서 합니다. 실행 창을 닫으면 PC 연결 프로그램이 종료됩니다.

주소는 http://127.0.0.1:41763 입니다. 실행기의 구독 API는 해당 주소에서 로그인한 Mycel 사용자만 사용할 수 있습니다. OAuth 자격증명은 Windows 사용자 보호(DPAPI)를 적용해 Mycel 계정별로 보관합니다. 공식 SDK는 고정 버전을 사용하며 자체 비상업용 라이선스가 적용됩니다.

Claude와 Gemini를 Mycel 안에서 사용하려면 공개 사이트의 Claude API 또는 Gemini API 연결을 사용하세요. 각 서비스의 개인 구독과 API 이용료는 별도입니다.
