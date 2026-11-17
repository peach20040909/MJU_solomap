/** 실제 Router/Controller/Service에 DB 경계 오류를 주입한다. 원격 DB에는 접속하지 않는다. */
import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { Prisma } from '../src/generated/prisma/client.js';
import prisma from '../src/lib/prisma.js';
import { reviewRouter } from '../src/routes/review.routes.js';
import { createCheckIn } from '../src/controllers/checkin.controller.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { HttpError } from '../src/services/auth.service.js';

const dbError = (code: string) => new Prisma.PrismaClientKnownRequestError('PRIVATE_DATABASE_QUERY', { code, clientVersion: 'fixture' });
test('DB 오류 처리 HTTP 회귀', async t => {
  process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
  const undo: (() => void)[] = [];
  const patch = (obj: any, key: string, value: any) => {
    const original = obj[key]; obj[key] = value; undo.push(() => { obj[key] = original; });
  };
  const restore = () => { while (undo.length) undo.pop()!(); };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user', email: 'fixture@mju.ac.kr', nickname: 'fixture', isVerified: true };
    req.isAuthenticated = (() => true) as any; next();
  });
  app.get('/unexpected', () => { throw new Error('PRIVATE_DATABASE_QUERY'); });
  app.get('/validation', () => { throw new HttpError(400, '입력을 확인해주세요.'); });
  app.get('/database', () => { throw dbError('P2021'); });
  app.use('/reviews', reviewRouter);
  app.post('/places/:id/checkins', createCheckIn);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, status: number, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    assert(!JSON.stringify(data).includes('PRIVATE_DATABASE_QUERY'));
    return data;
  };
  const fault = (code: string) => async () => { throw dbError(code); };
  try {
    await t.test('예상 밖 서버 오류 원문을 숨긴다', () => request('/unexpected', 500));
    await t.test('Prisma 오류 원문을 숨긴다', () => request('/database', 500));
    await t.test('기존 입력 오류 메시지는 유지한다', async () => assert.equal((await request('/validation', 400)).message, '입력을 확인해주세요.'));
    await t.test('리뷰 DB 장애는 빈 목록 성공이 아니다', async () => {
      patch(prisma.review, 'findMany', fault('P1001'));
      try { await request('/reviews/place/place', 500); } finally { restore(); }
    });
    await t.test('정상 빈 리뷰 목록은 유지한다', async () => {
      patch(prisma.review, 'findMany', async () => []);
      try { assert.equal((await request('/reviews/place/place', 200)).totalCount, 0); } finally { restore(); }
    });
    await t.test('조회 뒤 중복 리뷰 저장 충돌은 409이고 수정할 ID를 돌려준다', async () => {
      patch(prisma.place, 'findUnique', async () => ({ id: 'place' }));
      let calls = 0;
      patch(prisma.review, 'findUnique', async () => ++calls === 1 ? null : { id: 'winning-review' });
      patch(prisma, '$transaction', fault('P2002'));
      try {
        const body = await request('/reviews', 409, 'POST', { placeId: 'place', soloLevel: 2, content: '리뷰' });
        assert.equal(body.reviewId, 'winning-review');
      } finally { restore(); }
    });
    for (const method of ['PATCH', 'DELETE']) await t.test(`조회 뒤 삭제된 리뷰 ${method}는 404`, async () => {
      patch(prisma.review, 'findUnique', async () => ({ id: 'review', userId: 'user', placeId: 'place' }));
      patch(prisma, '$transaction', fault('P2025'));
      try { await request('/reviews/review', 404, method, method === 'PATCH' ? { content: '수정' } : undefined); } finally { restore(); }
    });
    await t.test('동시 체크인 unique 충돌은 409', async () => {
      patch(prisma.place, 'findUnique', async () => ({ id: 'place', baseSoloLevel: 2, reviewCount: 0 }));
      patch(prisma.checkIn, 'findUnique', async () => null);
      patch(prisma.checkIn, 'create', fault('P2002'));
      try { await request('/places/place/checkins', 409, 'POST'); } finally { restore(); }
    });
    await t.test('기존 타인 리뷰 권한 검사는 403', async () => {
      patch(prisma.review, 'findUnique', async () => ({ id: 'review', userId: 'other' }));
      try { await request('/reviews/review', 403, 'DELETE'); } finally { restore(); }
    });
  } finally {
    restore(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect();
  }
});
