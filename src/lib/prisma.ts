/**
 * [이 파일이 하는 일]
 * Prisma Client 인스턴스를 단일(싱글톤) 객체로 생성하여 앱 전체에서 재사용합니다.
 * Express 개발 모드의 핫 리로드(tsx watch) 및 Vercel 서버리스 환경에서
 * 데이터베이스 커넥션 풀이 불필요하게 고갈되는 것을 방지합니다.
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConnectionString } from './database.js';

// 전역(globalThis) 공간에 prisma 인스턴스 타입 선언
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 이미 생성된 인스턴스가 있으면 재사용하고, 없으면 새로 생성
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: pgConnectionString(process.env.DATABASE_URL || 'postgresql://localhost:5432/postgres'),
      max: 3,
      connectionTimeoutMillis: 5000,
    }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// 개발 환경에서는 전역 객체에 저장하여 핫 리로드 시에도 재사용
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

