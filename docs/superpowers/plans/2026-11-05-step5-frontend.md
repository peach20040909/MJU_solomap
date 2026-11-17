# SoloMap 5단계 프론트엔드 연동 Implementation Plan

**Goal:** 기존 검색 화면에서 학교 인증, 공유 리뷰, 체크인과 성장 기록을 이용한다.
**Architecture:** 기존 main.js의 지도/검색을 유지하고 account.js에 세션 기반 계정·리뷰·마이페이지 흐름을 둔다. 모든 요청은 same-origin 쿠키를 사용하며 표시 난이도는 서버 displaySolo를 따른다.
**Tech Stack:** 기존 HTML/CSS/JavaScript, Express API, Puppeteer Core.
**Spec:** 사용자가 첨부한 단계 5 요구사항. 단계 6과 배포는 이번 범위 밖.

## Constraints / Review Focus
- 찜은 기존 localStorage 유지. 과거 로컬 리뷰는 서버 리뷰로 취급하지 않는다.
- 가입 API는 세션을 생성하지 않으므로 가입 후 login을 호출한다.
- 401은 로그인, 미인증 403은 인증 화면, 기타 실패는 showToast.
- 남의 리뷰 버튼 숨김, 409는 기존 리뷰 편집, 중복 클릭 방지.
- 늦게 도착한 응답과 로그아웃 이후 개인 정보/지도 마커 노출 방지.
- 사용자 콘텐츠는 escapeHtml 또는 textContent로 출력.

## Tasks
- [x] 브라우저 시나리오 작성 및 기존 화면에서 실패 확인.
- [x] index.html/style.css: 계정 모달, 내 성장 기록, 리뷰 목록/체크인 UI.
- [x] main.js/account.js: 공통 요청, 로그인→인증, 리뷰 CRUD, 서버 집계 재조회.
- [x] 마이페이지 목록과 정복/추천 지도 마커, 로그아웃 시 초기화.
- [x] 브라우저 회귀 검증, node --check, npm run typecheck 및 build.

## Execution notes
사용자가 이미 다음 단계 실행을 요청했고 .agents/rules/autonomous.md가 중간 승인을 생략하도록 지시하므로 현재 작업 폴더에서 직접 실행한다. 기존 미커밋 작업은 보존한다. 외부 서비스 검증은 실제 실행한 범위와 테스트 응답을 사용한 범위를 나누어 보고한다.

## Verification / review
- RED: 기존 로컬 리뷰가 서버 Lv.2를 덮어 Lv.5로 표시됨을 브라우저에서 재현 → 서버 displaySolo 표시로 GREEN.
- RED: 긴 마이페이지의 닫기 버튼이 화면 밖으로 나감 → 모달 높이/스크롤 제한으로 GREEN.
- 독립 reviewer Important: 전체화면 지도 z-index가 모달보다 높음. elementFromPoint 실패 재현 → 모달/토스트 순서 수정으로 GREEN.
- reviewer 검증 공백: 상세 fixture를 실제 API처럼 displaySolo 최상위 구조로 수정. 저장/삭제 후 카드 난이도 갱신 확인.
- RED: 로그인 직후 기존 정복 마커 없음 → 프로필 복원 때 방문/추천 조회하여 GREEN.
- `node scripts/test_account_ui.cjs`: 가입→로그인→인증/재발송429, 리뷰 CRUD/본인권한/XSS/409/401/403, 로그아웃204, 체크인, 정복/추천 마커, 전체화면 모달, 정렬/필터/찜/룰렛/390px 화면 통과. 외부 API 및 지도 SDK 경계는 fixture 사용.
- `npm run typecheck`, `npm run build`, `node --check public/main.js`, `node --check public/account.js` 통과.
- 실제 로컬 서버(3005): health200, auth/me401, 피자 검색200(22곳), 전체 검색128곳, Leaflet 실제 SDK 마커128개 및 pageerror0 확인.
- `.env`에 DATABASE_URL/DIRECT_URL/SESSION_SECRET/SMTP 설정 없음. 실제 DB 가입/리뷰/체크인 저장과 메일 발송은 미검증. 네이버 실제 지도는 현 Client ID/도메인 인증 실패가 표시되어 실제 타일/정복 마커 검증은 불가.
