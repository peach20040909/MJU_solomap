/** 학교 인증·공유 리뷰·성장 기록. API의 세션 쿠키와 서버 난이도를 그대로 사용한다. */
let currentUser = null;
let authMode = 'login';
let editingReviewId = null;
let activeReviewListPlace = null;
let reviewListVersion = 0;
let profileVersion = 0;
let conqueredPlaces = [];
let recommendedPlaces = [];
let personalMapMode = false;
const knownPlaces = new Map();
const authModal = document.getElementById('auth-modal');
const mypageModal = document.getElementById('mypage-modal');
const reviewsListModal = document.getElementById('reviews-list-modal');
const authForm = document.getElementById('auth-form');
const verifyForm = document.getElementById('verify-form');
const growthGuideModal = document.getElementById('growth-guide-modal');
let accountConfigured = null;

// 204에는 JSON 본문이 없다. 오류의 상태와 reviewId는 화면 전환에 사용한다.
async function apiRequest(url, { method = 'GET', body, quiet = false } = {}) {
  try {
    const response = await fetch(url, {
      method, credentials: 'same-origin',
      ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      const error = Object.assign(new Error(data?.message || '요청을 처리하지 못했습니다.'), { status: response.status, reviewId: data?.reviewId });
      if (!quiet) {
        if (response.status === 401) { clearAccount(); openAuth('login'); }
        else if (response.status === 403 && currentUser && !currentUser.isVerified) openAuth('verify');
      }
      throw error;
    }
    return data;
  } catch (error) {
    if (!quiet) showToast(error.message || '서버에 연결하지 못했습니다.');
    throw error;
  }
}

async function busy(button, action) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  if (button) button.setAttribute('aria-busy', 'true');
  try { await action(); } catch { /* apiRequest에서 사용자에게 오류를 표시한다. */ }
  finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
}

function renderAccountMenu() {
  document.getElementById('account-menu').innerHTML = currentUser
    ? `<details class="account-dropdown">
        <summary class="account-summary" aria-label="${escapeHtml(currentUser.nickname)} 계정 메뉴"><span class="account-avatar" aria-hidden="true">${escapeHtml(Array.from(currentUser.nickname)[0] || '나')}</span><span class="account-identity">${escapeHtml(currentUser.nickname)}</span><span class="account-chevron" aria-hidden="true">⌄</span></summary>
        <div class="account-dropdown-panel">
          <strong>${escapeHtml(currentUser.nickname)}</strong><p class="account-profile-meta">${currentUser.isVerified ? '학교 인증 완료' : '학교 인증 필요'} · Lv.${currentUser.level || 1}</p>
          ${currentUser.isVerified ? '' : '<button id="btn-verify" type="button" class="sm-button sm-button--ghost">학교 메일 인증</button>'}
          <button id="btn-mypage" type="button" class="sm-button sm-button--ghost">${soloIcon('grow')} 내 혼밥 기록</button><button id="btn-logout" type="button" class="sm-button sm-button--ghost">로그아웃</button>
        </div>
      </details>`
    : '<button id="btn-login" type="button" class="account-guest sm-button sm-button--icon sm-button--ghost" aria-label="로그인 · 회원가입"><span class="account-avatar account-avatar--guest" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span></button>';
  renderJourney();
}

function closeAccountMenu(restoreFocus = false) {
  const menu = document.querySelector('.account-dropdown[open]');
  if (!menu) return;
  menu.open = false;
  if (restoreFocus) menu.querySelector('summary').focus();
}
document.addEventListener('click', event => {
  if (!event.target.closest('#account-menu')) closeAccountMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeAccountMenu(true);
});

// 서버 칭호 'Lv.1 🐣 혼밥 입문자'에서 레벨 표시와 이모지를 뺀 이름만 쓴다 (화면은 캐릭터 그림으로 레벨을 보여 준다)
function plainTitle(title) {
  return String(title || '').replace(/^Lv\.\d+\s*/, '').replace(/^[^가-힣A-Za-z0-9]+\s*/, '');
}

function renderJourney() {
  const status = document.getElementById('journey-status');
  if (!currentUser) {
    status.innerHTML = `<span class="journey-lv">LV. 01</span><img class="journey-char" src="/levels/level-1.webp" alt="" width="96" height="96">
      <p class="journey-description"><strong class="journey-title">명지대학교 학생 인증하고<br>혼밥 기록 쌓아요</strong> 리뷰를 나누고 체크인하면 내 혼밥 레벨이 올라가요.</p>
      <button type="button" class="journey-start-button sm-button sm-button--ghost" data-journey-action="start">학교 계정으로 시작하기 <span aria-hidden="true">→</span></button>`;
    return;
  }
  const hasProgress = typeof currentUser.exp === 'number';
  const lv = Math.min(5, Math.max(1, Number(currentUser.level) || 1));
  const title = plainTitle(currentUser.title || '혼밥 여정');
  status.innerHTML = `<span class="journey-lv">LV. 0${lv}</span><img class="journey-char" src="/levels/level-${lv}.webp" alt="" width="96" height="96">
    <span class="journey-level-title">${escapeHtml(title)}</span>
    ${hasProgress ? `<span class="journey-progress"><progress max="100" value="${currentUser.progressPercent}" aria-label="내 혼밥 레벨 진행률" class="sm-progress"></progress><span>${currentUser.exp}점</span></span>
      <span class="journey-caption">${currentUser.conqueredPlaceCount}곳 정복 · ${currentUser.visitCount}회 방문</span>` : '<span class="journey-caption">혼밥 기록을 불러오는 중...</span>'}
    <button type="button" class="journey-start-button sm-button sm-button--ghost" data-journey-action="profile">${currentUser.isVerified ? '내 혼밥 기록 보기' : '학교 메일 인증하기'} <span aria-hidden="true">→</span></button>`;
}

function updateAccountAvailability() {
  const notice = document.getElementById('account-service-notice');
  notice.classList.toggle('hidden', accountConfigured === true);
  notice.textContent = accountConfigured === null ? '계정 기능을 확인하고 있어요.' : '계정 기능을 준비하고 있어요. 지금은 식당 검색·지도·찜을 이용할 수 있어요.';
  ['auth-submit', 'verify-submit', 'btn-resend-code'].forEach(id => { document.getElementById(id).disabled = accountConfigured !== true; });
}

function clearAccount() {
  profileVersion++;
  currentUser = null;
  conqueredPlaces = [];
  recommendedPlaces = [];
  personalMapMode = false;
  document.getElementById('personal-map-note').classList.add('hidden');
  editingReviewId = null;
  document.getElementById('mypage-content').replaceChildren();
  mypageModal.classList.add('hidden');
  reviewModal.classList.add('hidden');
  reviewsListModal.classList.add('hidden');
  renderAccountMenu();
  updateMapMarkers();
}

async function refreshAccount() {
  const version = ++profileVersion;
  const data = await apiRequest('/api/auth/me', { quiet: true });
  if (version !== profileVersion) return;
  currentUser = data.user;
  renderAccountMenu();
  await loadPersonalPlaces();
  updateMapMarkers();
}

function openAuth(mode = 'login') {
  authMode = mode;
  authModal.classList.remove('hidden');
  growthGuideModal.classList.add('hidden');
  updateAccountAvailability();
  authForm.classList.toggle('hidden', mode === 'verify');
  verifyForm.classList.toggle('hidden', mode !== 'verify');
  document.getElementById('nickname-field').classList.toggle('hidden', mode !== 'signup');
  document.getElementById('auth-nickname').required = mode === 'signup';
  document.getElementById('auth-password').minLength = mode === 'signup' ? 8 : 1;
  document.getElementById('auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  document.getElementById('auth-title').textContent = mode === 'verify' ? '명지대 학교 메일 인증' : mode === 'signup' ? '회원가입' : '로그인';
  document.getElementById('auth-submit').textContent = mode === 'signup' ? '가입하고 인증 코드 받기' : '로그인';
  document.getElementById('auth-mode-toggle').textContent = mode === 'signup' ? '이미 가입했나요? 로그인' : '처음 오셨나요? 회원가입';
  document.getElementById('auth-guide').textContent = mode === 'verify' ? '학교 메일로 받은 코드를 10분 안에 입력해주세요. 재발송은 60초에 한 번 가능합니다.' : '학교 계정으로 혼밥 기록을 모아보세요.';
  (mode === 'verify' ? document.getElementById('verify-code') : document.getElementById('auth-email')).focus();
}

function requireAccount() {
  if (!currentUser) { openAuth(); showToast('로그인하면 쓸 수 있어요.'); return false; }
  if (!currentUser.isVerified) { openAuth('verify'); showToast('학교 메일 인증 후 이용 가능'); return false; }
  return true;
}

document.getElementById('account-menu').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  closeAccountMenu(true);
  if (button.id === 'btn-login') openAuth();
  if (button.id === 'btn-signup') openAuth('signup');
  if (button.id === 'btn-verify') openAuth('verify');
  if (button.id === 'btn-mypage') busy(button, openMyPage);
  if (button.id === 'btn-logout') busy(button, async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearAccount(); showToast('로그아웃했어요.');
  });
});
document.getElementById('auth-mode-toggle').addEventListener('click', () => openAuth(authMode === 'login' ? 'signup' : 'login'));
authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (accountConfigured !== true) { updateAccountAvailability(); return; }
  busy(document.getElementById('auth-submit'), async () => {
    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value;
    const signup = authMode === 'signup';
    if (signup) {
      await apiRequest('/api/auth/signup', { method: 'POST', body: { email, password, nickname: document.getElementById('auth-nickname').value.trim() } });
    }
    // signup 응답은 계정 생성만 하므로 login으로 세션 쿠키를 먼저 받는다.
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: { email, password } });
    currentUser = data.user;
    document.getElementById('auth-password').value = '';
    renderAccountMenu();
    if (currentUser.isVerified) authModal.classList.add('hidden');
    else openAuth('verify');
    try { await refreshAccount(); } catch { /* 로그인 응답의 사용자 정보 유지 */ }
    showToast(signup ? '가입했어요! 학교 메일로 온 인증 코드를 입력해 주세요.' : '로그인했어요.');
  });
});
verifyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (accountConfigured !== true) { updateAccountAvailability(); return; }
  busy(document.getElementById('verify-submit'), async () => {
    await apiRequest('/api/auth/verify', { method: 'POST', body: { code: document.getElementById('verify-code').value.trim() } });
    if (currentUser) currentUser.isVerified = true;
    renderAccountMenu();
    verifyForm.reset(); authModal.classList.add('hidden');
    showToast('학교 메일 인증을 완료했어요.');
  });
});
document.getElementById('btn-resend-code').addEventListener('click', event => busy(event.currentTarget, async () => {
  const data = await apiRequest('/api/auth/verify/send', { method: 'POST' }); showToast(data.message);
}));

// DB 형식과 기존 카카오 형식은 이 경계에서만 맞춘다. 검색/지도 코드는 그대로 재사용한다.
function toMapPlace(place) {
  return { ...place, id: String(place.id ?? place.placeId), place_name: place.place_name ?? place.name,
    category_name: place.category_name ?? place.category, road_address_name: place.road_address_name ?? place.roadAddress,
    y: place.y ?? String(place.lat), x: place.x ?? String(place.lng), distance: place.distance ?? place.distanceMeters };
}
async function findAccountPlace(id) {
  const found = currentPlaces.find(p => String(p.id) === String(id)) || knownPlaces.get(String(id));
  if (found) return found;
  const data = await apiRequest(`/api/places/${encodeURIComponent(id)}`);
  const place = toMapPlace({ ...data.place, displaySolo: data.displaySolo, curation: data.curation });
  knownPlaces.set(place.id, place);
  return place;
}
async function fetchReviews(placeId) {
  const data = await apiRequest(`/api/places/${encodeURIComponent(placeId)}/reviews`);
  reviewCache.set(String(placeId), data.reviews);
  return data.reviews;
}
function fillReviewEditor(place, review = null) {
  targetReviewPlace = place;
  editingReviewId = review?.id || null;
  modalPlaceName.textContent = place.place_name;
  modalPlaceAddress.textContent = place.road_address_name || '';
  document.getElementById('review-textarea').value = review?.content || '';
  selectedReviewLevel = review?.soloLevel || 1;
  levelOptions.forEach(b => b.classList.toggle('active', Number(b.dataset.level) === selectedReviewLevel));
  btnSubmitReview.textContent = review ? '리뷰 수정하기' : '리뷰 등록하기';
  reviewsListModal.classList.add('hidden');
  mypageModal.classList.add('hidden');
  reviewModal.classList.remove('hidden');
  document.getElementById('review-textarea').focus();
}
async function openServerReview(placeId) {
  if (!requireAccount()) return;
  const userId = currentUser.id;
  try {
    const [place, reviews] = await Promise.all([findAccountPlace(placeId), fetchReviews(placeId)]);
    if (currentUser?.id !== userId) return;
    fillReviewEditor(place, reviews.find(r => r.userId === userId));
  } catch { /* 요청 오류는 토스트 표시 */ }
}

async function refreshPlaceAfterReview(placeId) {
  const [data] = await Promise.all([apiRequest(`/api/places/${encodeURIComponent(placeId)}`), fetchReviews(placeId)]);
  // 상세 API의 displaySolo는 place 바깥에 있다. 서버 결과를 카드/필터/정렬/지도에 반영한다.
  const updated = toMapPlace({ ...data.place, displaySolo: data.displaySolo, curation: data.curation });
  knownPlaces.set(String(placeId), updated);
  currentPlaces = currentPlaces.map(p => String(p.id) === String(placeId) ? { ...p, displaySolo: data.displaySolo, curation: data.curation } : p);
  renderFilteredPlaces(); updateMapMarkers();
  if (detailPlaceId === String(placeId)) renderPlaceDetail({ ...(currentPlaces.find(p => String(p.id) === String(placeId)) || {}), ...updated, distance: currentPlaces.find(p => String(p.id) === String(placeId))?.distance ?? updated.distance }, getPlaceReviews(placeId));
}
/* ── 식당 상세 화면 (피그마 '식당 상세 화면')
   RESTAURANT 이름·메타·레벨 → 혼밥 난이도 상자(캐릭터) → 가게 정보·지도 링크 → 학우 리뷰 → 아래 고정 버튼 */
let detailPlaceId = null;
let detailScrollY = 0;
function renderPlaceDetail(place, reviews) {
  const box = document.getElementById('place-detail');
  const info = getDynamicSoloIndex(place);
  const category = (place.category_name || '음식점').split('>').map(t => t.trim()).filter(Boolean).slice(1, 3).join(' · ') || '음식점';
  const count = info.userReviewCount || reviews.length;
  const meter = '<span class="sm-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
  const reviewHtml = reviews.length
    ? reviews.slice(0, 2).map(r => `<article class="detail-review lv-${r.soloLevel}"><div class="detail-review-head"><strong>${escapeHtml(r.user?.nickname || '학우')}</strong><span class="detail-review-lv">Lv.${r.soloLevel} ${meter}</span></div><p>${escapeHtml(r.content)}</p></article>`).join('')
    : '<p class="detail-empty">아직 학우 리뷰가 없어요. 첫 리뷰를 남겨 주세요.</p>';
  box.innerHTML = `
    <div class="detail-top">
      <button type="button" class="detail-back sm-button sm-button--icon sm-button--ghost" aria-label="뒤로 가기">←</button>
      <button type="button" class="btn-heart-fav ${isPlaceFavorite(place.id) ? 'active' : ''} sm-button sm-button--icon sm-button--ghost" aria-label="찜하기" aria-pressed="${isPlaceFavorite(place.id)}" onclick="handleToggleFav('${place.id}', event)">${soloIcon('heart')}</button>
    </div>
    <header class="detail-head ${info.pillClass}">
      <p class="section-eyebrow">RESTAURANT</p>
      <h1 class="detail-name">${escapeHtml(place.place_name)}</h1>
      <p class="detail-meta">${escapeHtml(category)} · ${formatDistanceWalking(place.distance)}</p>
      <div class="card-level-row"><span class="solo-badge-chip sm-level-badge">${escapeHtml(info.label)}</span>${meter}<span class="level-score">${info.lv}/5</span></div>
      <p class="detail-tip">${escapeHtml(info.psychology)}</p>
    </header>
    <section class="detail-level ${info.pillClass}" aria-label="혼밥 난이도">
      <div class="detail-level-text">
        <p class="section-eyebrow">SOLO DINING LEVEL</p>
        <h2>${escapeHtml(info.label)}</h2>
        <p>${count ? `학우 리뷰 ${count}개 평균 Lv.${info.lv}` : '아직 학우 리뷰가 없어 기본 난이도예요'}</p>
        <div class="solo-tags">${info.tags.slice(0, 3).map(t => `<span class="solo-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <img class="detail-level-char" src="/levels/level-${info.lv}.webp" alt="" width="96" height="96">
    </section>
    <section class="detail-section" aria-labelledby="detail-info-title">
      <p class="section-eyebrow">INFO</p>
      <h2 id="detail-info-title">가게 정보</h2>
      <dl class="detail-info">
        <div><dt>주소</dt><dd>${escapeHtml(place.road_address_name || place.address_name || '주소 정보 없음')}</dd></div>
        ${place.phone ? `<div><dt>전화</dt><dd>${escapeHtml(place.phone)}</dd><a class="detail-call" href="tel:${escapeHtml(place.phone)}">전화 걸기</a></div>` : ''}
      </dl>
      <div class="detail-map-links">
        <a href="${escapeHtml(getKakaoMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="btn-map-link sm-button"><i class="map-dot kakao" aria-hidden="true"></i>카카오맵에서 보기</a>
        <a href="${escapeHtml(getNaverMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="btn-map-link sm-button"><i class="map-dot naver" aria-hidden="true"></i>네이버 지도에서 보기</a>
      </div>
    </section>
    <section class="detail-section" aria-labelledby="detail-review-title">
      <div class="detail-section-head">
        <div><p class="section-eyebrow">REVIEWS</p><h2 id="detail-review-title">학우 리뷰 ${count}</h2></div>
        ${count ? `<button type="button" class="detail-more sm-button sm-button--ghost" onclick="openReviewsList('${place.id}')">전체 보기 <span aria-hidden="true">›</span></button>` : ''}
      </div>
      ${reviewHtml}
    </section>
    <div class="detail-actions">
      <button type="button" class="btn-open-review sm-button" onclick="openReviewModalById('${place.id}')">${soloIcon('edit')} 리뷰 쓰기</button>
      <button type="button" class="btn-checkin sm-button" onclick="checkInById('${place.id}', this)">${soloIcon('check')} 다녀왔어요</button>
    </div>`;
  box.querySelector('.detail-back').addEventListener('click', leavePlaceDetail);
}
// 상세 화면 나가기: 앱 안에서 연 상세는 뒤로 가기, 주소로 바로 연 상세는 검색 결과나 홈으로
function leavePlaceDetail() {
  if (history.state?.place) { history.back(); return; }
  closePlaceDetail();
  // 밑에 검색 결과가 열려 있으면 그 주소로, 아니면 홈 주소로
  const q = document.body.classList.contains('results-open') && searchInput.value;
  history.replaceState(null, '', q ? `?q=${encodeURIComponent(q)}` : location.pathname);
}
// 불러오는 중·실패 화면에도 뒤로 가기 버튼을 남긴다(잘못된 ?place= 주소로 들어와도 빠져나갈 수 있게)
function renderDetailMessage(box, message) {
  box.innerHTML = `<div class="detail-top"><button type="button" class="detail-back sm-button sm-button--icon sm-button--ghost" aria-label="뒤로 가기">←</button></div><p class="detail-empty">${message}</p>`;
  box.querySelector('.detail-back').addEventListener('click', leavePlaceDetail);
}
async function openPlaceDetail(placeId, push = true) {
  placeId = String(placeId);
  if (!document.body.classList.contains('detail-open')) detailScrollY = window.scrollY;
  detailPlaceId = placeId;
  const box = document.getElementById('place-detail');
  renderDetailMessage(box, '식당 정보를 불러오는 중...');
  document.body.classList.add('detail-open');
  if (push) {
    const replace = history.state?.roulette; // 오늘 뭐 먹지 창에서 왔으면 창 기록을 상세로 바꾼다
    // 홈에서 연 상세(랜덤 뽑기 등)는 검색어를 주소에 남기지 않는다
    const q = document.body.classList.contains('results-open') ? searchInput.value : '';
    history[replace ? 'replaceState' : 'pushState']({ place: placeId, q }, '', `?${q ? `q=${encodeURIComponent(q)}&` : ''}place=${encodeURIComponent(placeId)}`);
  }
  window.scrollTo(0, 0);
  try {
    const [place, reviews] = await Promise.all([findAccountPlace(placeId), fetchReviews(placeId).catch(() => [])]);
    if (detailPlaceId === placeId) renderPlaceDetail(place, reviews);
  } catch {
    if (detailPlaceId === placeId) renderDetailMessage(box, '식당 정보를 불러오지 못했어요.');
  }
}
function closePlaceDetail() {
  detailPlaceId = null;
  document.body.classList.remove('detail-open');
  window.scrollTo(0, detailScrollY);
}
window.openPlaceDetail = openPlaceDetail;
window.closePlaceDetail = closePlaceDetail;

btnSubmitReview.addEventListener('click', () => busy(btnSubmitReview, async () => {
  if (!targetReviewPlace || !requireAccount()) return;
  const content = document.getElementById('review-textarea').value.trim();
  if (!content || content.length > 500) { showToast('리뷰는 1~500자로 써 주세요.'); return; }
  const place = targetReviewPlace;
  try {
    await apiRequest(editingReviewId ? `/api/reviews/${encodeURIComponent(editingReviewId)}` : '/api/reviews', {
      method: editingReviewId ? 'PATCH' : 'POST', body: { placeId: place.id, placeName: place.place_name, soloLevel: selectedReviewLevel, content },
    });
  } catch (error) {
    if (error.status === 409 && error.reviewId) {
      const reviews = await fetchReviews(place.id);
      const existing = reviews.find(r => r.id === error.reviewId && r.userId === currentUser?.id);
      if (existing) { fillReviewEditor(place, existing); showToast('이미 쓴 리뷰가 있어요. 수정해 주세요.'); }
    }
    return;
  }
  reviewModal.classList.add('hidden');
  showToast('리뷰를 저장했어요.');
  await refreshPlaceAfterReview(place.id);
}));

function renderReviewList(reviews) {
  document.getElementById('reviews-list-container').innerHTML = reviews.length ? reviews.map(review => `
    <article class="account-review" data-review-id="${escapeHtml(review.id)}">
      <div class="account-row"><strong>${escapeHtml(review.user?.nickname || '학우')} ${review.user?.isVerified ? '<span class="verified-chip">명지대생 인증</span>' : ''}</strong><span>Lv.${review.soloLevel}</span></div>
      <p>${escapeHtml(review.content)}</p><small>${escapeHtml(new Date(review.createdAt).toLocaleDateString('ko-KR'))}</small>
      ${review.userId === currentUser?.id ? '<div class="account-card-actions"><button data-action="edit" type="button" class="sm-button ">수정</button><button data-action="delete" type="button" class="sm-button sm-button--danger">삭제</button></div>' : ''}
    </article>`).join('') : '<p class="account-empty">아직 리뷰가 없습니다. 첫 혼밥 팁을 남겨보세요.</p>';
}
async function openReviewsList(placeId) {
  const version = ++reviewListVersion;
  activeReviewListPlace = String(placeId);
  document.getElementById('reviews-list-container').textContent = '리뷰를 불러오는 중...';
  document.getElementById('reviews-list-place-name').textContent = '식당 리뷰';
  reviewsListModal.classList.remove('hidden');
  try {
    const [place, reviews] = await Promise.all([findAccountPlace(placeId), fetchReviews(placeId)]);
    if (version !== reviewListVersion) return;
    document.getElementById('reviews-list-place-name').textContent = place.place_name;
    document.getElementById('reviews-list-place-addr').textContent = place.road_address_name || '';
    renderReviewList(reviews);
  } catch { if (version === reviewListVersion) document.getElementById('reviews-list-container').textContent = '리뷰를 불러오지 못했습니다. 다시 열어주세요.'; }
}
document.getElementById('reviews-list-close').addEventListener('click', () => { reviewListVersion++; reviewsListModal.classList.add('hidden'); });
document.getElementById('btn-write-review-shortcut').addEventListener('click', () => openServerReview(activeReviewListPlace));
document.getElementById('reviews-list-container').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const review = getPlaceReviews(activeReviewListPlace).find(r => r.id === button.closest('[data-review-id]').dataset.reviewId);
  if (!review || review.userId !== currentUser?.id) return;
  if (button.dataset.action === 'edit') busy(button, async () => fillReviewEditor(await findAccountPlace(activeReviewListPlace), review));
  // 지운 리뷰는 되살릴 수 없어서, 폰에서 잘못 눌러도 바로 지워지지 않게 한 번 묻는다
  else if (confirm('이 리뷰를 삭제할까요? 삭제하면 되돌릴 수 없어요.')) busy(button, async () => {
    const placeId = activeReviewListPlace;
    await apiRequest(`/api/reviews/${encodeURIComponent(review.id)}`, { method: 'DELETE' });
    showToast('리뷰를 삭제했어요.');
    await refreshPlaceAfterReview(placeId);
    if (activeReviewListPlace === placeId) renderReviewList(getPlaceReviews(placeId));
  });
});

async function checkInById(placeId, button) {
  if (!requireAccount()) return;
  await busy(button, async () => {
    const userId = currentUser.id;
    const previousLevel = currentUser.level || 1;
    const placeName = (currentPlaces.find(p => p.id === placeId) || knownPlaces.get(placeId))?.place_name;
    const data = await apiRequest(`/api/places/${encodeURIComponent(placeId)}/checkins`, { method: 'POST', body: { placeName } });
    if (currentUser?.id !== userId) return;
    Object.assign(currentUser, data.levelInfo); renderAccountMenu();
    showToast(data.levelInfo.level > previousLevel ? `체크인 완료! ${plainTitle(data.levelInfo.title)}(으)로 레벨업했어요` : '체크인 완료! 혼밥 경험치를 얻었어요.');
    await loadPersonalPlaces(); updateMapMarkers();
  });
}
async function loadPersonalPlaces() {
  const version = profileVersion;
  const [visits, suggestions] = await Promise.all([apiRequest('/api/users/me/checkins'), apiRequest('/api/users/me/recommendations')]);
  if (!currentUser || version !== profileVersion) return;
  conqueredPlaces = visits.conqueredPlaces.map(toMapPlace);
  recommendedPlaces = suggestions.recommendations.map(toMapPlace);
  [...conqueredPlaces, ...recommendedPlaces].forEach(p => knownPlaces.set(p.id, p));
}
// 나의 혼밥 기록도 상세 화면처럼 주소(?my=1)가 바뀌는 화면 이동. 뒤로 가기로 닫힌다.
async function openMyPage(push = true) {
  if (!currentUser) { openAuth(); return; }
  if (push && !history.state?.my) {
    const params = new URLSearchParams(location.search); params.delete('place'); params.set('my', '1');
    history.pushState({ my: true, q: params.get('q') }, '', `?${params}`);
  }
  window.scrollTo(0, 0);
  const version = profileVersion;
  const content = document.getElementById('mypage-content');
  content.textContent = '혼밥 기록을 불러오는 중...'; mypageModal.classList.remove('hidden');
  try {
    const [level, mine] = await Promise.all([apiRequest('/api/users/me/level'), apiRequest('/api/users/me/reviews'), loadPersonalPlaces()]);
    if (!currentUser || version !== profileVersion) return;
    const info = level.levelInfo;
    Object.assign(currentUser, info); renderAccountMenu();
    const lv = Math.min(5, Math.max(1, Number(info.level) || 1));
    const name = plainTitle(info.title);
    const left = info.nextLevelExp === null ? null : info.nextLevelExp - info.exp;
    content.innerHTML = `
      <section class="record-hero lv-${lv}">
        <div class="record-hero-text">
          <p class="section-eyebrow">MY SOLO LEVEL</p>
          <p class="record-lv">LV. 0${lv}</p>
          <h3 class="record-name">${escapeHtml(name)}</h3>
          <div class="record-progress"><progress max="100" value="${info.progressPercent}" aria-label="다음 레벨 진행률" class="sm-progress"></progress><strong>${info.exp}${info.nextLevelExp === null ? '' : ` / ${info.nextLevelExp}`}점</strong></div>
          <p class="record-next">${left === null ? '최고 레벨이에요! 혼밥 끝판왕' : `다음 레벨 '${RECORD_TIERS[lv].name}'까지 ${left}점 남았어요`}</p>
          ${info.level === 4 ? '<p class="record-next">끝판왕은 50점 이상 + Lv.5 식당 1곳 이상 방문해야 해요.</p>' : ''}
        </div>
        <img class="record-hero-char" src="/levels/level-${lv}.webp" alt="" width="110" height="110">
      </section>
      ${currentUser.isVerified ? '' : '<button type="button" data-profile-action="verify" class="sm-button record-verify">학교 메일 인증하기</button>'}
      <div class="record-stats">
        <div><strong>${info.conqueredPlaceCount}곳</strong><span>정복한 식당</span></div>
        <div><strong>${info.visitCount}회</strong><span>다녀왔어요</span></div>
        <div><strong>${mine.reviews.length}개</strong><span>내가 쓴 리뷰</span></div>
      </div>
      <section class="record-section"><p class="section-eyebrow">LEVEL ROAD</p><h3>혼밥 레벨 지도</h3>
        <ol class="record-road">${RECORD_TIERS.map((t, i) => `<li class="${i + 1 === lv ? 'is-current' : i + 1 < lv ? 'is-done' : ''} lv-${i + 1}"><span class="record-disc"><img src="/levels/level-${i + 1}.webp" alt="" width="48" height="48"></span><span>${t.min}점</span><span class="sm-sr-only">${t.name}</span></li>`).join('')}</ol>
      </section>
      <section class="record-section"><p class="section-eyebrow">CONQUERED</p><h3>내가 정복한 식당</h3>${recordPlaceList(conqueredPlaces, true)}</section>
      <section class="record-section"><p class="section-eyebrow">NEXT CHALLENGE</p><h3>다음 도전 추천</h3><p class="record-sub">내 레벨에 맞는 추천 식당이에요</p>${recordPlaceList(recommendedPlaces, false)}</section>
      <button type="button" class="record-map-btn sm-button" data-profile-action="map">정복·추천 지도 보기</button>
      <section class="record-section"><p class="section-eyebrow">MY REVIEWS</p><h3>내가 쓴 리뷰 ${mine.reviews.length}</h3>
        ${mine.reviews.length ? mine.reviews.map(r => `<article class="record-review lv-${r.soloLevel}"><div class="record-review-head"><strong>${escapeHtml(r.place.name)}</strong><span>Lv.${r.soloLevel} <span class="sm-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></span></div><p>${escapeHtml(r.content)}</p><button type="button" data-profile-action="review" data-place-id="${escapeHtml(r.placeId)}" class="record-edit sm-button sm-button--ghost">수정 · 삭제</button></article>`).join('') : '<p class="account-empty">아직 작성한 리뷰가 없어요. 다녀온 식당에 첫 리뷰를 남겨 보세요.</p>'}
      </section>`;
    updateMapMarkers();
  } catch { if (version === profileVersion) content.textContent = '기록을 불러오지 못했어요. 다시 열어 주세요.'; }
}
// 사용자 레벨 칭호와 시작 점수 (src/services/level.service.ts의 단계와 같다)
const RECORD_TIERS = [{ name: '혼밥 입문자', min: 0 }, { name: '혼밥 새내기', min: 5 }, { name: '혼밥 숙련자', min: 15 }, { name: '혼밥 고수', min: 30 }, { name: '혼밥 끝판왕', min: 50 }];
function recordPlaceList(places, visited) {
  if (!places.length) return `<p class="account-empty">${visited ? '다녀왔어요 버튼으로 첫 방문을 기록해 보세요.' : '지금 추천할 식당이 없어요.'}</p>`;
  return places.map(p => {
    const lv = p.displaySolo?.level || 1;
    const meta = visited ? `${escapeHtml(String(p.lastVisitDate || '').slice(5).replace('-', '.'))} · ${p.visitCount}회` : (p.distance != null ? formatDistanceWalking(p.distance) : '');
    return `<button type="button" class="record-place lv-${lv}" data-profile-action="place" data-place-id="${escapeHtml(p.id)}">
      <span class="record-food"><img src="/food/${retroFoodKey(p.category_name, p.place_name)}.webp" alt="" width="38" height="38"></span>
      <span class="record-place-text"><strong>${escapeHtml(p.place_name)}</strong><span><span class="sm-level-badge">${escapeHtml(String(p.displaySolo?.label || `Lv.${lv}`).replace(' (학우평가)', ''))}</span> ${meta}</span></span>
      <span class="record-go" aria-hidden="true">${visited ? '›' : '보기'}</span></button>`;
  }).join('');
}
function personalPlaceList(places, visited) {
  return places.length ? places.map(p => `<div class="personal-place"><strong>${escapeHtml(p.place_name)}</strong><span>${escapeHtml(p.displaySolo?.label || '')}</span>
    ${visited ? `<small>${escapeHtml(p.lastVisitDate)} · ${p.visitCount}회 방문</small>` : ''}
    <button type="button" data-profile-action="place" data-place-id="${escapeHtml(p.id)}" class="sm-button ">식당·리뷰 보기</button></div>`).join('') : `<p class="account-empty">${visited ? '다녀왔어요 버튼으로 첫 방문을 기록해보세요.' : '지금 추천할 식당이 없습니다.'}</p>`;
}
document.getElementById('mypage-content').addEventListener('click', event => {
  const button = event.target.closest('[data-profile-action]'); if (!button) return;
  const action = button.dataset.profileAction;
  if (action === 'verify') openAuth('verify');
  if (action === 'map') {
    const params = new URLSearchParams(location.search); params.delete('my');
    history.replaceState({ q: params.get('q') }, '', params.toString() ? `?${params}` : location.pathname);
    personalMapMode = true;
    mypageModal.classList.add('hidden');
    document.getElementById('personal-map-note').classList.remove('hidden');
    // 지도는 검색 결과 화면 안에 있다. 홈에서 열었으면 결과 화면부터 연다
    if (!document.body.classList.contains('results-open')) showResults(searchInput.value || '혼밥');
    switchViewMode('map'); updateMapMarkers();
    document.getElementById('personal-map-note').scrollIntoView({ block: 'start' });
  }
  if (action === 'place') { mypageModal.classList.add('hidden'); openPlaceDetail(button.dataset.placeId); }
  if (action === 'review') {
    mypageModal.classList.add('hidden');
    openReviewsList(button.dataset.placeId);
  }
});

// 개인 지도는 현재 검색 필터와 독립적으로 전체 정복/추천 위치를 보여준다.
function getMapPlaces() {
  return personalMapMode ? [...conqueredPlaces, ...recommendedPlaces] : getFilteredList();
}
function personalMarkerLabel(placeId) {
  if (conqueredPlaces.some(p => p.id === String(placeId))) return { icon: '✓', className: 'marker-conquered' };
  if (recommendedPlaces.some(p => p.id === String(placeId))) return { icon: '★', className: 'marker-recommended' };
  return { icon: null, className: '' };
}

// 기록 화면은 주소(?my=1)로 연 화면이라 닫기·Esc 모두 뒤로 가기로 닫는다(주소에 my가 남지 않게)
function closeMyPage() {
  if (history.state?.my) history.back();
  else mypageModal.classList.add('hidden');
}
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.close === 'mypage-modal') { closeMyPage(); return; }
  document.getElementById(button.dataset.close).classList.add('hidden');
}));
[authModal, mypageModal, reviewsListModal, growthGuideModal].forEach(modal => modal.addEventListener('click', event => {
  if (event.target !== modal) return;
  if (modal === mypageModal) closeMyPage(); else modal.classList.add('hidden');
}));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  // 위에 뜬 창부터 닫고, 창이 없으면 기록 화면 → 식당 상세 순서로 한 단계 뒤로
  const popups = [authModal, reviewsListModal, reviewModal, growthGuideModal].filter(modal => !modal.classList.contains('hidden'));
  if (popups.length) { popups.forEach(modal => modal.classList.add('hidden')); return; }
  if (!mypageModal.classList.contains('hidden')) { closeMyPage(); return; }
  if (document.body.classList.contains('detail-open')) leavePlaceDetail();
});
document.getElementById('btn-growth-guide').addEventListener('click', () => growthGuideModal.classList.remove('hidden'));
document.querySelectorAll('#solo-journey, #growth-guide-modal').forEach(section => section.addEventListener('click', event => {
  const button = event.target.closest('[data-journey-action]');
  if (!button) return;
  growthGuideModal.classList.add('hidden');
  if (!currentUser) openAuth('signup');
  else if (!currentUser.isVerified) openAuth('verify');
  else busy(button, openMyPage);
}));
document.getElementById('btn-exit-personal-map').addEventListener('click', () => {
  personalMapMode = false; document.getElementById('personal-map-note').classList.add('hidden'); updateMapMarkers();
});
renderAccountMenu();
apiRequest('/api/config', { quiet: true }).then(config => {
  accountConfigured = config.accountConfigured === true;
  updateAccountAvailability();
}).catch(() => { accountConfigured = false; updateAccountAvailability(); });
refreshAccount()
  .catch(error => { if (error.status !== 401) showToast('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.'); })
  // ?my=1 주소로 바로 들어오거나 새로고침해도 나의 혼밥 기록을 연다(로그인 확인 뒤)
  .then(() => {
    const params = new URLSearchParams(location.search);
    if (!params.get('my')) return;
    params.delete('my');
    // my 없는 기록을 밑에 하나 깔아 두면 닫기·뒤로 가기가 사이트 안에서 끝나고 주소에 my가 남지 않는다
    history.replaceState({ q: params.get('q') }, '', params.toString() ? `?${params}` : location.pathname);
    if (currentUser) openMyPage();
    else openAuth('login'); // 로그인 안 했으면 로그인 창으로 안내
  });
