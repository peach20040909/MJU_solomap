# SoloMap 실제 DB 연결 기록

확인일: 2026-11-09 (Asia/Seoul).

## 연결

- 프로젝트: SoloMap / `ldjejqvtkjvbpxbgmocz` / 서울 / Free 월 $0.
- Express → Prisma → Supabase PostgreSQL. 기존 Passport 로그인을 사용한다. Supabase Auth의 사용자 목록이 아닌 `public.User`에 계정이 저장된다.
- 서버 역할 `solomap_server`가 앱 테이블을 소유한다. 슈퍼유저/BYPASSRLS 권한은 부여하지 않았다. 역할은 마이그레이션을 위한 DB·public 스키마 CREATE 권한을 가진다.
- `DATABASE_URL`: 서울 Supavisor 트랜잭션 모드 6543, `pgbouncer=true`, 연결 제한 3.
- `DIRECT_URL`: IPv4 세션 모드 5432, 마이그레이션용. 이 컴퓨터에서 direct IPv6 호스트는 해석되지 않아 세션 풀러를 사용했다.
- 비밀번호·임의 세션 키는 `.env`에만 저장했다. 최초 프로젝트 생성 시 서버 역할을 따로 만들었으므로 기본 postgres 비밀번호를 앱에 사용할 필요가 없다.
- `certs/supabase-ca.crt`는 [Supabase 공식 CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)이며 공개 인증서다. 인증서 검증을 끄지 않는다. [공식 SSL 안내](https://supabase.com/docs/guides/platform/ssl-enforcement).
- Prisma URL의 `sslcert`는 신뢰할 서버 CA를 뜻한다. 세션 드라이버는 이를 `sslrootcert`로 변환하고 `verify-full`로 호스트와 인증서를 검증한다. 현재 로컬 URL의 인증서 경로는 절대 경로이므로 다른 컴퓨터·배포 환경에서는 해당 환경 경로로 바꿔야 한다.
- 6개 앱 테이블에 RLS를 켰고 Data API 정책은 만들지 않았다. 의도적으로 브라우저 직접 DB 접근을 허용하지 않으며 Express/Passport가 사용자 권한을 검사한다. Supabase 보안 Advisor는 이에 대해 INFO 6개를 보고했고 경고/오류는 없었다.

## 실제 검증

```powershell
$env:SOLOMAP_REMOTE_TEST='1'
npx tsx scripts/test_supabase.ts
```

전용 DB ID를 확인한 뒤 임의 학교 이메일 계정을 만들고 실제 Express HTTP와 원격 DB를 사용한다. 메일은 테스트 자식 프로세스에서 SMTP를 비우고 기존 로컬 콘솔 전송 방식으로 코드만 IPC로 전달한다. API·Prisma·세션 DB를 대체하지 않으며 실제 Gmail 수신 테스트는 아니다.

통과: 가입 201, bcrypt 해시 저장, 틀린 비밀번호 401, 로그인 200, 미인증 리뷰 403, 코드 인증 200, 리뷰 생성 201/중복 409/수정 200/삭제 204, 체크인 201/당일 중복 409. 별도 서버 프로세스로 재시작한 뒤 기존 쿠키로 내 정보·방문 횟수·리뷰 수·레벨·정복 식당·추천 조회 200. 로그아웃 204 후 같은 세션 조회 401.

테스트가 생성한 사용자·리뷰·체크인·세션은 정리했으며 식당 평균을 다시 계산했다. 종료 후 식당 125, 사용자/리뷰/체크인 0건을 원격 SQL로 확인했다. 최초 마이그레이션은 DB CREATE 권한 누락으로 실패해 테이블 미생성을 확인한 후 권한을 부여하고 rolled-back 표시 후 재실행했다. 최종 마이그레이션은 적용 완료 상태다.

## Gmail 실제 인증 메일

1. 사용할 Google 계정의 2단계 인증을 켠다.
2. [앱 비밀번호](https://myaccount.google.com/apppasswords)에서 SoloMap용 비밀번호를 발급한다. 일반 Google 로그인 비밀번호는 사용하지 않는다.
3. 로컬 `.env`에 아래를 설정한다. 비밀번호를 채팅·Git·스크린샷에 남기지 않는다.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=사용할_Gmail_주소
SMTP_PASS=발급받은_16자리_앱_비밀번호
MAIL_FROM="SoloMap <사용할_Gmail_주소>"
```

4. 서버를 다시 실행한 뒤 소유한 `@mju.ac.kr` 주소로 가입하고 수신한 코드를 입력한다. 학교 메일의 스팸함도 확인한다.

2026-11-09에 사용자 요청으로 로컬 `.env`에 Gmail SMTP 설정을 저장하고 Nodemailer `verify()`로 TLS 연결 및 Gmail 계정 인증 성공을 확인했다. 비밀번호·계정 주소는 이 문서에 기록하지 않는다. 실제 학교 메일함 수신은 아직 확인하지 않았으며 회원가입으로 확인해야 한다.

SMTP 미설정 로컬 환경에서는 서버 터미널의 `[DEV EMAIL]` 코드를 사용한다. 현재 로컬 환경은 Gmail SMTP를 사용한다. 운영/Preview는 SMTP 미설정을 허용하지 않는다. Vercel 환경변수 설정이나 배포는 이번 연결에 포함해 실행하지 않았다.
