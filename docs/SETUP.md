# 별도 SoloMap Supabase 프로젝트 연결

2026-11-09에 서울 리전 Free 플랜의 **SoloMap** 전용 프로젝트(`ldjejqvtkjvbpxbgmocz`)를 생성하고 초기 마이그레이션·식당 125곳 시드를 완료했습니다. 로컬 `.env`의 DB URL·세션 키도 설정했습니다. 기존 `mju-ai-hackathon` 프로젝트는 변경하지 않았습니다. [프로젝트 대시보드](https://supabase.com/dashboard/project/ldjejqvtkjvbpxbgmocz).

실제 DB 통합 검증과 Gmail 설정은 [연결 기록](SUPABASE_CONNECTION.md)을 참고합니다. 아래는 새 환경에서 연결할 때의 절차입니다.

1. Supabase에서 SoloMap 전용 프로젝트를 생성합니다. DB 비밀번호는 채팅에 보내지 않고 로컬 `.env`와 배포 환경변수에 직접 설정합니다.
2. 해당 프로젝트의 Connect에서 접속 문자열을 가져옵니다. `DATABASE_URL`은 트랜잭션 풀러 6543(Prisma용 `pgbouncer=true` 포함), `DIRECT_URL`은 마이그레이션용 direct 또는 세션 풀러 5432입니다. 프로젝트와 서버 역할이 맞는지 확인합니다.
3. `.env`에 `SESSION_SECRET`을 32자 이상의 임의 값으로 설정합니다. SMTP를 사용할 때는 `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`을 설정합니다. 로컬에서 SMTP를 전혀 설정하지 않으면 콘솔 코드를 사용할 수 있습니다. 운영/Preview는 모든 런타임 필수 설정이 있어야 시작합니다.
4. **비어 있는 새 SoloMap DB**임을 확인한 후 프로젝트 폴더에서 실행합니다. 기존 테이블·이력이 있는 DB에는 초기 마이그레이션을 무작정 적용하지 않습니다.

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

5. `requests.http`의 A→R→C→B→Z 순서로 실제 가입·메일·리뷰·체크인·권한·로그아웃을 확인합니다. 테스트 데이터가 남으므로 전용 DB/학교 테스트 계정을 사용합니다. 코드와 쿠키를 커밋하지 않습니다.
6. Vercel Preview에 필요한 환경변수를 설정하고 [README 체크리스트](../README.md#vercel-배포-체크리스트)를 확인합니다. SMTP 발송 실패는 503으로 응답하고 신규 가입/재발송 기록을 정리합니다.

초기 SQL은 6개 테이블에 RLS를 켜고 Data API 정책을 만들지 않습니다. 브라우저는 DB를 직접 호출하지 않고 Express API를 호출합니다. Prisma·세션의 서버 연결은 테이블 소유자 또는 BYPASSRLS 역할이어야 합니다. 사용자 권한은 기존 Passport/미들웨어가 검사합니다.
