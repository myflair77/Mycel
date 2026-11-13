# 설치와 화면 모드
PWA 하나를 데스크톱/태블릿/휴대폰에 설치하는 구조. 별도 EXE/DMG/APK/앱스토어 패키지는 이번 범위에 포함하지 않는다.
자동은 기기명/UA가 아닌 현재 창 CSS 너비 기준: 700 미만 휴대폰, 700–1099 태블릿, 1100 이상 데스크톱.
접기/펼치기·화면 회전·창 크기 변경 시 resize로 갱신. 수동 지정은 이 브라우저의 localStorage에 유지.
휴대폰은 단일 콘텐츠 패널, 태블릿은 좁은 탐색+목록+본문, 데스크톱은 넓은 3영역과 목록 너비 조정.
좁은 창에서 데스크톱/태블릿 강제 선택 시 가로 스크롤 제공. 화면 모드 선택기는 항상 현재 창 너비 안에 남아 자동 모드로 복귀 가능.
폰 모드는 넓은 화면에서도 단일 패널 구조 유지.

manifest 및 PNG 아이콘, standalone 시작, 브라우저 설치 이벤트 처리 제공.
PWA 설치는 HTTPS 또는 localhost와 지원 브라우저 필요. 앱 내 미리보기는 설치 프롬프트를 제공하지 않을 수 있음.
오프라인 대화/파일 기능은 미구현. 아직 서비스 워커 캐시를 추가하지 않았으며 인증 응답·대화 내용을 오프라인 저장하지 않는다.
macOS Safari는 Dock 추가, iOS/iPadOS는 공유 메뉴의 홈 화면 추가, Chromium은 앱 설치 메뉴 사용.
실제 Windows/macOS/Android/iOS 설치와 폴드 실기기는 HTTPS 배포 후 검증해야 한다. manifest 준비와 실제 설치 완료를 구분한다.
출처: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
