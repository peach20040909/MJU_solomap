/** 전용 원격 DB에서 실제 HTTP·Prisma·세션 저장을 검증한다. 생성한 데이터만 정리한다. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import prisma from '../src/lib/prisma.js';

if (process.env.SOLOMAP_REMOTE_TEST !== '1') throw Error('SOLOMAP_REMOTE_TEST=1 명시 필요');
assert.equal(new URL(process.env.DATABASE_URL!).username, 'solomap_server.ldjejqvtkjvbpxbgmocz', 'SoloMap 전용 DB만 테스트');
const db = prisma;
let worker: ChildProcess | undefined;
let base = '';
let cookie = '';
let code = '';
let userId: string | undefined;
let placeId: string | undefined;
const password = randomBytes(24).toString('hex');
const suffix = randomBytes(5).toString('hex');
const email = `solomap-test-${suffix}@mju.ac.kr`;

async function start() {
  code = '';
  worker = fork(new URL('./test_supabase_worker.ts', import.meta.url), [], {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, NODE_ENV: 'test', VERCEL_ENV: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '' },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('테스트 서버 시작 시간 초과')), 20000);
    worker!.on('message', (message: any) => {
      if (message.code) code = message.code;
      if (message.port) { base = `http://127.0.0.1:${message.port}`; clearTimeout(timer); resolve(); }
    });
    worker!.once('exit', () => { clearTimeout(timer); reject(Error('테스트 서버 종료')); });
  });
}
async function stop() {
  if (!worker || worker.exitCode !== null || worker.signalCode) return;
  const exited = once(worker, 'exit'); worker.kill(); await exited;
}
async function request(path: string, expected: number, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
  });
  const newCookie = response.headers.get('set-cookie');
  if (newCookie) cookie = newCookie.split(';')[0];
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${data?.message || ''}`);
  console.log(`PASS ${expected} ${method} ${path.replace(/c[a-z0-9]{20,}/g, '[id]')}`);
  return data;
}

try {
  // 기존 식당의 평균·리뷰 수를 바꾸지 않는 이 실행 전용 장소.
  const place = await db.place.create({ data: { id: `solomap-test-${suffix}`, name: '자동 검증 전용 식당', category: '음식점 > 한식', roadAddress: '자동 검증용', lat: 37.5802, lng: 126.9234, area: '명지대', baseSoloLevel: 2 } });
  placeId = place.id;
  await start();
  const config = await request('/api/config', 200); assert.equal(config.accountConfigured, true);
  const signup = await request('/api/auth/signup', 201, 'POST', { email, password, nickname: `검증${suffix}` });
  userId = signup.user.id;
  const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.notEqual(stored.passwordHash, password); assert.equal(stored.isVerified, false);
  assert.match(code, /^\d{6}$/);
  await request('/api/auth/login', 401, 'POST', { email, password: 'wrong-password' });
  await request('/api/auth/login', 200, 'POST', { email, password });
  const reviewBody = { placeId, soloLevel: 2, content: '원격 저장 자동 검증용 리뷰입니다.' };
  await request('/api/reviews', 403, 'POST', reviewBody);
  await request('/api/auth/verify', 200, 'POST', { code });
  const concurrent = async (path: string, body?: unknown) => {
    const results = await Promise.all([1, 2].map(async () => {
      const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
      return { status: response.status, data: await response.json() };
    }));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    console.log(`PASS 동시 POST ${path}: 201 + 409`);
    return results;
  };
  const reviewResults = await concurrent('/api/reviews', reviewBody);
  const review = reviewResults.find(r => r.status === 201)!.data.review;
  assert.equal(reviewResults.find(r => r.status === 409)!.data.reviewId, review.id);
  await request('/api/reviews', 409, 'POST', reviewBody);
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: review.id } })).content, reviewBody.content);
  await request(`/api/reviews/${review.id}`, 200, 'PATCH', { soloLevel: 3, content: '수정한 리뷰도 실제 저장됩니다.' });
  await concurrent(`/api/places/${placeId}/checkins`);
  await request(`/api/places/${placeId}/checkins`, 409, 'POST');
  assert.equal(await db.checkIn.count({ where: { userId } }), 1);
  assert.ok(await db.session.count({ where: { sess: { path: ['passport', 'user'], equals: userId } } }));
  await stop(); await start();
  const me = await request('/api/auth/me', 200);
  assert.equal(me.user.id, userId); assert.equal(me.user.reviewCount, 1); assert.equal(me.user.visitCount, 1);
  await request('/api/users/me/level', 200);
  await request('/api/users/me/checkins', 200);
  await request('/api/users/me/recommendations', 200);
  await request(`/api/reviews/${review.id}`, 204, 'DELETE');
  assert.equal(await db.review.count({ where: { userId } }), 0);
  const loggedInCookie = cookie;
  await request('/api/auth/logout', 204, 'POST');
  assert.equal(await db.session.count({ where: { sess: { path: ['passport', 'user'], equals: userId } } }), 0);
  cookie = loggedInCookie; // 삭제 쿠키가 아닌 기존 로그인 쿠키의 재사용도 차단되는지 확인한다.
  await request('/api/auth/me', 401);
  console.log('PASS 실제 원격 DB 가입·인증·리뷰 CRUD·체크인·프로세스 재시작 후 세션/기록 유지');
} finally {
  await stop();
  // 실패한 경우에도 이 실행의 임의 이메일에 해당하는 데이터만 정리한다.
  const testUser = await db.user.findUnique({ where: { email } });
  if (testUser) {
    await db.session.deleteMany({ where: { sess: { path: ['passport', 'user'], equals: testUser.id } } });
    await db.user.delete({ where: { id: testUser.id } });
  }
  if (placeId) await db.place.delete({ where: { id: placeId } });
  await db.$disconnect();
}
