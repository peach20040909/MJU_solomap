/** 실제 운영 URL 검증. 임시 계정/장소만 만들고 정리하며 실제 인증 메일은 보내지 않는다. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import puppeteer from 'puppeteer-core';
import db from '../src/lib/prisma.js';

if (process.env.SOLOMAP_PRODUCTION_TEST !== '1') throw Error('SOLOMAP_PRODUCTION_TEST=1 필요');
assert.equal(new URL(process.env.DATABASE_URL!).username, 'solomap_server.ldjejqvtkjvbpxbgmocz');
const base = 'https://mju-solomap.vercel.app';
const suffix = crypto.randomBytes(5).toString('hex');
const email = `solomap-deploy-${suffix}@mju.ac.kr`;
const password = crypto.randomBytes(24).toString('hex');
const code = crypto.randomInt(100000, 1000000).toString();
let cookie = '', userId: string | undefined, placeId: string | undefined;
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
async function request(path: string, expected: number, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${method} ${path} status ${response.status}`);
  console.log(`PASS production ${method} ${path.replace(/c[a-z0-9]{20,}/g, '[id]')} ${expected}`);
  return { data, session };
}
async function concurrent(path: string, body?: unknown) {
  const results = await Promise.all([0, 1].map(async () => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
    return { status: r.status, data: await r.json() };
  }));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  console.log('PASS production concurrent create: 201 + 409');
  return results;
}
try {
  const health = await fetch(base + '/api/health'); assert.equal(health.status, 200);
  assert.equal((await request('/api/config', 200)).data.accountConfigured, true);
  await request('/api/auth/me', 401);
  await request('/api/auth/signup', 400, 'POST', { email: 'not-school@example.com', password, nickname: '배포검증' });
  // 운영 메일을 임의 주소로 발송하지 않고 사용자/인증 코드 저장 상태만 준비한다.
  const user = await db.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10), nickname: `배포${suffix}` } }); userId = user.id;
  await db.emailVerification.create({ data: { userId, codeHash: crypto.createHash('sha256').update(code).digest('hex'), expiresAt: new Date(Date.now() + 600000) } });
  const place = await db.place.create({ data: { id: `solomap-deploy-${suffix}`, name: '배포 검증 전용 식당', category: '음식점 > 한식', roadAddress: '자동 테스트 전용', lat: 37.5802, lng: 126.9234, area: '명지대', baseSoloLevel: 2 } }); placeId = place.id;
  await request('/api/auth/login', 401, 'POST', { email, password: 'wrong-password' });
  const login = await request('/api/auth/login', 200, 'POST', { email, password });
  assert.match(login.session!, /; Secure/i); assert.match(login.session!, /; HttpOnly/i); assert.match(login.session!, /; SameSite=Lax/i);
  const reviewBody = { placeId, soloLevel: 2, content: '자동 배포 검증 리뷰' };
  await request('/api/reviews', 403, 'POST', reviewBody);
  await request('/api/auth/verify', 400, 'POST', { code: 'invalid' });
  await request('/api/auth/verify', 200, 'POST', { code });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).isVerified, true);
  const results = await concurrent('/api/reviews', reviewBody);
  const review = results.find(r => r.status === 201)!.data.review;
  assert.equal(results.find(r => r.status === 409)!.data.reviewId, review.id);
  await request(`/api/reviews/${review.id}`, 200, 'PATCH', { soloLevel: 4, content: '배포 검증 수정 리뷰' });
  assert.equal((await db.review.findUniqueOrThrow({ where: { id: review.id } })).soloLevel, 4);
  assert.equal((await db.place.findUniqueOrThrow({ where: { id: placeId } })).avgSoloLevel, 4);
  await request(`/api/places/${placeId}/reviews`, 200);
  await concurrent(`/api/places/${placeId}/checkins`);
  assert.equal(await db.checkIn.count({ where: { userId } }), 1);
  assert.equal((await request('/api/users/me/level', 200)).data.levelInfo.visitCount, 1);
  await request('/api/users/me/checkins', 200); await request('/api/users/me/recommendations', 200);

  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage(); page.setDefaultTimeout(45000);
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  const apiResponses: { path: string; status: number }[] = [];
  page.on('response', r => { if (r.url().startsWith(base + '/api/')) apiResponses.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  // 설정 확인 전 비활성 버튼을 클릭하면 요청 자체가 발생하지 않는다.
  await page.waitForFunction(() => (window as any).eval('accountConfigured') === true);
  await page.waitForSelector('#btn-login'); await page.click('#btn-login');
  await page.type('#auth-email', email); await page.type('#auth-password', password);
  await page.waitForSelector('#auth-submit:not([disabled])');
  await page.click('#auth-submit');
  try { await page.waitForSelector('#auth-modal.hidden'); } catch (error) {
    console.log('Browser login diagnostic', JSON.stringify({ apiResponses, pageErrors, ui: await page.evaluate(() => ({ toast: document.querySelector('#toast-text')?.textContent, formValid: (document.querySelector('#auth-form') as HTMLFormElement)?.checkValidity(), submitDisabled: (document.querySelector('#auth-submit') as HTMLButtonElement)?.disabled })) }));
    throw error;
  }
  await page.waitForSelector('#btn-mypage');
  await page.click('#btn-mypage'); await page.waitForSelector('#mypage-content progress');
  assert(await page.$eval('#mypage-content', node => node.textContent!.includes('배포 검증 수정 리뷰')));
  await page.click('#mypage-close');
  await page.evaluate(id => (window as any).openReviewsList(id), placeId);
  await page.waitForSelector(`[data-review-id="${review.id}"]`);
  await page.click('#reviews-list-close');
  await page.setViewport({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  console.log('PASS production browser login/profile/reviews + mobile + no JS errors');
  await browser.close(); browser = undefined;

  await request(`/api/reviews/${review.id}`, 204, 'DELETE');
  await request(`/api/reviews/${review.id}`, 404, 'DELETE');
  const oldCookie = cookie; await request('/api/auth/logout', 204, 'POST'); cookie = oldCookie;
  await request('/api/auth/me', 401);
} finally {
  await browser?.close();
  if (userId) {
    await db.session.deleteMany({ where: { sess: { path: ['passport', 'user'], equals: userId } } });
    await db.user.delete({ where: { id: userId } });
  }
  if (placeId) await db.place.delete({ where: { id: placeId } });
  await db.$disconnect();
  console.log('Production fixture cleanup finished');
}
