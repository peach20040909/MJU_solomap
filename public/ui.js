/** SoloMap DS: 공통 벡터 아이콘과 키보드·포커스 동작. 외부 라이브러리 없음. */
const soloIconPaths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 16h.01M12 12h.01M16 8h.01M8 16h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>',
  school: '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v6c4 3 8 3 12 0v-6M22 9v7"/>',
  grow: '<path d="M12 21v-9M12 16C4 16 3 10 3 6c7 0 9 4 9 9M12 12c0-7 4-9 9-9 0 6-3 10-9 10"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  external: '<path d="M14 3h7v7M10 14 21 3M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-1l-5 2 2-5a10 10 0 0 1-1-4 9 9 0 1 1 17-1Z"/>',
  phone: '<path d="m8 3 3 5-3 2c1 3 3 5 6 6l2-3 5 3-1 5C10 22 2 14 3 4Z"/>',
  utensils: '<path d="M4 3v6c0 3 6 3 6 0V3M7 3v18M20 21V3c-5 3-5 10 0 10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-8 16-8 16 0"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
function soloIcon(name) {
  return `<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${soloIconPaths[name] || soloIconPaths.utensils}</svg>`;
}
// 사진이 없는 식당의 카드 이미지: 카테고리별 음식 일러스트 (피그마 Photo Fallback과 동일).
const soloFoodArtPaths = (() => {
  const E5 = '#FF5A1F', E3 = '#FF9E75', E2 = '#FFCDB5', E7 = '#B03508', W = '#FFFFFF', Y = '#FFD25A', G = '#8BC27A', R = '#D9381E', N = '#2F3A2C';
  return {
    // 추천: 반짝이는 별(랜덤 추천 칸)
    pick: `<path d="M60 18c4 22 12 30 34 34-22 4-30 12-34 34-4-22-12-30-34-34 22-4 30-12 34-34Z" fill="${E5}"/><path d="M60 38c2 9 5 12 14 14-9 2-12 5-14 14-2-9-5-12-14-14 9-2 12-5 14-14Z" fill="${Y}"/><path d="M92 74c1.5 8 4 10.5 12 12-8 1.5-10.5 4-12 12-1.5-8-4-10.5-12-12 8-1.5 10.5-4 12-12Z" fill="${E3}"/><circle cx="28" cy="88" r="5" fill="${E2}"/><circle cx="90" cy="26" r="4" fill="${E2}"/>`,
    // 중식: 짜장면 그릇(면 위 짜장 소스 · 오이채)
    jjajang: `<path d="M86 10 66 50M98 14 76 52" stroke="${E7}" stroke-width="4" stroke-linecap="round"/><path d="M18 58h84c0 24-19 42-42 42S18 82 18 58Z" fill="${E5}"/><ellipse cx="60" cy="58" rx="42" ry="10" fill="${Y}"/><path d="M28 58c4-5 8 3 12 0s8 3 12 0 8 3 12 0 8 3 12 0 8 3 12 0" stroke="#F2B53A" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M40 56c0-8 9-12 20-12s20 4 20 12c-6 4-34 4-40 0Z" fill="#4A2A12"/><path d="M50 46l8 4M62 44l6 5M56 52l8 0" stroke="${G}" stroke-width="3" stroke-linecap="round"/><rect x="48" y="96" width="24" height="7" rx="3.5" fill="${E7}"/>`,
    // 마라탕: 빨간 국물 그릇 + 두부·청경채·고추
    mala: `<path d="M86 10 66 50M98 14 76 52" stroke="${E7}" stroke-width="4" stroke-linecap="round"/><path d="M18 58h84c0 24-19 42-42 42S18 82 18 58Z" fill="${E5}"/><ellipse cx="60" cy="58" rx="42" ry="10" fill="${R}"/><rect x="30" y="50" width="13" height="10" rx="2" fill="${W}"/><rect x="47" y="53" width="11" height="9" rx="2" fill="${W}"/><path d="M64 60c2-10 10-14 18-12-2 8-9 13-18 12Z" fill="${G}"/><path d="M78 56c6-1 12 1 14 4-4 2-10 1-14-4Z" fill="${E7}"/><circle cx="40" cy="62" r="2" fill="${Y}"/><circle cx="72" cy="52" r="2" fill="${Y}"/><circle cx="56" cy="50" r="1.8" fill="${E3}"/><rect x="48" y="96" width="24" height="7" rx="3.5" fill="${E7}"/>`,
    // 김밥: 김 · 밥 · 속재료가 보이는 단면 세 조각
    kimbap: `<ellipse cx="60" cy="86" rx="48" ry="14" fill="${E2}"/>${[[36, 66], [64, 58], [86, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" fill="${N}"/><circle cx="${x}" cy="${y}" r="14" fill="${W}"/><rect x="${x - 7}" y="${y - 7}" width="6" height="6" rx="1.5" fill="${Y}"/><rect x="${x + 1}" y="${y - 6}" width="5" height="5" rx="1.5" fill="${G}"/><rect x="${x - 4}" y="${y + 1}" width="9" height="5" rx="1.5" fill="${E5}"/>`).join('')}`,
    rice: `<path d="M22 58h76c0 23-17 40-38 40S22 81 22 58Z" fill="${E5}"/><path d="M26 58c2-14 16-22 34-22s32 8 34 22Z" fill="${W}"/><circle cx="46" cy="46" r="3" fill="${E2}"/><circle cx="66" cy="42" r="3" fill="${E2}"/><rect x="48" y="96" width="24" height="7" rx="3.5" fill="${E7}"/><path d="M74 16 98 52M84 14l20 34" stroke="${E7}" stroke-width="4" stroke-linecap="round"/>`,
    stew: `<path d="M44 18c-4 6 4 9 0 15M60 14c-4 6 4 9 0 15M76 18c-4 6 4 9 0 15" stroke="${E3}" stroke-width="4" stroke-linecap="round" fill="none"/><rect x="20" y="46" width="80" height="48" rx="18" fill="${E7}"/><ellipse cx="60" cy="48" rx="40" ry="11" fill="${E5}"/><rect x="40" y="42" width="12" height="9" rx="2" fill="${W}"/><rect x="62" y="44" width="12" height="9" rx="2" fill="${W}"/><circle cx="56" cy="50" r="4" fill="${Y}"/><rect x="12" y="62" width="10" height="8" rx="4" fill="${E7}"/><rect x="98" y="62" width="10" height="8" rx="4" fill="${E7}"/>`,
    grill: `<circle cx="60" cy="64" r="40" fill="${E7}"/><circle cx="60" cy="64" r="32" fill="#7A1D05"/><path d="M32 52h56M30 64h60M32 76h56" stroke="${E3}" stroke-width="3" stroke-linecap="round"/><g transform="rotate(-12 49 55)"><rect x="34" y="48" width="30" height="14" rx="7" fill="${E3}"/><path d="M38 54h22" stroke="${W}" stroke-width="3" stroke-linecap="round"/></g><g transform="rotate(10 71 75)"><rect x="56" y="68" width="30" height="14" rx="7" fill="${E3}"/><path d="M60 74h22" stroke="${W}" stroke-width="3" stroke-linecap="round"/></g>`,
    noodle: `<path d="M84 10 64 52M96 14 72 54" stroke="${E7}" stroke-width="4" stroke-linecap="round"/><path d="M56 58c0-10 6-12 6-22M64 58c0-10 6-12 6-22M48 58c0-8 4-10 4-16" stroke="${E2}" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M18 58h84c0 24-19 42-42 42S18 82 18 58Z" fill="${E5}"/><ellipse cx="60" cy="58" rx="42" ry="9" fill="${E2}"/><path d="M34 58c6-4 10 4 16 0s10 4 16 0 10 4 16 0" stroke="${W}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    snack: `<ellipse cx="58" cy="80" rx="44" ry="16" fill="${E2}"/><rect x="28" y="62" width="30" height="12" rx="6" fill="${E5}"/><rect x="40" y="72" width="30" height="12" rx="6" fill="${E5}"/><rect x="54" y="60" width="30" height="12" rx="6" fill="${E5}"/><path d="M92 16v72" stroke="${E7}" stroke-width="4" stroke-linecap="round"/><path d="M84 24c8 4 8 8 0 12s-8 8 0 12 8 8 0 12" stroke="${E3}" stroke-width="10" stroke-linecap="round" fill="none"/>`,
    chinese: `<path d="M32 28c0-14 56-14 56 0" stroke="${E7}" stroke-width="4" fill="none"/><path d="M26 40h68l-8 60H34Z" fill="${W}" stroke="${E3}" stroke-width="3" stroke-linejoin="round"/><path d="M26 40 40 28h40l14 12" fill="${E2}"/><circle cx="60" cy="70" r="14" fill="${E5}"/><path d="M53 70h14M60 63v14" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`,
    japanese: `<ellipse cx="60" cy="74" rx="48" ry="22" fill="${W}" stroke="${E2}" stroke-width="3"/><path d="M76 60c6-6 18-6 22 2M80 70c6-4 14-2 18 4" stroke="${G}" stroke-width="4" stroke-linecap="round" fill="none"/>${[0, 1, 2, 3].map(i => `<rect x="${22 + i * 13}" y="${50 + i * 2}" width="12" height="30" rx="4" fill="${E3}" stroke="${E5}" stroke-width="3"/>`).join('')}`,
    pizza: `<path d="M60 102 22 28c24-12 52-12 76 0Z" fill="${Y}"/><path d="M22 28c24-12 52-12 76 0l-4 8c-22-10-46-10-68 0Z" fill="${E5}"/><circle cx="52" cy="48" r="7" fill="${E7}"/><circle cx="70" cy="52" r="6" fill="${E7}"/><circle cx="60" cy="72" r="6" fill="${E7}"/>`,
    burger: `<path d="M24 52c0-18 16-28 36-28s36 10 36 28Z" fill="${E5}"/><circle cx="48" cy="38" r="2.5" fill="${W}"/><circle cx="62" cy="34" r="2.5" fill="${W}"/><circle cx="74" cy="40" r="2.5" fill="${W}"/><path d="M20 58c8-6 12 6 20 0s12 6 20 0 12 6 20 0 12 6 20 0" stroke="${G}" stroke-width="6" stroke-linecap="round" fill="none"/><rect x="22" y="64" width="76" height="14" rx="7" fill="${E7}"/><rect x="24" y="74" width="72" height="6" rx="3" fill="${Y}"/><path d="M24 84h72c0 8-6 14-14 14H38c-8 0-14-6-14-14Z" fill="${E5}"/>`,
    chicken: `<ellipse cx="54" cy="56" rx="30" ry="24" transform="rotate(-35 54 56)" fill="${E5}"/><path d="M38 44c6-8 18-12 26-6" stroke="${E3}" stroke-width="4" stroke-linecap="round" fill="none"/><rect x="70" y="68" width="10" height="26" rx="5" transform="rotate(-35 75 81)" fill="${W}" stroke="${E2}" stroke-width="2"/><circle cx="88" cy="90" r="7" fill="${W}" stroke="${E2}" stroke-width="2"/><circle cx="94" cy="84" r="7" fill="${W}" stroke="${E2}" stroke-width="2"/>`,
    etc: `<circle cx="60" cy="60" r="40" fill="${E2}"/><circle cx="60" cy="60" r="28" fill="${W}"/><path d="M28 20v30M22 20v14c0 6 12 6 12 0V20M28 50v50" stroke="${E7}" stroke-width="4" stroke-linecap="round" fill="none"/><ellipse cx="94" cy="34" rx="8" ry="14" fill="${E7}"/><path d="M94 46v54" stroke="${E7}" stroke-width="4" stroke-linecap="round"/>`,
  };
})();
// 카카오 category_name(+상호명)을 일러스트 종류로. 앞쪽 규칙이 우선한다.
const soloFoodArtRules = [
  ['chicken', '치킨', /치킨/],
  ['burger', '버거 · 패스트푸드', /패스트푸드|햄버거|버거|샌드위치/],
  ['pizza', '양식 · 피자', /양식|피자|이탈리안|파스타|패밀리레스토랑|멕시칸/],
  ['chinese', '중식', /중식|중국|양꼬치|마라/],
  ['japanese', '일식 · 돈까스', /일식|돈까스|초밥|우동|라멘|일본식/],
  ['noodle', '면 · 국수', /국수|칼국수|냉면|쌀국수/],
  ['snack', '분식', /분식|떡볶이|간식|김밥|토스트|타코야끼/],
  ['grill', '고기 · 구이', /육류|고기|곱창|막창|삼겹|구이|갈비/],
  ['stew', '국 · 찌개', /찌개|전골|감자탕|곰탕|설렁탕|국밥|순대|두부|샤브|해장/],
  ['rice', '밥 · 한식', /한식|도시락|주먹밥|덮밥|백반|뷔페|핵밥|혼밥/],
];
function soloFoodArt(categoryName = '', placeName = '') {
  const text = `${categoryName} ${placeName}`;
  const [key, label] = soloFoodArtRules.find(([, , pattern]) => pattern.test(text)) || ['etc', '기타'];
  return { key, label, svg: `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${soloFoodArtPaths[key]}</svg>` };
}
function soloEscapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
}
function soloEmptyState(title, description, { icon = 'search', variant = 'default' } = {}) {
  const error = variant === 'error';
  return `<div class="sm-empty-state${error ? ' sm-empty-state--error' : ''}" role="${error ? 'alert' : 'status'}"><span class="sm-state-icon">${soloIcon(icon)}</span><h3>${soloEscapeHtml(title)}</h3><p>${soloEscapeHtml(description)}</p></div>`;
}
document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = soloIcon(element.dataset.icon); });
document.querySelectorAll('[data-food]').forEach(element => { element.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${soloFoodArtPaths[element.dataset.food] || soloFoodArtPaths.etc}</svg>`; });
// 모든 모달은 같은 포커스 순환/복원 규칙을 사용한다. 기존 열기·닫기 API는 유지한다.
document.addEventListener('DOMContentLoaded', () => {
  const previousFocus = new WeakMap();
  let lastOutsideFocus = document.activeElement;
  document.addEventListener('focusin', event => { if (!event.target.closest('.modal-overlay')) lastOutsideFocus = event.target; });
  const isOpen = modal => !modal.classList.contains('hidden') && !modal.hidden;
  const focusables = modal => [...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(e => !e.disabled && e.getClientRects().length);
  const modals = [...document.querySelectorAll('.modal-overlay')];
  const syncSelection = element => {
    if (element.matches('.tab-btn, .view-tab-btn, .kw-chip, .level-opt, .index-card')) element.setAttribute('aria-pressed', String(element.classList.contains('active')));
  };
  document.querySelectorAll('.tab-btn, .view-tab-btn, .kw-chip, .level-opt, .index-card').forEach(syncSelection);
  new MutationObserver(records => records.forEach(record => syncSelection(record.target))).observe(document.body, { attributes:true, attributeFilter:['class'], subtree:true });
  for (const modal of modals) {
    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (!modal.hasAttribute('aria-label') && !modal.hasAttribute('aria-labelledby')) modal.setAttribute('aria-label', modal.querySelector('.modal-tag')?.textContent.trim() || '상세 정보');
    let wasOpen = isOpen(modal);
    new MutationObserver(() => {
      const open = isOpen(modal);
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) {
        previousFocus.set(modal, modal.contains(document.activeElement) ? lastOutsideFocus : document.activeElement);
        const target = modal.querySelector('input:not([disabled])') || focusables(modal)[0];
        if (!modal.contains(document.activeElement)) target?.focus({ preventScroll: true });
      } else {
        const target = previousFocus.get(modal);
        if (!modals.some(m => m !== modal && isOpen(m)) && target?.isConnected) target.focus({ preventScroll: true });
      }
      document.body.classList.toggle('sm-dialog-open', modals.some(isOpen));
    }).observe(modal, { attributes: true, attributeFilter: ['class', 'hidden'] });
  }
  document.addEventListener('keydown', event => {
    const modal = modals.filter(isOpen).at(-1);
    if (modal && event.key === 'Tab') {
      const controls = focusables(modal);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    if (modal && event.key === 'Escape') modal.classList.add('hidden');
    const roleButton = event.target.closest('[role="button"]');
    if (roleButton && ['Enter', ' '].includes(event.key)) { event.preventDefault(); roleButton.click(); }
  });
});
