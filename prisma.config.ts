import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  // CLI는 Session pooler 사용. generate는 접속 없이 실행 가능하다.
  // CLI schema engine은 pg와 달리 sslcert/sslaccept=strict를 사용한다.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres' },
});
