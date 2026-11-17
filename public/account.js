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
          <button id="btn-mypage" type="button" class="sm-button sm-button--ghost">${soloIcon('grow')} 내 성장 기록</button><button id="btn-logout" type="button" class="sm-button sm-button--ghost">로그아웃</button>
        </div>
      </details>`
    : '<button id="btn-login" type="button" class="sm-button sm-button--ghost">로그인</button><button id="btn-signup" class="account-primary sm-button" type="button">회원가입</button>';
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

function renderJourney() {
  const status = document.getElementById('journey-status');
  if (!currentUser) {
    status.innerHTML = `<p class="journey-description">학교 인증 리뷰를 나누고, 체크인으로 혼밥 기록을 쌓아보세요.</p>
      <button type="button" class="journey-start-button sm-button sm-button--ghost" data-journey-action="start">학교 계정으로 시작하기 <span aria-hidden="true">→</span></button>`;
    return;
  }
  const hasProgress = typeof currentUser.exp === 'number';
  status.innerHTML = `<span class="journey-level-title">${escapeHtml(currentUser.title || `Lv.${currentUser.level || 1} 혼밥 여정`)}</span>
    ${hasProgress ? `<span class="journey-progress"><progress max="100" value="${currentUser.progressPercent}" aria-label="내 혼밥 레벨 진행률" class="sm-progress"></progress><span>${currentUser.exp}점</span></span>
      <span class="journey-caption">${currentUser.conqueredPlaceCount}곳 정복 · ${currentUser.visitCount}회 방문</span>` : '<span class="journey-caption">성장 기록을 불러오는 중...</span>'}
    <button type="button" class="journey-start-button sm-button sm-button--ghost" data-journey-action="profile">${currentUser.isVerified ? '내 성장 기록 보기' : '학교 메일 인증하기'} <span aria-hidden="true">→</span></button>`;
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
  if (!currentUser) { openAuth(); showToast('로그인 후 이용해주세요.'); return false; }
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
    clearAccount(); showToast('로그아웃되었습니다.');
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
    showToast(signup ? '가입 완료! 학교 메일의 인증 코드를 확인해주세요.' : '로그인되었습니다.');
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
    showToast('🎓 학교 메일 인증이 완료되었습니다.');
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
}
btnSubmitReview.addEventListener('click', () => busy(btnSubmitReview, async () => {
  if (!targetReviewPlace || !requireAccount()) return;
  const content = document.getElementById('review-textarea').value.trim();
  if (!content || content.length > 500) { showToast('리뷰는 1~500자로 작성해주세요.'); return; }
  const place = targetReviewPlace;
  try {
    await apiRequest(editingReviewId ? `/api/reviews/${encodeURIComponent(editingReviewId)}` : '/api/reviews', {
      method: editingReviewId ? 'PATCH' : 'POST', body: { placeId: place.id, soloLevel: selectedReviewLevel, content },
    });
  } catch (error) {
    if (error.status === 409 && error.reviewId) {
      const reviews = await fetchReviews(place.id);
      const existing = reviews.find(r => r.id === error.reviewId && r.userId === currentUser?.id);
      if (existing) { fillReviewEditor(place, existing); showToast('이미 작성한 리뷰를 수정해주세요.'); }
    }
    return;
  }
  reviewModal.classList.add('hidden');
  showToast('리뷰가 저장되었습니다.');
  await refreshPlaceAfterReview(place.id);
}));

function renderReviewList(reviews) {
  document.getElementById('reviews-list-container').innerHTML = reviews.length ? reviews.map(review => `
    <article class="account-review" data-review-id="${escapeHtml(review.id)}">
      <div class="account-row"><strong>${escapeHtml(review.user?.nickname || '학우')} ${review.user?.isVerified ? '🎓 명지대생 인증' : ''}</strong><span>Lv.${review.soloLevel}</span></div>
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
  else busy(button, async () => {
    const placeId = activeReviewListPlace;
    await apiRequest(`/api/reviews/${encodeURIComponent(review.id)}`, { method: 'DELETE' });
    showToast('리뷰가 삭제되었습니다.');
    await refreshPlaceAfterReview(placeId);
    if (activeReviewListPlace === placeId) renderReviewList(getPlaceReviews(placeId));
  });
});

async function checkInById(placeId, button) {
  if (!requireAccount()) return;
  await busy(button, async () => {
    const userId = currentUser.id;
    const previousLevel = currentUser.level || 1;
    const data = await apiRequest(`/api/places/${encodeURIComponent(placeId)}/checkins`, { method: 'POST' });
    if (currentUser?.id !== userId) return;
    Object.assign(currentUser, data.levelInfo); renderAccountMenu();
    showToast(data.levelInfo.level > previousLevel ? `체크인 완료! ${data.levelInfo.title} 레벨업 🎉` : '체크인 완료! 혼밥 경험치를 얻었어요.');
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
async function openMyPage() {
  if (!currentUser) { openAuth(); return; }
  const version = profileVersion;
  const content = document.getElementById('mypage-content');
  content.textContent = '성장 기록을 불러오는 중...'; mypageModal.classList.remove('hidden');
  try {
    const [level, mine] = await Promise.all([apiRequest('/api/users/me/level'), apiRequest('/api/users/me/reviews'), loadPersonalPlaces()]);
    if (!currentUser || version !== profileVersion) return;
    const info = level.levelInfo;
    Object.assign(currentUser, info); renderAccountMenu();
    content.innerHTML = `<section class="growth-card"><h3>${escapeHtml(info.title)}</h3><p>경험치 ${info.exp}점 · ${info.nextLevelExp === null ? '최고 레벨 달성!' : `다음 레벨 ${info.nextLevelExp}점`}</p>
      <progress max="100" value="${info.progressPercent}" aria-label="다음 레벨 진행률" class="sm-progress"></progress><p>${info.progressPercent}% · ${info.conqueredPlaceCount}곳 정복 · ${info.visitCount}회 방문</p>
      ${info.level === 4 ? '<small>끝판왕은 50점 이상 + Lv.5 식당 1곳 이상 방문해야 해요.</small>' : ''}
      ${currentUser.isVerified ? '' : '<button type="button" data-profile-action="verify" class="sm-button ">🎓 학교 메일 인증하기</button>'}</section>
      <h3>✅ 내가 정복한 식당</h3>${personalPlaceList(conqueredPlaces, true)}
      <h3>🌟 다음 도전 추천</h3>${personalPlaceList(recommendedPlaces, false)}
      <button type="button" class="btn-submit sm-button sm-button--primary" data-profile-action="map">🗺️ 정복·추천 지도 보기</button>
      <h3>✏️ 내가 쓴 리뷰</h3>${mine.reviews.length ? mine.reviews.map(r => `<article class="account-review"><strong>${escapeHtml(r.place.name)}</strong><p>${escapeHtml(r.content)}</p><button type="button" data-profile-action="review" data-place-id="${escapeHtml(r.placeId)}" class="sm-button ">내 리뷰 수정·삭제</button></article>`).join('') : '<p class="account-empty">아직 작성한 리뷰가 없습니다.</p>'}`;
    updateMapMarkers();
  } catch { if (version === profileVersion) content.textContent = '기록을 불러오지 못했습니다. 다시 열어주세요.'; }
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
    personalMapMode = true;
    mypageModal.classList.add('hidden');
    document.getElementById('personal-map-note').classList.remove('hidden');
    switchViewMode('map'); updateMapMarkers();
  }
  if (action === 'place' || action === 'review') {
    mypageModal.classList.add('hidden');
    openReviewsList(button.dataset.placeId);
  }
});

// 개인 지도는 현재 검색 필터와 독립적으로 전체 정복/추천 위치를 보여준다.
function getMapPlaces() {
  return personalMapMode ? [...conqueredPlaces, ...recommendedPlaces] : getFilteredList();
}
function personalMarkerLabel(placeId) {
  if (conqueredPlaces.some(p => p.id === String(placeId))) return { icon: '✅', className: 'marker-conquered' };
  if (recommendedPlaces.some(p => p.id === String(placeId))) return { icon: '★', className: 'marker-recommended' };
  return { icon: null, className: '' };
}

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).classList.add('hidden')));
[authModal, mypageModal, reviewsListModal, growthGuideModal].forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') [authModal, mypageModal, reviewsListModal, reviewModal, growthGuideModal].forEach(modal => modal.classList.add('hidden'));
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
refreshAccount().catch(error => { if (error.status !== 401) showToast('로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.'); });
