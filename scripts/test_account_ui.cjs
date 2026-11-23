// 독립 HTTP 서버와 API 응답 fixture로 화면의 API 계약/권한/오류 흐름 검증.
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

const place = { id: '123', place_name: '테스트 국밥', category_name: '음식점 > 한식 > 국밥', x: '126.9234', y: '37.5802', distance: '100', displaySolo: { level: 2, label: 'Lv.2 혼밥 성지 (학우평가)', reviewCount: 2 } };
const secondPlace = { ...place, id: '789', place_name: '테스트 버거', category_name: '음식점 > 햄버거', distance: '200', displaySolo: { level: 1, label: 'Lv.1 입문 혼밥', reviewCount: 0 } };
const user = { id: 'me', nickname: '학우', isVerified: false, level: 1 };
const levelInfo = { level: 2, title: 'Lv.2 🍚 혼밥 새내기', exp: 5, nextLevelExp: 15, progressPercent: 0, visitCount: 1, conqueredPlaceCount: 1 };
let loggedIn = false, reviews = [], duplicate = false, force401 = false, force403 = false, accountConfigured = true, reviewReadFails = false;
const calls = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    try {
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const data = await readFile(path.join(__dirname, '../public', filename));
      res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.woff2') ? 'font/woff2' : filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
      return res.end(data);
    } catch { res.statusCode = 404; return res.end(); }
  }
  let body = ''; for await (const chunk of req) body += chunk;
  calls.push({ method: req.method, url: url.pathname, body: body ? JSON.parse(body) : null });
  const send = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(status === 204 ? '' : JSON.stringify(data)); };
  const p = url.pathname;
  if (p === '/api/config') return send({ naverClientId: '', accountConfigured });
  if (p === '/api/places/search') return send({ success: true, places: [place, secondPlace] });
  if (p === '/api/auth/signup') return send({ user }, 201);
  if (p === '/api/auth/login') { loggedIn = true; return send({ user }); }
  if (p === '/api/auth/logout') { loggedIn = false; return send(null, 204); }
  if (p === '/api/auth/me') return loggedIn ? send({ user: { ...user, ...levelInfo } }) : send({ message: '로그인 필요' }, 401);
  if (p === '/api/auth/verify/send') return send({ message: '60초 후 재발송' }, 429);
  if (p === '/api/auth/verify') { user.isVerified = true; return send({ message: '인증 완료' }); }
  if (p === '/api/places/123/reviews') return reviewReadFails ? send({ message: '리뷰를 불러오지 못했습니다.' }, 500) : send({ reviews });
  if (p === '/api/places/123') return send({ place: { id: '123', name: place.place_name, lat: 37.5802, lng: 126.9234 }, displaySolo: reviews.some(r => r.id === 'mine') ? { level: 4, label: 'Lv.4 다인석 식당 (학우평가)', reviewCount: reviews.length } : place.displaySolo });
  if (p === '/api/places/123/checkins') return send({ levelInfo }, 201);
  if (p === '/api/users/me/level') return send({ levelInfo });
  if (p === '/api/users/me/reviews') return send({ reviews: reviews.filter(r => r.userId === 'me').map(r => ({ ...r, place: { id: '123', name: place.place_name } })) });
  if (p === '/api/users/me/checkins') return send({ conqueredPlaces: [{ placeId: '123', name: place.place_name, lat: 37.5802, lng: 126.9234, visitCount: 1, lastVisitDate: '2026-11-05', displaySolo: place.displaySolo }] });
  if (p === '/api/users/me/recommendations') return send({ recommendations: [{ id: '456', name: '추천 식당', lat: 37.581, lng: 126.924, displaySolo: place.displaySolo }] });
  if (p.startsWith('/api/reviews')) {
    if (force403) return send({ message: '학교 메일 인증 후 이용 가능' }, 403);
    if (force401) { loggedIn = false; return send({ message: '세션 만료' }, 401); }
    if (duplicate && req.method === 'POST') return send({ message: '이미 리뷰 작성', reviewId: 'mine' }, 409);
    if (req.method === 'DELETE') { reviews = reviews.filter(r => r.id !== 'mine'); return send(null, 204); }
    const data = JSON.parse(body);
    const review = { id: 'mine', userId: 'me', placeId: '123', ...data, user: { ...user }, createdAt: new Date().toISOString() };
    reviews = [review, ...reviews.filter(r => r.id !== 'mine')];
    return send({ review }, req.method === 'POST' ? 201 : 200);
  }
  return send({ message: '없음' }, 404);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith('http://127.0.0.1:') ? req.continue() : req.abort());
    await page.evaluateOnNewDocument(() => localStorage.setItem('solo_map_reviews_v1', JSON.stringify({ '123': [{ text: '옛 로컬 리뷰', level: 5 }] })));
    // 외부 Naver SDK 경계만 대체한다. 마커/팝업 HTML과 클릭 흐름은 실제 main.js가 만든다.
    await page.evaluateOnNewDocument(() => {
      class Map { constructor(id) { this.el = document.getElementById(id); } autoResize() {} morph() {} getZoom() { return 16; } }
      class Marker {
        constructor(options) { this.options = options; this.el = document.createElement('div'); this.el.innerHTML = options.icon.content; this.setMap(options.map); }
        setMap(map) { this.el.remove(); if (map) map.el.append(this.el); }
        getPosition() { return this.options.position; }
        setZIndex() {} getElement() { return this.el; }
      }
      class InfoWindow {
        constructor(options) { this.el = document.createElement('div'); this.el.innerHTML = options.content; }
        open(map) { map.el.append(this.el); } close() { this.el.remove(); }
      }
      class LatLng { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }
      class LatLngBounds { extend() {} getCenter() { return new LatLng(37.58, 126.92); } }
      window.naver = { maps: { Map, Marker, InfoWindow, LatLng, LatLngBounds, Point: class {}, Position: { TOP_LEFT: 1 }, Event: {
        addListener(object, event, fn) { object.el?.addEventListener(event, e => { if (!(object instanceof Map) || e.target === object.el) fn(e); }); }, clearListeners() {},
      } } };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.place-card-item');
    await require('./design_system_checks.cjs')(page);
    await page.waitForSelector('#btn-signup');
    assert(await page.$eval('#solo-journey', e => e.textContent.includes('학교 인증하고 혼밥 기록')));
    await page.click('#btn-growth-guide');
    await page.waitForSelector('#growth-guide-modal:not(.hidden)');
    await page.click('[data-close="growth-guide-modal"]');
    assert.equal(await page.$eval('.solo-badge-chip', e => e.textContent), place.displaySolo.label, '난이도는 서버 결과를 표시해야 함');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('옛 로컬 리뷰')), false);
    await page.select('#sort-select', 'level-asc');
    assert.equal(await page.$eval('.place-title', e => e.textContent), '테스트 버거');
    await page.select('#sort-select', 'level-desc');
    assert.equal(await page.$eval('.place-title', e => e.textContent), '테스트 국밥');
    await page.evaluate(() => showResults('혼밥', false)); // 필터·정렬은 검색 결과 화면
    await page.click('.tab-btn[data-filter="1"]');
    assert.equal(await page.$$eval('.place-card-item', els => els.length), 1);
    await page.click('.tab-btn[data-filter="all"]');
    await page.click('#place-card-123 .btn-heart-fav');
    await page.click('.tab-btn[data-filter="fav"]');
    assert.equal(await page.$eval('.place-title', e => e.textContent), '테스트 국밥');
    await page.click('.tab-btn[data-filter="all"]');
    await page.evaluate(() => showHome());
    await page.click('#btn-random-roulette');
    await page.waitForSelector('#roulette-card-slot.is-winner');
    await page.click('#roulette-close');
    await page.click('#btn-login');
    await page.click('#auth-mode-toggle');
    await page.type('#auth-email', 'test@mju.ac.kr');
    await page.type('#auth-password', 'Password123!');
    await page.type('#auth-nickname', '학우');
    await page.click('#auth-submit');
    await page.waitForSelector('#verify-form:not(.hidden)');
    assert(calls.some(c => c.url === '/api/auth/login'), '가입 후 세션 생성');
    await page.click('#btn-resend-code');
    await page.waitForFunction(() => document.querySelector('#toast-text').textContent.includes('60초'));
    await page.type('#verify-code', '123456'); await page.click('#verify-submit');
    await page.waitForSelector('#auth-modal.hidden');
    await page.waitForFunction(() => document.querySelector('#journey-status').textContent.includes('5점'));
    await page.evaluate(() => showResults('혼밥', false));
    await page.click('#btn-view-map');
    await page.waitForSelector('.map-place-marker');
    assert.equal(await page.$$eval('.marker-conquered', els => els.length), 1, '로그인 직후 기존 정복 위치 표시');
    await page.click('#btn-map-fullscreen');
    await page.$eval('.map-place-marker', e => e.click());
    await page.$eval('.popup-btn.secondary', e => e.click());
    await page.waitForSelector('#reviews-list-modal:not(.hidden)');
    assert(await page.$eval('#reviews-list-close', e => { const r=e.getBoundingClientRect(); return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2) === e; }), '전체화면 지도 위에 리뷰 모달 표시');
    await page.click('#reviews-list-close');
    await page.keyboard.press('Escape');
    await page.click('#btn-view-list');
    await page.evaluate(() => openReviewModalById('123'));
    await page.waitForSelector('#review-modal:not(.hidden)');
    await page.type('#review-textarea', '<img src=x onerror=alert(1)> 맛있어요');
    await page.click('#btn-submit-review'); await page.waitForSelector('#review-modal.hidden');
    await page.waitForFunction(() => document.querySelector('.solo-badge-chip').textContent.includes('Lv.4'));
    assert(calls.some(c => c.url === '/api/reviews' && c.method === 'POST' && c.body.soloLevel === 1));
    reviews.push({ id: 'other', userId: 'other', user: { id: 'other', nickname: '<b>다른 학우</b>', isVerified: true }, content: '남의 후기', soloLevel: 3, createdAt: new Date().toISOString() });
    await page.evaluate(() => openReviewsList('123'));
    await page.waitForSelector('[data-review-id="mine"]');
    assert.equal(await page.$$eval('[data-review-id="other"] button', els => els.length), 0);
    assert.equal(await page.$eval('#reviews-list-container', e => e.querySelectorAll('img, b').length), 0, '입력 HTML 실행 방지');
    await page.click('[data-review-id="mine"] [data-action="edit"]');
    await page.waitForSelector('#review-modal:not(.hidden)');
    await page.$eval('#review-textarea', e => e.value = '수정된 후기');
    await page.click('#btn-submit-review'); await page.waitForSelector('#review-modal.hidden');
    assert(calls.some(c => c.method === 'PATCH'));
    await page.evaluate(() => openReviewsList('123'));
    await page.waitForSelector('[data-review-id="mine"] [data-action="delete"]');
    await page.click('[data-review-id="mine"] [data-action="delete"]');
    await page.waitForFunction(() => !document.querySelector('[data-review-id="mine"]'));
    assert(calls.some(c => c.method === 'DELETE'));
    await page.waitForFunction(() => document.querySelector('#place-card-123 .solo-badge-chip').textContent.includes('Lv.2'));
    await page.click('#reviews-list-close');
    reviewReadFails = true;
    await page.evaluate(() => openReviewsList('123'));
    await page.waitForFunction(() => document.getElementById('reviews-list-container').textContent.includes('불러오지 못했습니다'));
    await page.click('#reviews-list-close');
    reviewReadFails = false;
    await page.evaluate(() => openReviewsList('123'));
    await page.waitForSelector('[data-review-id="other"]');
    await page.click('#reviews-list-close');
    await page.evaluate(() => checkInById('123'));
    await page.waitForFunction(() => document.querySelector('#toast-text').textContent.includes('체크인'));
    await page.locator('.account-summary').click();
    await page.waitForSelector('.account-dropdown[open] #btn-mypage');
    await page.click('#btn-mypage'); await page.waitForSelector('#mypage-content progress');
    assert(await page.$eval('#mypage-content', e => e.textContent.includes('추천 식당')));
    assert(await page.$eval('#mypage-close', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), '성장 기록이 길어도 닫기 버튼이 화면 안에 있어야 함');
    await page.click('[data-profile-action="map"]');
    await page.waitForSelector('.marker-recommended');
    assert.equal(await page.$$eval('.marker-conquered', els => els.length), 1);
    assert.equal(await page.$$eval('.marker-recommended', els => els.length), 1);
    await page.click('#btn-exit-personal-map');
    await page.click('#btn-view-list');
    // 미인증 403은 로그인 상태를 유지한 채 인증 화면으로 안내한다.
    force403 = true;
    await page.evaluate(async () => {
      currentUser.isVerified = false;
      try { await apiRequest('/api/reviews', { method: 'POST', body: {} }); } catch {}
    });
    await page.waitForSelector('#verify-form:not(.hidden)');
    await page.click('[data-close="auth-modal"]');
    await page.evaluate(() => currentUser.isVerified = true);
    force403 = false;
    duplicate = true;
    reviews.push({ id: 'mine', userId: 'me', user, content: '기존 리뷰', soloLevel: 4, createdAt: new Date().toISOString() });
    // 사전 조회 직후 다른 탭에서 작성된 상황: POST의 409가 편집으로 전환되는지 확인.
    await page.evaluate(() => openReviewModalById('123'));
    await page.waitForSelector('#review-modal:not(.hidden)');
    await page.evaluate(() => editingReviewId = null);
    await page.click('#btn-submit-review');
    await page.waitForFunction(() => document.querySelector('#btn-submit-review').textContent.includes('수정'));
    assert.equal(await page.$eval('#review-textarea', e => e.value), '기존 리뷰');
    force401 = true;
    await page.click('#btn-submit-review'); await page.waitForSelector('#auth-modal:not(.hidden)');
    await page.waitForFunction(() => !document.querySelector('#btn-mypage'));
    assert.equal(await page.$$eval('.marker-conquered, .marker-recommended', els => els.length), 0, '세션 만료 시 개인 마커 제거');
    force401 = false;
    await page.type('#auth-password', 'Password123!');
    await page.click('#auth-submit');
    await page.waitForSelector('#auth-modal.hidden');
    // 로그인 직후 프로필 갱신이 헤더를 다시 렌더링해도 현재 버튼을 찾아 클릭한다.
    await page.locator('.account-summary').click();
    await page.locator('#btn-logout').click();
    await page.waitForSelector('#btn-login');
    assert(calls.some(c => c.url === '/api/auth/logout'));
    assert.equal(await page.$eval('#fav-badge-count', e => e.textContent), '1', '로그아웃해도 찜 유지');
    assert.equal(await page.$eval('#journey-status', e => e.querySelector('progress')), null, '로그아웃 후 개인 진행률 제거');
    accountConfigured = false;
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('#btn-signup');
    await page.waitForSelector('#auth-form:not(.hidden)');
    assert(await page.$eval('#auth-submit', e => e.disabled), '미설정 계정 요청을 전송하지 않음');
    assert(await page.$eval('#account-service-notice', e => !e.classList.contains('hidden') && e.textContent.includes('준비')));
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.setViewport({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '모바일 가로 넘침');
    console.log('PASS: server difficulty/refresh, signup/login/verify/logout/429, review CRUD/ownership/XSS/409/401/403, checkin, personal/fullscreen map, sort/filter/favorites/roulette, mobile');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
