/** 원격 DB 읽기만 수행. CLI와 pg가 신뢰하지 않는 CA를 실제로 거부하는지 확인한다. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { rootCertificates } from 'node:tls';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConnectionString } from '../src/lib/database.js';

const cert = path.resolve('artifacts/prisma-tls/wrong-ca.crt');
await mkdir(path.dirname(cert), { recursive: true });
await writeFile(cert, rootCertificates[0]);
const url = new URL(process.env.DIRECT_URL!);
url.searchParams.set('sslcert', cert);
url.searchParams.set('sslmode', 'require');
url.searchParams.set('sslaccept', 'strict');
let db: PrismaClient | undefined;
try {
  const valid = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'status'], {
    env: process.env, encoding: 'utf8', timeout: 30000,
  });
  assert(!valid.error);
  assert.equal(valid.status, 0, '올바른 CA 연결이 성공해야 잘못된 CA 거부와 비교할 수 있다');
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'status'], {
    env: { ...process.env, DIRECT_URL: url.toString() }, encoding: 'utf8', timeout: 30000,
  });
  assert(!result.error, 'CLI를 정상 실행해야 인증서 검증 결과를 확인할 수 있다');
  assert.notEqual(result.status, 0, 'CLI가 잘못된 CA로 연결하면 안 됨');
  console.log('PASS Prisma CLI rejects untrusted CA');
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConnectionString(url.toString()), connectionTimeoutMillis: 5000 }) });
  await assert.rejects(db.place.count(), /certificate|self.signed|unable to verify/i);
  console.log('PASS PrismaPg runtime rejects untrusted CA');
} finally {
  await db?.$disconnect();
  await rm(cert, { force: true });
}
