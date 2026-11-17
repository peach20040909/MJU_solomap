/** 실제 Express 앱을 임시 포트로 실행한다. DB 변경 없이 공개 요청과 입력/인증 차단을 검증한다. */
import assert from 'node:assert/strict';

process.env.VERCEL = '1'; // 테스트가 listen을 직접 관리한다. 배포는 하지 않는다.
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/lib/prisma.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('테스트 포트 생성 실패');
const baseUrl = `http://127.0.0.1:${address.port}`;
const cases = [
  { name: 'health', path: '/api/health', expected: 200 },
  { name: 'config', path: '/api/config', expected: 200 },
  { name: 'me without cookie', path: '/api/auth/me', expected: 401 },
  { name: 'resend without cookie', path: '/api/auth/verify/send', method: 'POST', expected: 401 },
  { name: 'verify without cookie', path: '/api/auth/verify', method: 'POST', body: { code: '123456' }, expected: 401 },
  { name: 'review without cookie', path: '/api/reviews', method: 'POST', body: { placeId: '16418234', soloLevel: 2, content: '테스트' }, expected: 401 },
  { name: 'checkin without cookie', path: '/api/places/16418234/checkins', method: 'POST', expected: 401 },
  ...['reviews', 'level', 'checkins', 'recommendations'].map(name => ({ name: `${name} without cookie`, path: `/api/users/me/${name}`, expected: 401 })),
  { name: 'invalid school domain', path: '/api/auth/signup', method: 'POST', body: { email: 'solo@example.com', password: 'password1234!', nickname: '검증학우' }, expected: 400 },
  { name: 'short password', path: '/api/auth/signup', method: 'POST', body: { email: 'solo@mju.ac.kr', password: '123', nickname: '검증학우' }, expected: 400 },
  { name: 'short nickname', path: '/api/auth/signup', method: 'POST', body: { email: 'solo@mju.ac.kr', password: 'password1234!', nickname: '가' }, expected: 400 },
  { name: 'missing signup fields', path: '/api/auth/signup', method: 'POST', body: {}, expected: 400 },
  { name: 'missing place', path: '/api/places/solomap-missing-place', expected: 404 },
];
try {
  for (const item of cases) {
    const test = item as { name: string; path: string; expected: number; method?: string; body?: unknown };
    const response = await fetch(baseUrl + test.path, {
      method: test.method || 'GET', signal: AbortSignal.timeout(15000),
      ...(test.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(test.body) } : {}),
    });
    assert.equal(response.status, test.expected, test.name);
    if (test.path === '/api/config') {
      const config = await response.json() as { accountConfigured: unknown };
      assert.equal(typeof config.accountConfigured, 'boolean');
      assert.deepEqual(Object.keys(config).sort(), ['accountConfigured', 'naverClientId']);
    }
    if (test.expected >= 400) {
      const data = await response.json() as { message: unknown };
      assert.equal(typeof data.message, 'string', `${test.name}: { message } JSON`);
      assert.deepEqual(Object.keys(data), ['message']);
    }
    console.log(`PASS ${test.expected} ${test.name}`);
  }
  console.log(`PASS ${cases.length}/${cases.length} real Express API cases (no DB writes)`);
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
