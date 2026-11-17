# SoloMap 강의자료 연동 방식 검토

검토일: 2026-11-10. 대상: 현재 로컬 작업 트리. 앱 코드, DB 데이터, 배포 설정은 변경하지 않았다.

> 아래는 수정 전 검토 기록이다. 이후 사용자 요청으로 Prisma 7.10.1 전환 및 우선 오류 3건을 수정했다. 최신 결과는 [수정·검증 기록](PRISMA7_ERROR_HANDLING.md)을 참고한다.

## 결론

Express → Router → Controller → 데이터 접근 계층 → Prisma → Supabase PostgreSQL이라는 핵심 흐름은 강의와 일치한다. 다만 강의의 Prisma 7.10 설정을 그대로 따른 프로젝트는 아니다. 현재 설치된 Prisma는 6.19.3이며, 이에 맞는 schema.prisma 및 Client 초기화 방식을 사용한다. 버전 차이 자체는 연결 오류가 아니다.

강의의 버전·파일 구조까지 동일해야 하는 과제 조건이 있다면 Prisma 7 전환 범위를 별도로 잡아야 한다. 이번 자료만으로 기말 프로젝트에서 버전 일치를 필수로 요구한다고 판단할 수는 없다.

## 비교 근거

| 항목 | 강의자료 | SoloMap | 판단 |
| --- | --- | --- | --- |
| 서버 구조 | 09강 6·13쪽: app → Router → Controller → Store | src/app.ts, routes/, controllers/, services/ | 대체로 일치. Service가 데이터 접근을 담당하지만 일부 장소 Controller는 직접 DB 접근 |
| 세션 | 10강 23·24쪽: express-session을 Router 전에 등록, 세션 ID 쿠키 | app.ts 56~72행: session → Passport → Router | 일치 |
| 인증 | 10강 27·28쪽: 실습용 공통 비밀번호, req.session.user | lib/passport.ts: bcrypt + 사용자 ID 직렬화/DB 조회 복원 | 실제 회원 시스템에 맞춘 확장 |
| 쿠키 파서 | 10강 24쪽: express-session은 cookie-parser 없이 동작 가능 | cookie-parser 미사용 | 문제 없음 |
| 로그아웃 | 10강 30쪽: 세션 삭제 완료 후 쿠키 삭제 및 응답 | auth.controller.ts: req.logout → session.destroy → clearCookie → 204 | 일치 |
| DB 사용 범위 | 11강 10쪽: Supabase Auth/Data API가 아닌 PostgreSQL 사용 | 서버 Prisma로 User/Review/CheckIn 등 접근 | 일치. Supabase Auth로 바꿀 필요 없음 |
| ORM 버전 | 11강 16·17·21·23쪽: Prisma 7.10, PrismaPg, prisma.config.ts, prisma-client | 6.19.3, new PrismaClient(), schema의 url/directUrl, prisma-client-js | 버전 차이. 7 설정 일부만 복사하면 안 됨 |
| 연결 | 11강 14쪽: Session pooler 5432 하나를 서버/마이그레이션에 사용 | 실행 6543 Transaction pooler + pgbouncer=true, CLI 5432 Session pooler | Vercel 서버리스에 맞춘 구성. 강의도 Transaction 사용 시 DIRECT_URL 분리 필요 설명 |
| 데이터 모델 | 11강 24~28쪽: 모델·키·마이그레이션 | User/EmailVerification/Place/Review/CheckIn/Session 모델, SQL 이력 | 일치. @@map은 강의에서도 선택 사항 |
| 세션 영속성 | 10강 23쪽, 11강 48쪽: 실습 MemoryStore는 재시작 시 삭제 | connect-pg-simple + Session 테이블 | 운영에 맞춘 확장. 재시작 후 로그인이 유지되어도 정상 |

## 수정 권장 사항

### 1. DB 오류 원문을 클라이언트에 보내지 않기 — 우선

- 근거: src/middlewares/error.middleware.ts:19, 28.
- 현재 err.message를 그대로 응답한다. Prisma 오류에는 내부 질의·테이블 정보가 들어갈 수 있다.
- 11강 45쪽은 Prisma 오류를 분류하고 일반 메시지와 오류 코드만 응답하며 상세 내용은 서버 로그에 남긴다.
- HttpError의 의도한 4xx 메시지는 유지하고, 예상하지 못한 DB/서버 오류는 안전한 응답으로 분리하는 것이 좋다.

### 2. 리뷰 조회 장애를 빈 목록으로 숨기지 않기 — 우선

- 근거: src/services/review.service.ts:94~125.
- DB 연결 실패·질의 오류를 모두 잡고 []를 반환한다. 저장된 리뷰가 있어도 사용자에게 리뷰가 없는 것처럼 보일 수 있다.
- 11강 42쪽은 특정 오류만 변환하고 연결 실패 등 다른 오류는 throw하도록 설명한다.
- 미설정 로컬 탐색 모드의 폴백과 설정된 DB의 실제 장애를 구분하고, 후자는 오류 응답/재시도 UI로 전달하는 편이 맞다.
- 장소 검색의 DB 평가 병합도 place.controller.ts:115~127에서 실패를 숨긴다. 탐색 폴백을 유지하더라도 학우 평가를 가져오지 못했다는 상태를 구분할 필요가 있다.

### 3. 동시 요청에서 Prisma 제약 오류를 HTTP 상태로 변환하기

- 근거: review.service.ts:155~174, 222 이후 수정 및 294 이후 삭제; level.service.ts:101~123.
- 중복 조회 뒤 create하는 사이에 다른 요청이 먼저 저장하면 DB의 unique 제약은 중복 데이터를 막지만, 뒤 요청은 P2002가 되어 현재 일반 500으로 응답할 수 있다. 기대 응답은 중복 409다.
- 리뷰 존재 조회 뒤 update/delete하기 전에 다른 요청이 삭제하면 P2025가 발생할 수 있다. 11강 42쪽에서 설명한 조회-변경 사이 경쟁 조건이다. 기대 응답은 대상 없음 404다.
- DB 제약은 유지하면서 각 작업의 P2002/P2025를 맥락에 맞게 변환해야 한다. 이번 검토에서는 운영 DB에 동시 쓰기를 실행하지 않았으며, 코드 경로를 근거로 한 판단이다.

### 4. 환경변수 검증 범위 명확히 하기

- 근거: src/app.ts:58, src/lib/env.ts:7.
- 운영/프리뷰는 필수값과 세션 키를 검사하므로 운영에서 기본 키를 허용하는 상태는 아니다.
- 다만 개발 모드는 검증을 건너뛰고 하드코딩된 세션 키·MemoryStore로 진행한다. 10강 10쪽의 필수 SESSION_SECRET 기본값 금지와는 다르다.
- 로컬 탐색 폴백이 필요하면 명시적인 데모 모드로 한정하고, 회원/DB 기능을 쓰는 개발 모드는 시작 시 필수 설정을 검사하는 편이 강의 취지에 맞다.

### 5. 서버 구조를 강의에 더 가깝게 정리하기 — 낮은 우선순위

- 장소 Controller의 Prisma/정적 데이터/외부 API 통합을 place.service.ts로 옮기면 Controller가 입력·응답에 집중할 수 있다. 현재 routes/와 controllers/ 분리는 되어 있다.
- app.ts:101의 errorHandler 앞에 JSON 404 핸들러를 두면 09강 10쪽과 맞는다. 현재 미등록 경로는 Express 기본 404로 처리되어 JSON API 오류 형식이 일정하지 않다.
- RequestHandler 제네릭 대신 Request/Response/NextFunction과 일부 any를 쓰는 것은 실행 오류는 아니지만 강의보다 타입 검사가 느슨하다.

## 실행 확인 결과

- npm run typecheck: 통과.
- npx prisma validate: 스키마 유효.
- npx prisma migrate status: 마이그레이션 1개, Database schema is up to date.
- 현재 Prisma Client로 Supabase 각 앱 테이블 count 조회 성공. 개인정보·접속 비밀값은 출력하지 않았다.
- 실행 연결은 Transaction pooler 6543, pgbouncer=true, connection_limit=3. CLI 연결은 Session pooler 5432. TLS 인증서 검증 설정 확인.
- package.json의 prisma.seed 설정에 Prisma 7 제거 예정 경고가 표시된다. 현재 6.19.3 검사 실패는 아니다.
- 이번 검토에서 회원가입·메일 발송·리뷰/체크인 생성 및 배포 환경 재검증은 실행하지 않았다. 읽기 연결 성공을 전체 기능 재검증으로 해석하면 안 된다.

## 참고 자료

- 09_Express_서버구조화.pdf: 6, 10, 13쪽.
- 10_Express_상태관리.pdf: 10, 23~30쪽.
- 11_Prisma_Supabase_연동.pdf: 10, 14, 16~23, 27~29, 38, 42, 45, 48쪽.
- [Prisma 공식 7 전환 문서](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7): 드라이버 어댑터 및 설정 이동 확인.
