# Prisma 7 전환 및 오류 처리 수정

2026-11-10. 로컬 코드 수정 및 실제 SoloMap Supabase로 검증. 이번 작업에서는 배포하지 않았다.

> 이후 사용자 요청으로 운영 배포 및 운영 주소 검증을 완료했다. [배포 기록](DEPLOYMENT_2026-11-10.md)을 참고한다.

## 변경

- 강의의 Prisma 7.10 계열로 전환: CLI, Client, PostgreSQL 어댑터 모두 7.10.1로 고정했다.
- `prisma.config.ts`: CLI 연결, 스키마/마이그레이션 경로, 시드 설정. 기존 Session pooler `DIRECT_URL`을 사용한다.
- `schema.prisma`: `prisma-client` 생성기를 사용하고 `src/generated/prisma`로 생성한다. 테이블/필드/제약은 그대로 유지한다.
- `src/lib/prisma.ts`: `PrismaPg` 어댑터로 실행용 Transaction pooler 연결. 풀 최대 3개, 연결 제한 시간 5초.
- `src/lib/database.ts`: 실행 드라이버와 세션 저장소에 대해 기존 Prisma 6 접속 URL을 pg 형식으로 변환한다. CA 경로는 `sslrootcert`로 전달하고 `verify-full`로 인증서·호스트 검증을 유지한다. CLI schema engine은 다른 파서를 쓰므로 원래의 `sslcert`·`sslaccept=strict` 설정을 그대로 전달한다. 비밀값을 문서나 테스트 로그에 출력하지 않는다.
- 예상하지 못한 서버/Prisma 오류 원문은 HTTP 응답에서 숨기고 서버 로그에만 기록한다. 의도한 입력/권한/메일 장애 응답은 유지한다.
- 설정된 DB의 리뷰 조회 오류는 상위 오류 처리기로 전달한다. 기존 프론트의 실패 안내가 표시되며 정상적인 빈 목록과 구분된다. DB 미설정 로컬 탐색 모드의 빈 목록 폴백은 유지한다.
- Prisma P2002는 409, P2025는 404로 응답한다. 리뷰 동시 생성은 기존 리뷰 ID도 반환해 기존 수정 화면 전환을 유지한다.

## 검증

1. 먼저 기존 구현에서 오류 원문 노출, 리뷰 조회 장애의 200 빈 목록, 동시 저장/삭제 충돌의 500을 HTTP 회귀 테스트로 재현했다.
2. 수정 후 `npm test`: 22개 테스트 통과. 오류 주입은 Prisma 경계에서만 수행하고 실제 Router/Controller/Service/오류 미들웨어를 실행했다. SMTP는 로컬 테스트 서버를 사용한다.
3. `SOLOMAP_REMOTE_TEST=1 npx tsx scripts/test_supabase.ts`: 임의 테스트 계정 및 임의 테스트 식당을 생성해 실제 DB/HTTP 검증. 가입, 비밀번호 해시 저장, 잘못된 비밀번호 거부, 로그인, 미인증 권한 거부, 인증 코드 검증, 리뷰 생성/수정/삭제, 체크인, 레벨/기록/추천, 로그아웃을 확인했다.
4. 같은 리뷰·체크인에 동시에 두 요청을 보냈을 때 각각 201 한 건 + 409 한 건이며 DB 중복 저장이 없음을 확인했다. 리뷰 충돌 응답의 reviewId도 저장된 리뷰와 일치했다.
5. 프로세스 종료/재시작 후 세션과 리뷰·방문 기록이 유지되었다. 테스트 계정·장소·세션·리뷰·체크인은 정리한다. 기존 식당의 리뷰 평균을 변경하지 않도록 테스트 전용 Place를 사용한다.
6. `npm run test:ui`: 브라우저 회원 기능, 리뷰 CRUD/권한/중복 수정 전환, 체크인, 개인 지도, 모바일·DS 검증 통과. 리뷰 조회 500에서 오류 안내를 표시하고 다시 열어 정상 데이터를 가져오는 복구도 확인했다.
7. Prisma generate/validate/migrate status 및 타입 검사/빌드 통과. 기존 마이그레이션 1개가 적용된 상태이며 DB 구조를 변경하거나 reset하지 않았다.
8. 코드 리뷰에서 CLI에 pg 옵션을 적용하면 인증서 검증이 약해지는 것을 발견했다. 잘못된 CA로 CLI가 성공하는 실패 테스트를 확인한 뒤 CLI URL 변환을 제거했다. 이후 올바른 CA로 CLI 연결 성공, 잘못된 CA는 CLI·실행용 PrismaPg 양쪽에서 거부함을 읽기 전용 테스트로 확인했다. 리뷰 재확인 결과 중요 지적 사항이 남아 있지 않다.
9. `npm run test:api`: 실제 Express 공개/인증 차단 API 16/16 통과. 컴파일된 `dist/app.js` 실행, 200 헬스·401 비로그인 응답, Prisma 7 원격 조회도 통과했다. 테스트 계정/장소 잔여 수가 0임을 확인했다.

원격 통합 테스트는 실제 메일을 보내지 않고 테스트 프로세스의 개발 인증 코드를 사용한다. 실제 Gmail→학교 메일 수신을 이번 테스트에서 재검증했다는 뜻은 아니다.

## 실행

```powershell
npm install
npm run typecheck
npm run build
npm test
npm run test:api
npm run test:ui
```

실제 DB 테스트는 SoloMap 전용 프로젝트인지 가드를 확인한 뒤 별도로 실행한다. 시드나 마이그레이션 reset은 테스트에 필요하지 않다.

```powershell
$env:SOLOMAP_REMOTE_TEST='1'
npx tsx scripts/test_supabase.ts
```

설치 중 npm audit 경고가 남아 있다. 이 작업은 전체 의존성 보안 정비가 아니며, 강제 메이저 업데이트는 수행하지 않았다.
