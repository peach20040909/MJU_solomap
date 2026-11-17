# SoloMap 디자인 시스템 1.2

**Goal:** 기존 오렌지와 기능을 유지하며 네이버 지도처럼 간결하고 실용적인 컴포넌트 위계를 만든다.

**Architecture:** 공통 토큰/버튼은 design-system.css, 화면별 의미와 배치는 style.css, 실제 예시는 design-system.html을 사용한다. JavaScript·API·DB는 변경하지 않는다.

## 기준

- 주요 액션/보조 액션/이동을 채움과 글자색으로 구분한다.
- 추천 메뉴·필터·보기 전환은 각 역할의 선택 상태를 가진다.
- 44px 터치, 16px 입력, 색 대비, 200% 확대, 키보드 모달 동작을 유지한다.
- 난이도 안내는 평면 범례, 식당은 카드로 구분한다.

## 작업

- [x] 사용자 방향 선택: 네이버 지도처럼 간결하고 실용적.
- [x] 토큰·버튼·타이포그래피 및 반복 컴포넌트 위계 정돈.
- [x] 공통 갤러리/사용 규칙/검수 기록 동기화.
- [x] PC·모바일·200%·대비·터치·모달·기존 기능 회귀, typecheck/build 통과.
- [x] 독립 검토 및 기존 Vercel 운영 주소 반영 확인. dpl_B2oZWFNp6qAphEtEdx8KYugiFaAQ READY, 운영 CSS/갤러리/API 200 및 accountConfigured=true 확인.
