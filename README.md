# SoloMap | 명지대학교 혼밥지도

혼자 식사할 곳을 찾는 명지대 학우를 위한 식당 탐색 웹 서비스입니다. 일반적인 맛집 평점에 더해 5단계 혼밥 난이도와 식당별 안내를 제공하고, 지도·목록·랜덤 추천으로 선택을 돕습니다.

[서비스 보기](https://mju-solomap.onrender.com/) · [장민준 포트폴리오](https://jmj-archive-portfolio.ai.studio/) · [기술 의사결정과 트러블슈팅](TROUBLESHOOTING.md)

![혼밥지도 지도 화면](사진_캡쳐/presentation_after_map_naver.png)

## 문제와 구현

혼자 방문하기 편한 식당을 빠르게 찾도록 식당 탐색 기준과 화면을 설계했습니다. 개인 프로젝트로 기획과 개발을 진행했습니다.

- 지도와 식당 목록, 권역별 탐색, 오늘 뭐 먹지 랜덤 추천
- 카카오 로컬 API 검색 결과와 자체 식당 데이터를 함께 사용하는 검색
- 네이버 지도 연동과 지도 표시 문제에 대한 대응
- Gemini 기반 식당 안내 생성, 파일 캐시, API를 사용할 수 없을 때의 규칙 기반 대체 안내

혼밥 난이도와 AI 안내는 추천용 정보입니다. 이용자 리뷰의 실제 통계로 검증된 평가로 해석하지 않습니다.

## 설계와 배운 점

Express API가 외부 검색과 식당 큐레이션을 처리하고, 정적 웹 화면에 결과를 전달합니다. 이미 생성한 큐레이션은 캐시에 저장해 재사용합니다. 외부 API 실패 시에도 기본 탐색이 이어지도록 대체 흐름을 마련했습니다.

지도 API 연동, 데이터 매칭, 배포 환경 차이를 해결한 과정은 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)에 정리했습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 서버 | Node.js, Express 5, TypeScript |
| 웹 화면 | HTML, CSS, JavaScript |
| 외부 연동 | Kakao Local API, Naver Maps, Google Gemini |
| 배포 | Render |
| 데이터 | 식당 JSON, 큐레이션 파일 캐시 |

## 현재 범위와 후속 작업

현재 주요 범위는 식당 탐색과 지도, 추천 화면입니다. 회원가입·로그인·리뷰 CRUD 컨트롤러는 `501`을 반환하는 구현 예정 상태입니다. Prisma와 Supabase 기반 사용자·리뷰 저장은 후속 작업이며, 완료 기능으로 소개하지 않습니다.

## 실행

```bash
npm install
```

`.env.example`을 `.env`로 복사하고 필요한 키를 설정합니다.

```env
PORT=3000
KAKAO_REST_API_KEY=your_kakao_rest_api_key
GEMINI_API_KEY=your_gemini_api_key
NAVER_CLIENT_ID=your_naver_maps_client_id
```

Gemini 키 없이도 캐시 또는 규칙 기반 안내를 사용합니다. 지도 API는 사용 도메인 등록이 필요할 수 있습니다. 실제 키는 저장소에 올리지 않습니다.

```bash
npm run dev
npm run typecheck
npm run build
npm start
```

개발 주소는 `http://localhost:3000`이며, 서버 상태는 `GET /api/health`에서 확인합니다. 식당 검색은 `GET /api/places/search`입니다.

## 주요 코드

- `src/app.ts`: 정적 화면 및 API 라우터 등록
- `src/controllers/place.controller.ts`: 식당 검색과 데이터 통합
- `src/lib/kakao.ts`: 카카오 로컬 API 연결
- `src/lib/gemini.ts`: 큐레이션 생성, 캐시와 대체 안내
- `public/`: 지도와 식당 탐색 화면
