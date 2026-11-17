# Prisma 디렉토리
`schema.prisma`에 User, EmailVerification, Place, Review, CheckIn, Session 모델이 구현되어 있습니다. 강의와 같은 Prisma 7.10 계열(7.10.1), `PrismaPg` 어댑터, `src/generated/prisma` Client를 사용합니다. CLI 설정은 루트 `prisma.config.ts`에 있으며 실제 DB 연결은 `.env`의 `DATABASE_URL`과 `DIRECT_URL`로 설정합니다.

```bash
npx prisma generate
# 비어 있는 새 SoloMap DB에 준비된 초기 마이그레이션 적용
npx prisma migrate deploy
npm run db:seed
```

`migrations/20261106000000_init`의 초기 SQL은 2026-11-09에 SoloMap 전용 DB에 적용했습니다. 식당 125곳도 시드했습니다. 6개 public 테이블은 RLS를 켜고 Data API 정책을 만들지 않으므로 서버 연결은 테이블 소유자 또는 BYPASSRLS 역할을 사용해야 합니다. 기존 데이터가 있는 다른 DB에는 초기 적용을 반복하지 않습니다. 시드는 식당 ID 기준 upsert이며, [실제 연결 기록](../docs/SUPABASE_CONNECTION.md)과 [README](../README.md)를 참고하세요.
