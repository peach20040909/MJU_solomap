const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function auditDesignSystem(page) {
  const capture = process.env.SOLOMAP_CAPTURE_DS === '1';
  const output = path.join(__dirname, '../artifacts/design-system');
  if (capture) await fs.mkdir(output, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('16px Pretendard')), '자체 호스팅 Pretendard 로드');
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    const metrics = await page.evaluate(() => {
      // 지도 링크는 카드 상세(접힘) 안에 있으므로 펼친 뒤 터치 크기를 잰다.
      document.querySelector('.card-more')?.setAttribute('open', '');
      const root = getComputedStyle(document.documentElement);
      const controls = ['#btn-login', '#btn-signup', '.search-submit-btn', '.kw-chip', '.tab-btn', '.btn-heart-fav', '.btn-map-link'];
      return {
        bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
        overflow: document.documentElement.scrollWidth > innerWidth,
        controls: controls.map(selector => { const e = document.querySelector(selector); const r = e.getBoundingClientRect(); return { selector, height: r.height, width: r.width, component: e.classList.contains('sm-button') }; }),
        token: root.getPropertyValue('--sm-color-action').trim(),
        columns: getComputedStyle(document.querySelector('.places-container')).gridTemplateColumns.split(' ').length,
      };
    });
    assert.equal(metrics.bodyFont, 16, `${width}: 기본 본문 16px`);
    assert.equal(metrics.overflow, false, `${width}: 가로 넘침 없음`);
    assert(metrics.token, '공통 컬러 토큰 적용');
    for (const control of metrics.controls) {
      assert(control.height >= 44 && control.width >= 44, `${width}: ${control.selector} 44px 터치 타깃`);
      assert(control.component, `${control.selector} 공통 버튼 사용`);
    }
    assert.equal(metrics.columns, width < 680 ? 1 : width < 1100 ? 2 : 3, `${width}: 식당 그리드`);
    if (capture) await page.screenshot({ path: path.join(output, `app-${width}.png`), fullPage: true });
    if (capture && [375,1440].includes(width)) {
      await page.screenshot({ path:path.join(output, `app-${width}-top.png`) });
      await (await page.$('#place-card-123')).screenshot({ path:path.join(output, `card-${width}.png`) });
    }
  }
  await page.setViewport({ width: 375, height: 1000 });
  await page.click('#btn-view-map');
  assert(await page.evaluate(() => {
    const frame = document.querySelector('#map-view-container').getBoundingClientRect();
    return [...document.querySelectorAll('.map-floating-controls button')].every(e => { const r = e.getBoundingClientRect(); return r.left >= frame.left && r.right <= frame.right && r.height >= 44; });
  }), '모바일 지도 컨트롤이 잘리지 않고 터치 가능');
  if (capture) await page.screenshot({ path: path.join(output, 'map-375.png'), fullPage: true });
  await page.click('#btn-view-list');
  const colors = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(['--sm-color-action', '--sm-color-action-hover', '--sm-color-on-action', '--sm-color-surface', '--sm-color-text', '--sm-color-text-secondary', '--sm-color-text-muted', '--sm-color-focus', '--sm-color-control-border', ...[1,2,3,4,5].flatMap(i => [`--sm-level-${i}`, `--sm-level-${i}-subtle`])].map(key => [key, css.getPropertyValue(key).trim()]));
  });
  function contrast(a, b) {
    const luminance = hex => { const c = hex.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
    const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  const ratios = {};
  for (const token of ['--sm-color-action', '--sm-color-action-hover', '--sm-color-text', '--sm-color-text-secondary', '--sm-color-text-muted']) {
    ratios[token] = +contrast(colors[token], colors['--sm-color-surface']).toFixed(2);
    assert(ratios[token] >= 4.5, `${token}: 본문 대비 4.5:1`);
  }
  for (const level of [1,2,3,4,5]) assert(contrast(colors[`--sm-level-${level}`], colors[`--sm-level-${level}-subtle`]) >= 4.5, `Lv.${level} 배지 대비`);
  assert(contrast(colors['--sm-color-control-border'], colors['--sm-color-surface']) >= 3, '입력 경계 대비 3:1');
  for (const width of [375, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(e => `${e.tagName}.${[...e.classList].join('.')}`) : []);
    assert.deepEqual(wide, [], `${width}: 200% 텍스트 가로 넘침`);
    const overlap = await page.evaluate(() => { const input = document.querySelector('#search-input').getBoundingClientRect(), submit = document.querySelector('.search-submit-btn').getBoundingClientRect(); return input.left < submit.right && input.right > submit.left && input.top < submit.bottom && input.bottom > submit.top; });
    assert.equal(overlap, false, `${width}: 확대해도 검색 입력과 버튼이 겹치지 않음`);
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  }
  await page.setViewport({ width: 1440, height: 1000 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert(await page.$eval('.search-submit-btn', e => parseFloat(getComputedStyle(e).transitionDuration) <= 0.001), '모션 감소 설정');
  await page.emulateMediaFeatures([]);
  await page.click('#btn-login');
  await page.waitForSelector('#auth-modal:not(.hidden)');
  if (capture) await page.screenshot({ path:path.join(output, 'login-1440.png') });
  await page.focus('#auth-email');
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '닫기', '모달 내부 포커스 순서');
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'auth-mode-toggle', '모달 안에서 포커스 순환');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#auth-modal.hidden');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-login', '모달 닫은 뒤 포커스 복원');
  if (capture) await fs.writeFile(path.join(output, 'contrast.json'), JSON.stringify(ratios, null, 2));
  // 컴포넌트 미리보기도 서비스와 같은 CSS/폰트를 사용하는지 확인한다.
  const url = page.url();
  await page.goto(new URL('/design-system.html', url).href, { waitUntil: 'networkidle0' });
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `갤러리 ${width}: 가로 넘침`);
    if (capture) await page.screenshot({ path: path.join(output, `gallery-${width}.png`), fullPage: true });
  }
  await page.setViewport({ width:812, height:375 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '모바일 가로 방향');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.place-card-item');
  await page.click('#btn-login');
  const closeVisible = await page.$eval('#auth-modal .btn-close', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  assert(closeVisible, '가로 방향에서도 모달 닫기 가능');
  await page.keyboard.press('Escape');
  await page.setViewport({ width:1440, height:1000 });
  console.log('PASS: DS responsive/type/touch/contrast/200%/gallery/reduced-motion/dialog keyboard');
};
