# Prisma 7 및 오류 처리 수정 운영 배포

- 날짜: 2026-11-10
- 프로젝트: mju-solomap / prj_jamlmn71bzib2ux8LG97LYuDacl1
- 운영 주소: https://mju-solomap.vercel.app
- 완료 배포: dpl_4FaFwdx39mgTio6oofYFRA792n7L (READY, production 도메인 연결 확인)
- 배포 고유 주소: https://mju-solomap-5gw7kmriz-a01027010769-8483.vercel.app
- Prisma CLI/Client/PrismaPg: 7.10.1. Node: 24.x.

## 범위

백엔드 Prisma 7 전환 및 오류 처리 세 건을 배포했다. 기존 DB 스키마와 마이그레이션은 변경하지 않았다. 기존 Vercel 환경변수를 그대로 사용했으며 .env 파일을 소스에 포함하지 않았다.

화면은 기존 DS1.2 배포 dpl_B2oZWFNp6qAphEtEdx8KYugiFaAQ의 public 파일을 그대로 사용했다. 변경되어 있던 로컬 index.html/account.js/main.js/map.css/style.css를 포함하지 않았으며 배포 전후 원본 SHA1이 일치함을 확인했다. Figma 목업·미선택 디자인은 배포하지 않았다. 따라서 현재 로컬 public 폴더와 운영 public 폴더는 의도적으로 다르다.

초기 업로드 목록의 schema.prisma 누락으로 실패한 빌드는 스키마를 포함하여 다시 배포했다. Node가 자동으로 최신 메이저로 선택되지 않도록 package.json engines를 24.x로 고정했다. 완료 배포 로그에서 Prisma Client 7.10.1 생성, TypeScript 빌드 성공을 확인했다.

## 실제 운영 주소 검증

`SOLOMAP_PRODUCTION_TEST=1 npx tsx scripts/test_vercel.ts` 최종 실행 성공:

| 검증 | 결과 |
| --- | --- |
| health, config | 200, accountConfigured=true |
| 비로그인 내 정보 | 401 |
| 잘못된 학교 도메인 가입 | 400 |
| 잘못된 비밀번호 / 정상 로그인 | 401 / 200 |
| 세션 쿠키 | Secure, HttpOnly, SameSite=Lax |
| 미인증 리뷰 작성 | 403 |
| 잘못된 형식의 인증 코드 / 준비한 코드 검증 | 400 / 200, DB isVerified=true |
| 동시 리뷰 생성 | 201 하나 + 409 하나, 충돌 reviewId 일치 |
| 리뷰 수정 / 공개 조회 | 200, 실제 DB 내용·평균 난이도 갱신 확인 |
| 동시 체크인 | 201 하나 + 409 하나, DB 기록 한 건 |
| 레벨·방문 기록·추천 | 200 |
| 실제 브라우저 로그인·성장 기록·리뷰 표시 | 통과 |
| 모바일 390px 가로 넘침 / 페이지 JS 오류 | 없음 / 없음 |
| 리뷰 삭제 / 삭제 반복 | 204 / 404 |
| 로그아웃 / 예전 쿠키 재사용 | 204 / 401 |

브라우저 첫 실행에서 초기 config 요청이 끝나기 전 비활성 제출 버튼을 클릭하여 로그인 요청이 발생하지 않는 테스트 문제가 있었다. 네트워크 진단 후 accountConfigured 및 제출 버튼 활성화를 기다리도록 테스트를 수정했고 최종 전체 검증이 통과했다. 운영 UI 코드는 변경하지 않았다.

운영 검증용 사용자·인증 레코드·Place를 직접 준비하고, 실제 운영 API에서 인증·세션·리뷰·체크인을 실행했다. 테스트용 계정·식당·세션·리뷰·체크인은 finally에서 삭제했다. 기존 식당이나 사용자 기록을 수정하지 않았다. 실제 인증 메일 발송·수신과 성공 회원가입의 SMTP 구간은 이번 운영 검증에서 실행하지 않았다.

로컬 단위/오류 주입 테스트와 TLS 거부 테스트 결과는 [이전 수정 검증 기록](PRISMA7_ERROR_HANDLING.md)에 있다. 운영에서 장애를 유발하기 위한 DB 중단이나 인증서 변경은 하지 않았다.
