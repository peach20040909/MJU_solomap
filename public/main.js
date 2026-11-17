/**
 * solo-map 프론트엔드 핵심 로직
 * 1. 카카오 로컬 실시간 API 연동 & 현실 반영 혼밥 난이도(Lv.1~Lv.5) 계산
 * 2. 🎲 "오늘 뭐 먹지?" 랜덤 혼밥 추천 룰렛
 * 3. ❤️ "내가 찜한 식당" 즐겨찾기 (localStorage)
 * 4. ${soloIcon('chat')} 학교 인증 리뷰 API 연동 (계정 기능은 account.js)
 * 5. 🗺️ 카드 목록 ↔ Leaflet 인터랙티브 지도 뷰 토글
 */

// 음식 카테고리별 고품질 썸네일 이미지 매핑 (Unsplash Curated & 100% 정상 로드 검증)
// 카테고리 & 세부 메뉴별 3D 감성 이모지 및 테마 컬러 매핑 (모던 클린 카드 UI)
function getNaverMapUrl(place) {
  if (!place) return 'https://map.naver.com';

  const name = (place.place_name || '').trim();

  // 1. 카카오 등록명 ↔ 네이버 공식 상호명 불일치 식당 1:1 정밀 매핑
  const NAVER_NAME_MAPPINGS = {
    '마라왕 명지점': '마라왕마라탕',
    '마라왕': '마라왕마라탕',
    '생선구이와돈까스 2호점': '생선구이와돈까스',
    '육초연 명지대점': '육초연',
  };

  if (NAVER_NAME_MAPPINGS[name]) {
    return `https://map.naver.com/p/search/${encodeURIComponent(NAVER_NAME_MAPPINGS[name])}`;
  }

  // 2. 가맹점 번호 접미사('2호점', '1호점') 제거하여 네이버 지도 매칭 보장
  let cleanName = name.replace(/\s*(2호점|1호점)\s*$/, '').trim();

  return `https://map.naver.com/p/search/${encodeURIComponent(cleanName)}`;
}

// 카카오맵 안전한 SSL(HTTPS) 직접 연결 링크 생성
function getKakaoMapUrl(place) {
  if (!place) return 'https://map.kakao.com';
  if (place.place_url) {
    return place.place_url.replace(/^http:\/\//, 'https://');
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(place.place_name || '')}`;
}

// 현실 식당 및 메뉴 특성을 정밀 반영한 대중적 혼밥 난이도 5단계 알고리즘
function evaluateSoloIndex(category = '', name = '') {
  const text = `${category} ${name}`.toLowerCase();

  // 🐟 생선구이, 생선구이백반, 돈까스는 고기 불판구이가 아닌 1인 정식 혼밥 성지(Lv.2)
  if (text.includes('생선') || text.includes('생선구이') || (text.includes('돈까스') && text.includes('구이'))) {
    return {
      lv: 2,
      label: 'Lv.2 혼밥 성지',
      pillClass: 'lv-2',
      psychology: '노릇노릇 생선구이와 돈까스 1인 한상 · 편안하고 든든한 밥집 혼밥',
      tags: ['#생선구이백반', '#1인정식', '#수제돈까스', '#든든한한상', '#혼밥환영'],
    };
  }

  // Lv.5 혼밥 끝판왕 (불판 고기구이, 최소 2인 주문 필수, 시끌벅적 회식/술자리 분위기)
  if (
    text.includes('삼겹살') || text.includes('갈비') || text.includes('고깃집') ||
    (text.includes('구이') && !text.includes('생선')) || text.includes('곱창') || text.includes('막창') ||
    text.includes('대창') || text.includes('닭갈비') || text.includes('조개구이') ||
    text.includes('횟집') || text.includes('회센터') || text.includes('참치') ||
    text.includes('주점') || text.includes('술집') || text.includes('호프') ||
    text.includes('포차') || text.includes('이자카야') || text.includes('족발') ||
    text.includes('보쌈') || text.includes('정육식당')
  ) {
    return {
      lv: 5,
      label: 'Lv.5 혼밥 끝판왕',
      pillClass: 'lv-5',
      psychology: '불판 구이 & 술자리 회식 분위기 · 최고난도 혼밥 도전',
      tags: ['#최소2인주문', '#불판구이', '#술자리회식분위기', '#혼밥끝판왕', '#최고난도도전'],
    };
  }

  // Lv.4 다인석 식당 (떡볶이 냄비/대형세트, 샤브샤브, 파스타, 패밀리, 단체 냄비 요리)
  if (
    text.includes('떡볶이') || text.includes('엽기떡볶이') || text.includes('엽떡') ||
    text.includes('청년다방') || text.includes('두끼') || text.includes('신전') ||
    text.includes('샤브') || text.includes('뷔페') || text.includes('패밀리레스토랑') ||
    text.includes('피자') || text.includes('파스타') || text.includes('감자탕') ||
    text.includes('찜닭') || text.includes('닭볶음탕') || text.includes('부대찌개') ||
    text.includes('전골') || text.includes('아시안') || text.includes('스테이크')
  ) {
    return {
      lv: 4,
      label: 'Lv.4 다인석 식당',
      pillClass: 'lv-4',
      psychology: '2인 이상 냄비 or 데이트·모임 위주 · 혼밥 도전 코스',
      tags: ['#2인이상냄비', '#떡볶이전문점', '#데이트손님위주', '#혼밥도전코스', '#포장추천'],
    };
  }

  // Lv.1 입문 혼밥 (키오스크 주문, 1인석 대다수, 혼밥러 비율 압도적, 시선 신경 0%)
  if (
    text.includes('패스트푸드') || text.includes('햄버거') || text.includes('버거') ||
    text.includes('맥도날드') || text.includes('롯데리아') || text.includes('버거킹') ||
    text.includes('맘스터치') || text.includes('서브웨이') || text.includes('샌드위치') ||
    text.includes('토스트') || text.includes('이삭') || text.includes('김밥') ||
    text.includes('김밥천국') || text.includes('도시락') || text.includes('한솥') ||
    text.includes('컵밥') || text.includes('편의점') || text.includes('학식') ||
    text.includes('만두') || text.includes('바비든든')
  ) {
    return {
      lv: 1,
      label: 'Lv.1 입문 혼밥',
      pillClass: 'lv-1',
      psychology: '혼자 먹는 게 당연한 곳 · 키오스크 선불 & 시선 신경 0%',
      tags: ['#키오스크선불', '#1인석기본', '#시선신경0%', '#초스피드식사', '#혼밥입문'],
    };
  }

  // Lv.2 혼밥 성지 (국밥, 라멘, 1인 바 테이블 구비로 눈치 전혀 안 보는 곳)
  if (
    text.includes('국밥') || text.includes('순대국') || text.includes('순댓국') ||
    text.includes('돼지국밥') || text.includes('설렁탕') || text.includes('곰탕') ||
    text.includes('해장국') || text.includes('추어탕') || text.includes('도가니') ||
    text.includes('라멘') || text.includes('일식') || text.includes('우동') ||
    text.includes('소바') || text.includes('1인샤브') || text.includes('카레') ||
    text.includes('회전초밥') || text.includes('초밥') || text.includes('샐러드') ||
    text.includes('포케')
  ) {
    return {
      lv: 2,
      label: 'Lv.2 혼밥 성지',
      pillClass: 'lv-2',
      psychology: '한국인 공인 1등 혼밥 성지 & 1인 뚝배기/바 테이블 대환영',
      tags: ['#국밥부장관', '#1인뚝배기', '#바테이블완비', '#사장님환영', '#혼밥성지'],
    };
  }

  // Lv.3 일반 밥집 (백반, 찌개, 중국집, 돈까스 등 평범한 2인석 착석 식사)
  return {
    lv: 3,
    label: 'Lv.3 일반 밥집',
    pillClass: 'lv-3',
    psychology: '평범하고 든든한 식사 · 단 점심 피크시간(12시)엔 살짝 눈치',
    tags: ['#든든한한끼', '#2인테이블착석', '#피크시간눈치살짝', '#가정식백반', '#학생단골밥집'],
  };
}

// 도보 시간 환산 (분당 약 65m 기준)
function formatDistanceWalking(distanceMeter) {
  if (!distanceMeter) return '명지대 근처';
  const m = Number(distanceMeter);
  if (isNaN(m)) return '명지대 근처';
  const min = Math.max(1, Math.round(m / 65));
  return `도보 ${min}분 · ${m}m`;
}

// 🎯 순수 밥집(식사) 판별 헬퍼: 추천 대상에서 카페, 디저트, 베이커리, 음료 매장 전면 차단
function isMealRestaurant(place) {
  if (!place) return false;
  const name = (place.place_name || '').toLowerCase();
  const cat = (place.category_name || '').toLowerCase();
  const group = place.category_group_code || '';

  // 카카오 카테고리 CE7 (카페) 차단
  if (group === 'CE7') return false;

  // 본죽&비빔밥 등 식사 전문점은 든든한 식사이므로 예외 허용
  if (name.includes('본죽')) return true;

  const cafeKeywords = [
    '카페', '커피', 'cafe', 'coffee', '로스터리', 'roastery', '디저트', 'dessert',
    '베이커리', 'bakery', '베이크', '다방', '찻집', '티룸', 'tearoom',
    '빙수', '설빙', '공차', '버블티', '스무디', '탕후루', '요아정', '요거트', '아이스크림',
    '배스킨', '베스킨', '와플대학', '와플', '도넛', '던킨', '크리스피', '마카롱',
    '스타벅스', '투썸', '이디야', '메가커피', '컴포즈', '빽다방', '할리스', '탐앤탐스',
    '엔제리너스', '파스쿠찌', '폴바셋', '더벤티', '감성커피', '하삼동', '커피빈',
    '달콤커피', '매머드', '쥬씨', '생과일', '파리바게', '파리바게뜨', '뚜레쥬르'
  ];

  if (cafeKeywords.some((kw) => name.includes(kw) || cat.includes(kw))) {
    return false;
  }
  return true;
}

/* ===================================================
   로컬 스토리지 (찜 목록 & 리뷰 데이터 관리)
   =================================================== */
const STORAGE_KEYS = {
  FAVORITES: 'solo_map_favorites_v1',
};

function getFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleFavorite(placeId) {
  let favs = getFavorites();
  const exists = favs.includes(placeId);
  if (exists) {
    favs = favs.filter((id) => id !== placeId);
  } else {
    favs.push(placeId);
  }
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
  updateFavBadge();
  return !exists;
}

function isPlaceFavorite(placeId) {
  const favs = getFavorites();
  return favs.includes(placeId);
}

function updateFavBadge() {
  const count = getFavorites().length;
  const badge = document.getElementById('fav-badge-count');
  if (badge) badge.textContent = count;
}

// 서버에서 조회한 공개 리뷰만 잠시 보관한다. 찜과 달리 localStorage에 쓰지 않는다.
const reviewCache = new Map();
function getPlaceReviews(placeId) {
  return reviewCache.get(String(placeId)) || [];
}

// 식당별 고유 AI 큐레이션 및 사용자 리뷰 가중 평균 난이도 계산
function getDynamicSoloIndex(place) {
  const base = evaluateSoloIndex(place.category_name, place.place_name);
  const curation = place.curation;

  // 리뷰 평균은 서버 한 곳에서 계산한다. 브라우저는 받은 결과를 표시만 한다.
  const lv = place.displaySolo?.level ?? curation?.soloLevel ?? base.lv;
  const label = place.displaySolo?.label ?? curation?.levelLabel ?? base.label;
  let psychology = (curation && curation.psychology) ? curation.psychology : base.psychology;
  let tags = (curation && curation.tags && curation.tags.length > 0) ? curation.tags : base.tags;

  return {
    lv,
    label,
    pillClass: `lv-${lv}`,
    psychology,
    tags,
    userReviewCount: place.displaySolo?.reviewCount ?? 0,
    isAiCuration: !!curation,
  };
}

/* ===================================================
   전역 상태 변수 & DOM 요소 바인딩
   =================================================== */
let currentPlaces = [];
let currentFilter = 'all';
let currentSort = 'distance'; // 'distance' | 'level-asc' | 'level-desc' | 'reviews' | 'name'
let currentViewMode = 'list'; // 'list' | 'map'
let targetReviewPlace = null;
let leafletMap = null;
let mapMarkers = [];

// DOM 요소
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const placesContainer = document.getElementById('places-container');
const mapViewContainer = document.getElementById('map-view-container');
const catalogTitle = document.getElementById('catalog-title');
const catalogCount = document.getElementById('catalog-count');
const sortSelect = document.getElementById('sort-select');
const kwChips = document.querySelectorAll('.kw-chip');
const filterTabs = document.querySelectorAll('.tab-btn');
const btnViewList = document.getElementById('btn-view-list');
const btnViewMap = document.getElementById('btn-view-map');

// 룰렛 관련 요소
const btnRandomRoulette = document.getElementById('btn-random-roulette');
const rouletteModal = document.getElementById('roulette-modal');
const rouletteClose = document.getElementById('roulette-close');
const rouletteCardSlot = document.getElementById('roulette-card-slot');
const btnRouletteAgain = document.getElementById('btn-roulette-again');
const btnRouletteGo = document.getElementById('btn-roulette-go');
let currentWinningPlace = null;
let rouletteInterval = null;

// 리뷰 모달 요소
const reviewModal = document.getElementById('review-modal');
const modalClose = document.getElementById('modal-close');
const modalPlaceName = document.getElementById('modal-place-name');
const modalPlaceAddress = document.getElementById('modal-place-address');
const btnSubmitReview = document.getElementById('btn-submit-review');
const levelOptions = document.querySelectorAll('.level-opt');
let selectedReviewLevel = 1;

// 토스트 메시지
const toastMessage = document.getElementById('toast-message');
const toastText = document.getElementById('toast-text');
let toastTimer = null;

function showToast(message) {
  if (!toastMessage) return;
  toastText.textContent = message;
  toastMessage.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.classList.add('hidden');
  }, 2600);
}

/* ===================================================
   식당 검색 API 호출 및 렌더링
   =================================================== */
async function loadPlaces(keyword) {
  placesContainer.innerHTML = soloEmptyState('대학가 식당을 찾고 있어요', '명지대 · 명지전문대 · 백련시장 주변 식당을 탐색합니다.');
  catalogTitle.textContent = `"${keyword}" 검색 결과`;
  catalogCount.textContent = '검색 중...';

  try {
    const res = await fetch(`/api/places/search?query=${encodeURIComponent(keyword)}`, { credentials: 'same-origin' });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || '식당 정보를 불러오지 못했습니다.');
    }

    // 순수 밥집/식사 식당만 필터링 (카페/디저트/음료 전면 배제)
    currentPlaces = (data.places || []).filter(isMealRestaurant);
    renderFilteredPlaces();
    updateMapMarkers();
  } catch (err) {
    console.error(err);
    placesContainer.innerHTML = soloEmptyState('식당 정보를 가져올 수 없습니다', err.message, { variant: 'error' });
    catalogCount.textContent = '0곳';
  }
}

// ⚡ 다차원 정렬 헬퍼 함수 (거리순, 난이도 낮은순/높은순, 리뷰순, 이름순)
function sortPlacesList(list, sortBy = currentSort) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    const distA = Number(a.distance) || 999999;
    const distB = Number(b.distance) || 999999;

    if (sortBy === 'distance') {
      return distA - distB;
    }
    if (sortBy === 'level-asc') {
      const lvA = Number(getDynamicSoloIndex(a).lv) || 3;
      const lvB = Number(getDynamicSoloIndex(b).lv) || 3;
      if (lvA !== lvB) return lvA - lvB;
      return distA - distB;
    }
    if (sortBy === 'level-desc') {
      const lvA = Number(getDynamicSoloIndex(a).lv) || 3;
      const lvB = Number(getDynamicSoloIndex(b).lv) || 3;
      if (lvA !== lvB) return lvB - lvA;
      return distA - distB;
    }
    if (sortBy === 'reviews') {
      const revA = a.displaySolo?.reviewCount || 0;
      const revB = b.displaySolo?.reviewCount || 0;
      if (revA !== revB) return revB - revA;
      return distA - distB;
    }
    if (sortBy === 'name') {
      return (a.place_name || '').localeCompare(b.place_name || '', 'ko');
    }
    return 0;
  });
  return sorted;
}

// 필터링 및 다차원 정렬 통합 계산
function getFilteredList() {
  let list = [];
  if (currentFilter === 'fav') {
    const favs = getFavorites();
    list = currentPlaces.filter((p) => favs.includes(p.id));
  } else if (currentFilter === 'all') {
    list = currentPlaces;
  } else {
    const targetLv = Number(currentFilter);
    list = currentPlaces.filter((p) => {
      const info = getDynamicSoloIndex(p);
      return info.lv === targetLv;
    });
  }

  // ⚡ 선택된 정렬 기준(거리순, 난이도 낮은순/높은순, 리뷰순, 가나다순) 적용
  return sortPlacesList(list, currentSort);
}

function renderFilteredPlaces() {
  const filtered = getFilteredList();
  catalogCount.textContent = `${filtered.length}곳`;

  if (filtered.length === 0) {
    const emptyMsg = currentFilter === 'fav'
      ? '아직 찜한 식당이 없습니다! 식당 카드의 하트(❤️) 버튼을 눌러 나만의 혼밥 리스트를 만들어보세요.'
      : '해당 조건의 식당이 없습니다. 상단 필터를 변경하거나 다른 메뉴를 검색해 보세요.';

    placesContainer.innerHTML = soloEmptyState(currentFilter === 'fav' ? '찜한 식당이 비어있습니다' : '일치하는 식당이 없습니다', emptyMsg, { icon: currentFilter === 'fav' ? 'heart' : 'search' });
    return;
  }

  placesContainer.innerHTML = filtered.map((place) => createCardHtml(place)).join('');
}

// 식당명과 혼밥 정보를 먼저 읽고 필요한 작업을 선택하는 공통 카드.
function createCardHtml(place) {
  const soloInfo = getDynamicSoloIndex(place);
  const walkText = formatDistanceWalking(place.distance);
  const cleanAddr = place.road_address_name || place.address_name || '주소 정보 없음';
  const category = (place.category_name || '음식점').split('>').map(t => t.trim()).filter(Boolean).slice(1, 3).join(' · ') || '음식점';
  const reviews = getPlaceReviews(place.id);
  const reviewCount = place.displaySolo?.reviewCount || reviews.length;
  // 실제 가게 사진이 없으므로 카테고리 일러스트를 카드 이미지로 쓴다. 난이도와 찜은 이미지 위에 얹는다.
  const art = soloFoodArt(place.category_name, place.place_name);
  return `
    <article class="place-card-item clean-card sm-card ${soloInfo.pillClass}" id="place-card-${place.id}">
      <div class="card-media">
        <div class="card-media-art" aria-hidden="true">${art.svg}<span>${art.label}</span></div>
        <span class="solo-badge-chip sm-level-badge">${soloInfo.label}</span>
        <button type="button" class="btn-heart-fav ${isPlaceFavorite(place.id) ? 'active' : ''} sm-button sm-button--icon sm-button--ghost" aria-label="찜하기" aria-pressed="${isPlaceFavorite(place.id)}" title="찜하기" onclick="handleToggleFav('${place.id}', event)">${soloIcon('heart')}</button>
      </div>
      <div class="card-header-row">
        <div class="card-title-group">
          <h3 class="place-title">${escapeHtml(place.place_name)}</h3>
          <div class="card-cat-line"><span class="place-category" title="${escapeHtml(place.category_name || '')}">${escapeHtml(category)}</span><span class="distance-pill">${walkText}</span></div>
        </div>
        <span class="sm-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <p class="solo-psychology-text">${escapeHtml(soloInfo.psychology)}</p>
      <div class="solo-tags" aria-label="혼밥 특징">${soloInfo.tags.slice(0, 3).map(t => `<span class="solo-tag">${escapeHtml(t)}</span>`).join('')}</div>
      <ul class="place-meta-list">
        <li><span class="meta-icon">${soloIcon('pin')}</span><span>${escapeHtml(cleanAddr)}</span></li>
        ${place.phone ? `<li><span class="meta-icon">${soloIcon('phone')}</span><a href="tel:${escapeHtml(place.phone)}">${escapeHtml(place.phone)}</a></li>` : ''}
      </ul>
      <div class="card-review-box">
        <div class="review-box-header">
          <button type="button" class="btn-review-list sm-button sm-button--ghost" onclick="openReviewsList('${place.id}')">${soloIcon('chat')} 리뷰 ${reviewCount}개</button>
          <button type="button" class="btn-open-review sm-button sm-button--ghost" onclick="openReviewModalById('${place.id}')">리뷰 작성 ${soloIcon('edit')}</button>
        </div>
        ${reviews.length ? `<p class="review-box-text">${escapeHtml(reviews[0].content)}</p>` : ''}
      </div>
      <div class="card-footer-actions">
        <div class="map-links-group">
          <a href="${escapeHtml(getKakaoMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="btn-map-link sm-button sm-button--ghost" title="카카오맵에서 위치 및 길찾기 보기">카카오맵 ${soloIcon('external')}</a>
          <a href="${escapeHtml(getNaverMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="btn-map-link sm-button sm-button--ghost" title="네이버 지도에서 메뉴와 길찾기 보기">네이버 지도 ${soloIcon('external')}</a>
        </div>
        <button type="button" class="btn-checkin sm-button sm-button--brand" onclick="checkInById('${place.id}', this)">${soloIcon('check')} 다녀왔어요</button>
      </div>
    </article>`;
}

// 두 지도 엔진에서 같은 정보 위계와 버튼을 사용한다.
function createMapPopupHtml(place, soloInfo, walk) {
  return `<div class="map-popup-card clean-popup">
    <button type="button" class="popup-close-btn sm-button sm-button--icon sm-button--ghost" aria-label="식당 정보 닫기" title="닫기" onclick="closeCurrentInfoWindow()">${soloIcon('close')}</button>
    <div class="popup-title-box"><h3 class="popup-title">${escapeHtml(place.place_name)}</h3></div>
    <div class="popup-badges-row"><span class="difficulty-pill index-level ${soloInfo.pillClass}">${escapeHtml(soloInfo.label)}</span><span class="distance-pill">${walk}</span></div>
    <p class="popup-psychology">${escapeHtml(soloInfo.psychology)}</p>
    <p class="popup-meta">${soloIcon('pin')} <span>${escapeHtml(place.road_address_name || place.address_name || '주소 정보 없음')}</span></p>
    <div class="popup-footer-actions">
      <button type="button" class="popup-btn secondary sm-button sm-button--ghost" onclick="openReviewsList('${place.id}')">${soloIcon('chat')} 리뷰 보기</button>
      <button type="button" class="popup-btn secondary sm-button" onclick="checkInById('${place.id}', this)">${soloIcon('check')} 다녀왔어요</button>
      <a href="${escapeHtml(getKakaoMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="popup-btn map-link sm-button sm-button--ghost">카카오맵 ${soloIcon('external')}</a>
      <a href="${escapeHtml(getNaverMapUrl(place))}" target="_blank" rel="noopener noreferrer" class="popup-btn map-link sm-button sm-button--ghost">네이버 지도 ${soloIcon('external')}</a>
    </div>
  </div>`;
}

// 찜 토글 이벤트
window.handleToggleFav = function (placeId, event) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const isNowFav = toggleFavorite(placeId);

  btn.classList.toggle('active', isNowFav);
  btn.innerHTML = soloIcon('heart');
  btn.setAttribute('aria-pressed', String(isNowFav));
  btn.classList.add('anim-pop');
  setTimeout(() => btn.classList.remove('anim-pop'), 400);

  showToast(isNowFav ? '내 찜 목록에 추가되었습니다! ❤️' : '찜 목록에서 제외되었습니다.');

  if (currentFilter === 'fav') {
    renderFilteredPlaces();
  }
};

/* ===================================================
   🎲 기능 1: "오늘 뭐 먹지?" 랜덤 추천 룰렛
   =================================================== */
btnRandomRoulette.addEventListener('click', () => {
  openRouletteModal();
});

rouletteClose.addEventListener('click', () => {
  closeRouletteModal();
});

rouletteModal.addEventListener('click', (e) => {
  if (e.target === rouletteModal) closeRouletteModal();
});

btnRouletteAgain.addEventListener('click', () => {
  spinRoulette();
});

btnRouletteGo.addEventListener('click', () => {
  if (!currentWinningPlace) return;
  closeRouletteModal();

  // 목록 뷰로 전환 후 해당 카드로 부드럽게 스크롤
  switchViewMode('list');

  setTimeout(() => {
    const card = document.getElementById(`place-card-${currentWinningPlace.id}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.transition = 'box-shadow 0.4s ease, transform 0.4s ease';
      card.style.boxShadow = '0 0 0 4px #ff5226, 0 16px 36px rgba(255, 82, 38, 0.35)';
      card.style.transform = 'scale(1.02)';
      setTimeout(() => {
        card.style.boxShadow = '';
        card.style.transform = '';
      }, 2500);
    }
  }, 300);
});

function openRouletteModal() {
  rouletteModal.classList.remove('hidden');
  spinRoulette();
}

function closeRouletteModal() {
  clearInterval(rouletteInterval);
  rouletteModal.classList.add('hidden');
}

function spinRoulette() {
  // 룰렛 추천 시 순수 밥집(식사) 식당만 엄선하여 추천
  const places = (currentPlaces || []).filter(isMealRestaurant);
  if (places.length === 0) {
    rouletteCardSlot.innerHTML = `
      <p style="color: #64748b; font-size: 14px;">추천 가능한 밥집 식당이 없습니다. 먼저 식당을 검색해 주세요!</p>
    `;
    return;
  }

  rouletteCardSlot.classList.remove('is-winner');
  btnRouletteAgain.disabled = true;
  btnRouletteGo.disabled = true;

  const funnyPhrases = [
    '🍜 든든한 국밥과 라멘 사이 고민 중...',
    '🍛 바삭한 돈까스냐 매콤한 마라탕이냐...',
    '🍔 빠르게 햄버거 세트 한 입?!',
    '🥘 오늘은 떡볶이에 도전해볼까...',
    '🥩 당당하게 고깃집 1인분 도전?!',
  ];

  let step = 0;
  clearInterval(rouletteInterval);

  rouletteInterval = setInterval(() => {
    const randomTemp = places[Math.floor(Math.random() * places.length)];
    const phrase = funnyPhrases[step % funnyPhrases.length];

    rouletteCardSlot.innerHTML = `
      <div class="slot-rolling-anim">
        <span class="slot-icon-dice">🎲</span>
        <p style="font-size: 18px; font-weight: 800; color: #ff5226;">${escapeHtml(randomTemp.place_name)}</p>
        <p class="slot-text-sub">${phrase}</p>
      </div>
    `;
    step++;
  }, 100);

  // 1.5초 후 당첨 발표
  setTimeout(() => {
    clearInterval(rouletteInterval);
    const winner = places[Math.floor(Math.random() * places.length)];
    currentWinningPlace = winner;

    const soloInfo = getDynamicSoloIndex(winner);

    const walk = formatDistanceWalking(winner.distance);

    rouletteCardSlot.classList.add('is-winner');
    rouletteCardSlot.innerHTML = `
      <div class="roulette-winner-card clean-winner">
        <div class="winner-icon-wrap">
          <span class="winner-emoji">${soloIcon('utensils')}</span>
        </div>
        <div class="winner-badges">
          <span class="difficulty-pill index-level ${soloInfo.pillClass}">${soloInfo.label}</span>
          <span class="distance-pill sm-badge">${walk}</span>
        </div>
        <h4 class="winner-title">${escapeHtml(winner.place_name)}</h4>
        <span class="winner-category">${escapeHtml(winner.category_name || '식당')}</span>
        <p class="winner-psychology">${soloInfo.psychology}</p>
        <p class="winner-meta">📍 ${escapeHtml(winner.road_address_name || winner.address_name || '명지대 근처')}</p>
      </div>
    `;

    btnRouletteAgain.disabled = false;
    btnRouletteGo.disabled = false;
  }, 1500);
}

/* ===================================================
   ${soloIcon('chat')} 기능 3: 실제 혼밥 리뷰 모달 및 저장
   =================================================== */
window.openReviewModalById = (placeId) => openServerReview(placeId);

modalClose.addEventListener('click', () => {
  reviewModal.classList.add('hidden');
});

reviewModal.addEventListener('click', (e) => {
  if (e.target === reviewModal) reviewModal.classList.add('hidden');
});

levelOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    levelOptions.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedReviewLevel = Number(btn.dataset.level);
  });
});

/* ===================================================
   🗺️ 기능 4: Leaflet & 네이버 지도 거점 좌표
   =================================================== */
const MYONGJI_COORDS = { lat: 37.5802, lng: 126.9234, name: '명지대학교 인문캠퍼스' };
const MJC_COORDS = { lat: 37.5845, lng: 126.9240, name: '명지전문대학' };
const BAENGNYEON_COORDS = { lat: 37.5768, lng: 126.9231, name: '백련시장 맛집 골목' };
let mjuMarker = null;

// 🗺️ 네이버 지도 스타일 세로형 줌 슬라이더 & 실시간 거리 축척 바 컨트롤러
function setupLeafletNaverControls(map) {
  const mapElem = document.getElementById('leaflet-map');
  if (!mapElem) return;

  // 기존 컨트롤러 제거 (중복 방지)
  const existingControl = mapElem.querySelector('.naver-style-zoom-control');
  if (existingControl) existingControl.remove();

  const zoomControl = document.createElement('div');
  zoomControl.className = 'naver-style-zoom-control';
  zoomControl.innerHTML = `
    <button type="button" class="naver-zoom-btn zoom-in sm-button " title="확대 (+)">+</button>
    <div class="naver-zoom-slider-track" title="확대/축소 스케일 조절">
      <div class="naver-zoom-track-line"></div>
      <div class="naver-zoom-ticks">
        <div class="naver-zoom-tick" style="top: 0%;"></div>
        <div class="naver-zoom-tick" style="top: 25%;"></div>
        <div class="naver-zoom-tick" style="top: 50%;"></div>
        <div class="naver-zoom-tick" style="top: 75%;"></div>
        <div class="naver-zoom-tick" style="top: 100%;"></div>
      </div>
      <div class="naver-zoom-track-fill"></div>
      <div class="naver-zoom-handle" title="드래그하여 스케일 조절"></div>
      <div class="naver-zoom-tooltip">16.5</div>
    </div>
    <button type="button" class="naver-zoom-btn zoom-out sm-button " title="축소 (−)">−</button>
  `;

  // 지도 드래그 및 클릭 전파 방지
  L.DomEvent.disableClickPropagation(zoomControl);
  L.DomEvent.disableScrollPropagation(zoomControl);

  mapElem.appendChild(zoomControl);

  const btnIn = zoomControl.querySelector('.zoom-in');
  const btnOut = zoomControl.querySelector('.zoom-out');
  const track = zoomControl.querySelector('.naver-zoom-slider-track');
  const fill = zoomControl.querySelector('.naver-zoom-track-fill');
  const handle = zoomControl.querySelector('.naver-zoom-handle');
  const tooltip = zoomControl.querySelector('.naver-zoom-tooltip');

  const minZ = map.getMinZoom() || 15;
  const maxZ = map.getMaxZoom() || 19;
  const usableHeight = 84; // 104px total - 20px padding

  const updateSliderUI = () => {
    const currentZoom = map.getZoom();
    const ratio = Math.max(0, Math.min(1, (currentZoom - minZ) / (maxZ - minZ)));
    const fillH = ratio * usableHeight;
    const bottomPos = 10 + fillH;

    fill.style.height = `${fillH}px`;
    handle.style.bottom = `${bottomPos}px`;
    if (tooltip) {
      tooltip.textContent = `Lv.${currentZoom.toFixed(1)}`;
      tooltip.style.bottom = `${bottomPos - 6}px`;
      tooltip.style.top = 'auto';
    }
  };

  btnIn.addEventListener('click', (e) => {
    e.stopPropagation();
    map.zoomIn(0.5);
  });

  btnOut.addEventListener('click', (e) => {
    e.stopPropagation();
    map.zoomOut(0.5);
  });

  const applyZoomFromClientY = (clientY) => {
    const rect = track.getBoundingClientRect();
    const topY = rect.top + 10;
    const bottomY = rect.bottom - 10;
    const height = bottomY - topY;
    if (height <= 0) return;

    const clampedY = Math.max(topY, Math.min(bottomY, clientY));
    const ratio = 1 - ((clampedY - topY) / height);
    const targetZoom = minZ + ratio * (maxZ - minZ);
    // 0.5 단위 스냅
    const snappedZoom = Math.round(targetZoom * 2) / 2;
    map.setZoom(snappedZoom);
  };

  let isDragging = false;

  const onPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDragging = true;
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    applyZoomFromClientY(clientY);

    const onPointerMove = (moveEvt) => {
      if (!isDragging) return;
      const moveY = moveEvt.clientY || (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientY : 0);
      applyZoomFromClientY(moveY);
    };

    const onPointerUp = () => {
      isDragging = false;
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);
  };

  track.addEventListener('mousedown', onPointerDown);
  track.addEventListener('touchstart', onPointerDown, { passive: false });

  map.on('zoom', updateSliderUI);
  map.on('zoomend', updateSliderUI);
  setTimeout(updateSliderUI, 80);

  // 🎯 네이버 지도 스타일 하단 실시간 거리 축척 바 (Scale Control)
  if (!map._hasScaleControl) {
    L.control.scale({
      position: 'bottomright',
      metric: true,
      imperial: false,
      maxWidth: 100,
    }).addTo(map);
    map._hasScaleControl = true;
  }
}

function initLeafletMap() {
  if (leafletMap) return;

  const mapElem = document.getElementById('leaflet-map');
  if (!mapElem) return;

  // 🗺️ Leaflet 지도 생성 (네이버 지도급 스무스 줌 및 렉 없는 초고속 반응성)
  leafletMap = L.map('leaflet-map', {
    center: [MYONGJI_COORDS.lat, MYONGJI_COORDS.lng],
    zoom: 16.5,
    minZoom: 15,                  // 🛡️ 명지대 권역 밖 과도한 축소 방지
    maxZoom: 19,                  // 🛡️ 건물/골목 상세 식별 줌 상한선
    zoomSnap: 0.5,                // 🎯 0.5 스텝으로 부드럽고 매끄러운 줌
    zoomDelta: 0.5,               // 🖱️ 휠 한 번당 0.5단계 스무스 전환
    scrollWheelZoom: true,        // 🎯 마우스 커서 위치를 중심으로 자연스러운 줌 (화면 쏠림 방지)
    wheelPxPerZoomLevel: 120,     // 🖱️ 완만하고 부드러운 휠 스크롤 감도
    wheelDebounceTime: 40,        // 연속 스크롤 부드러운 반응
    doubleClickZoom: true,
    zoomAnimation: true,          // ⚡ CSS3 3D 하드웨어 가속
    fadeAnimation: true,
    markerZoomAnimation: true,
    bounceAtZoomLimits: true,     // 줌 한계 도달 시 부드러운 탄성 튕김
    maxBounds: [
      [37.560, 126.900],
      [37.600, 126.945],
    ],
    maxBoundsViscosity: 0.85,
    zoomControl: false,           // ❌ 기본 구형 2버튼 비활성화 -> 네이버 지도 스타일 줌 슬라이더로 대체!
  });
  window.leafletMap = leafletMap;


  // 🗺️ 대한민국 국토교통부 브이월드(VWorld) 고해상도 고속 타일 (워터마크 0%, 한국어 도로/상호 완벽 지원, 버퍼링 최적화)
  L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
    minZoom: 15,
    maxZoom: 19,
    maxNativeZoom: 18,
    keepBuffer: 6,             // 타일 6단계 미리 캐싱으로 휠 이동 시 깜빡임 0%
    updateWhenIdle: false,     // 스크롤 중에도 타일 부드럽게 유지
    updateWhenZooming: false,  // 줌 애니메이션 도중 타일 재요청 방지 (60fps 하드웨어 가속)
    attribution: '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noopener">국토교통부 브이월드</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(leafletMap);

  // 🎯 네이버 지도 스타일 세로형 줌 슬라이더 & 스케일 바 장착
  setupLeafletNaverControls(leafletMap);

  // 명지대학교 인문캠퍼스 대표 마커
  const mjuIcon = L.divIcon({
    className: 'custom-leaflet-marker-icon',
    html: `
      <div class="map-marker-anchor-wrap">
        <div class="map-landmark-marker mju-landmark" title="명지대학교 인문캠퍼스">
          <span class="landmark-icon">🏛️</span>
          <span class="landmark-title">명지대 인문캠</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -36],
  });

  mjuMarker = L.marker([MYONGJI_COORDS.lat, MYONGJI_COORDS.lng], { icon: mjuIcon })
    .addTo(leafletMap)
    .bindPopup(`
      <div style="padding: 10px 12px; font-family: 'Pretendard', sans-serif;">
        <h4 style="font-size: 14px; font-weight: 800; color: #002c5f; margin-bottom: 2px;">🏛️ 명지대학교 인문캠퍼스</h4>
        <p style="font-size: 11.5px; color: #64748b;">서울 서대문구 거북골로 34</p>
      </div>
    `);

  updateMapMarkers();
}

function updateMapMarkers() {
  if (currentMapEngine === 'naver' && naverMap) {
    updateNaverMapMarkers();
  }
  if (!leafletMap) return;

  // 기존 식당 마커 정리
  mapMarkers.forEach((m) => leafletMap.removeLayer(m));
  mapMarkers = [];

  const filtered = getMapPlaces();

  filtered.forEach((place) => {
    if (!place.y || !place.x) return;
    const lat = Number(place.y);
    const lng = Number(place.x);
    if (isNaN(lat) || isNaN(lng)) return;

    const soloInfo = getDynamicSoloIndex(place);

    const walk = formatDistanceWalking(place.distance);
    const kakaoUrl = getKakaoMapUrl(place);
    const naverUrl = getNaverMapUrl(place);

    const markerHtml = `
      <div class="map-marker-anchor-wrap">
        <div class="map-place-marker ${soloInfo.pillClass} ${personalMarkerLabel(place.id).className}" title="${escapeHtml(place.place_name)} (${soloInfo.label})">
          <span class="marker-level-badge">${personalMarkerLabel(place.id).icon || soloInfo.lv}</span>
          <span class="marker-title">${escapeHtml(place.place_name)}</span>
        </div>
      </div>
    `;

    const pinIcon = L.divIcon({
      className: 'custom-leaflet-marker-icon',
      html: markerHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -36],
    });

    const popupHtml = createMapPopupHtml(place, soloInfo, walk);

    const marker = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 100 })
      .addTo(leafletMap)
      .bindPopup(popupHtml);

    marker.on('mouseover', () => {
      marker.setZIndexOffset(9999);
    });
    marker.on('mouseout', () => {
      if (!marker.isPopupOpen()) {
        marker.setZIndexOffset(100);
      }
    });
    marker.on('popupopen', () => {
      marker.setZIndexOffset(10000);
    });
    marker.on('popupclose', () => {
      marker.setZIndexOffset(100);
    });

    mapMarkers.push(marker);
  });
}

function fitMapBounds() {
  if (!leafletMap) return;
  const points = [[MYONGJI_COORDS.lat, MYONGJI_COORDS.lng]];
  mapMarkers.forEach((m) => {
    points.push([m.getLatLng().lat, m.getLatLng().lng]);
  });
  if (points.length > 1) {
    leafletMap.fitBounds(points, { padding: [40, 40], maxZoom: 16.5 });
  } else {
    leafletMap.setView([MYONGJI_COORDS.lat, MYONGJI_COORDS.lng], 16.5);
  }
}

/* ===================================================
   🗺️ 기능 4-B: 네이버 지도 API v3 연동 & 하이브리드 전환
   =================================================== */
let naverMap = null;
let naverMarkers = [];
let naverInfoWindows = [];
let currentMapEngine = 'naver'; // 'naver' | 'leaflet' (사용자 기본값: 네이버 지도)
let naverClientId = localStorage.getItem('solo_map_naver_client_id') || 'tnm1g865f5';

// 🚀 기본 지도인 네이버 지도 v3 SDK를 즉시 선제적 로드
loadNaverMapSdk(naverClientId);

// 서버 환경변수(NAVER_CLIENT_ID) 확인 및 최신 키 동기화
fetch('/api/config', { credentials: 'same-origin' })
  .then((res) => res.json())
  .then(async (cfg) => {
    if (cfg && cfg.naverClientId && cfg.naverClientId !== naverClientId) {
      naverClientId = cfg.naverClientId;
      localStorage.setItem('solo_map_naver_client_id', cfg.naverClientId);
      await loadNaverMapSdk(naverClientId);
    }
    if (currentViewMode === 'map' && currentMapEngine === 'naver') {
      initNaverMap();
      updateNaverMapMarkers();
      setTimeout(() => {
        if (naverMap) {
          naverMap.autoResize();
          fitNaverMapBounds();
        }
      }, 120);
    }
  })
  .catch(() => {});

function loadNaverMapSdk(clientId) {
  if (window.naver && window.naver.maps) return Promise.resolve(true);
  const cid = clientId || naverClientId || 'tnm1g865f5';
  return new Promise((resolve) => {
    const existing = document.getElementById('naver-maps-sdk-script');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'naver-maps-sdk-script';
    script.type = 'text/javascript';
    // ncpClientId와 ncpKeyId 둘 다 호환되도록 전달
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(cid)}&ncpClientId=${encodeURIComponent(cid)}`;
    script.onload = () => {
      console.log('🟢 네이버 지도 v3 SDK 로드 성공!');
      resolve(true);
    };
    script.onerror = () => {
      console.warn('네이버 지도 SDK 로드 실패 (Client ID 또는 도메인 등록을 확인하세요)');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

function initNaverMap() {
  if (!window.naver || !window.naver.maps) return false;

  const canvasElem = document.getElementById('naver-map-canvas');
  if (!canvasElem) return false;

  if (!naverMap) {
    naverMap = new naver.maps.Map('naver-map-canvas', {
      center: new naver.maps.LatLng(MYONGJI_COORDS.lat, MYONGJI_COORDS.lng),
      zoom: 16,
      minZoom: 15, // 🛡️ 명지대·명지전문대·백련시장 권역(800m)에 딱 맞춘 최적 줌 하한선 (휠 축소 이탈 방지)
      maxZoom: 18, // 🛡️ 편안한 건물/골목 식별 줌 상한선 (휠 과다 확대 방지)
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.TOP_LEFT,
      },
    });
    window.naverMap = naverMap;

    // 1. 명지대학교 인문캠퍼스 마커
    const mjuLandmarkMarker = new naver.maps.Marker({
      position: new naver.maps.LatLng(MYONGJI_COORDS.lat, MYONGJI_COORDS.lng),
      map: naverMap,
      icon: {
        content: `
          <div class="map-marker-anchor-wrap">
            <div class="map-landmark-marker mju-landmark" title="명지대학교 인문캠퍼스">
              <span class="landmark-icon">🏛️</span>
              <span class="landmark-title">명지대 인문캠</span>
            </div>
          </div>
        `,
        anchor: new naver.maps.Point(0, 0),
      },
      zIndex: 150,
    });

    // 2. 명지전문대학 마커
    const mjcLandmarkMarker = new naver.maps.Marker({
      position: new naver.maps.LatLng(MJC_COORDS.lat, MJC_COORDS.lng),
      map: naverMap,
      icon: {
        content: `
          <div class="map-marker-anchor-wrap">
            <div class="map-landmark-marker mjc-landmark" title="명지전문대학">
              <span class="landmark-icon">🏫</span>
              <span class="landmark-title">명지전문대</span>
            </div>
          </div>
        `,
        anchor: new naver.maps.Point(0, 0),
      },
      zIndex: 150,
    });

    // 3. 백련시장 마커
    const bnLandmarkMarker = new naver.maps.Marker({
      position: new naver.maps.LatLng(BAENGNYEON_COORDS.lat, BAENGNYEON_COORDS.lng),
      map: naverMap,
      icon: {
        content: `
          <div class="map-marker-anchor-wrap">
            <div class="map-landmark-marker bn-landmark" title="백련시장 맛집 골목">
              <span class="landmark-icon">🛒</span>
              <span class="landmark-title">백련시장</span>
            </div>
          </div>
        `,
        anchor: new naver.maps.Point(0, 0),
      },
      zIndex: 150,
    });
  }

  updateNaverMapMarkers();
  return true;
}

let currentOpenedNaverMarker = null;

window.closeCurrentInfoWindow = function () {
  naverInfoWindows.forEach((w) => w.close());
  if (currentOpenedNaverMarker) {
    currentOpenedNaverMarker.setZIndex(100);
  }
  currentOpenedNaverMarker = null;
  if (leafletMap) {
    leafletMap.closePopup();
  }
};

function updateNaverMapMarkers() {
  if (!naverMap || !window.naver || !window.naver.maps) return;

  // 기존 마커 및 인포윈도우 제거
  naverMarkers.forEach((m) => m.setMap(null));
  naverMarkers = [];
  naverInfoWindows.forEach((w) => w.close());
  naverInfoWindows = [];
  currentOpenedNaverMarker = null;

  const filtered = getMapPlaces();

  filtered.forEach((place) => {
    if (!place.y || !place.x) return;
    const lat = Number(place.y);
    const lng = Number(place.x);
    if (isNaN(lat) || isNaN(lng)) return;

    const soloInfo = getDynamicSoloIndex(place);

    const walk = formatDistanceWalking(place.distance);
    const kakaoUrl = getKakaoMapUrl(place);
    const naverUrl = getNaverMapUrl(place);

    const markerHtml = `
      <div class="map-marker-anchor-wrap">
        <div class="map-place-marker ${soloInfo.pillClass} ${personalMarkerLabel(place.id).className}" title="${escapeHtml(place.place_name)} (${soloInfo.label})">
          <span class="marker-level-badge">${personalMarkerLabel(place.id).icon || soloInfo.lv}</span>
          <span class="marker-title">${escapeHtml(place.place_name)}</span>
        </div>
      </div>
    `;

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(lat, lng),
      map: naverMap,
      icon: {
        content: markerHtml,
        anchor: new naver.maps.Point(0, 0),
      },
      zIndex: 100,
    });

    const popupHtml = `<div class="naver-infowindow-wrap">${createMapPopupHtml(place, soloInfo, walk)}</div>`;

    const infoWindow = new naver.maps.InfoWindow({
      content: popupHtml,
      borderWidth: 0,
      backgroundColor: 'transparent',
      disableAnchor: true,
      pixelOffset: new naver.maps.Point(0, -36),
    });

    naver.maps.Event.addListener(marker, 'mouseover', () => {
      marker.setZIndex(9999);
      const el = marker.getElement();
      if (el) {
        const wrap = el.querySelector('.map-marker-anchor-wrap');
        if (wrap) wrap.classList.add('hover');
      }
    });

    naver.maps.Event.addListener(marker, 'mouseout', () => {
      if (currentOpenedNaverMarker !== marker) {
        marker.setZIndex(100);
      }
      const el = marker.getElement();
      if (el) {
        const wrap = el.querySelector('.map-marker-anchor-wrap');
        if (wrap) wrap.classList.remove('hover');
      }
    });

    naver.maps.Event.addListener(marker, 'click', () => {
      // 이미 열려 있는 마커를 다시 누르면 토글 닫기!
      if (currentOpenedNaverMarker === marker) {
        infoWindow.close();
        marker.setZIndex(100);
        currentOpenedNaverMarker = null;
        return;
      }
      if (currentOpenedNaverMarker) {
        currentOpenedNaverMarker.setZIndex(100);
      }
      naverInfoWindows.forEach((w) => w.close());
      marker.setZIndex(10000);
      infoWindow.open(naverMap, marker);
      currentOpenedNaverMarker = marker;
    });

    naverMarkers.push(marker);
    naverInfoWindows.push(infoWindow);
  });

  // 지도 빈 곳 클릭 시 열려있는 팝업 자동 닫기
  naver.maps.Event.clearListeners(naverMap, 'click');
  naver.maps.Event.addListener(naverMap, 'click', () => {
    closeCurrentInfoWindow();
  });
}

function smoothFitNaverMapBounds(forceLevel = null) {
  if (!naverMap || !window.naver || !window.naver.maps) return;

  const targetFilter = forceLevel !== null ? forceLevel : currentFilter;

  // 1. 전체(all) 필터일 때: 명지대, 명지전문대, 백련시장 3대 거점을 모두 아우르는 넓고 부드러운 뷰
  if (targetFilter === 'all' || !naverMarkers.length) {
    const bounds = new naver.maps.LatLngBounds();
    bounds.extend(new naver.maps.LatLng(MYONGJI_COORDS.lat, MYONGJI_COORDS.lng));
    bounds.extend(new naver.maps.LatLng(MJC_COORDS.lat, MJC_COORDS.lng));
    bounds.extend(new naver.maps.LatLng(BAENGNYEON_COORDS.lat, BAENGNYEON_COORDS.lng));
    naverMarkers.forEach((m) => bounds.extend(m.getPosition()));

    const center = bounds.getCenter();
    naverMap.morph(center, 16, { duration: 450, easing: 'easeOutCubic' });
    return;
  }

  // 2. 특정 레벨(Lv.1 ~ Lv.5 또는 찜) 필터일 때: 해당 레벨 식당 마커들의 중심점으로 부드러운 스무스 모핑!
  const bounds = new naver.maps.LatLngBounds();
  naverMarkers.forEach((m) => bounds.extend(m.getPosition()));
  const center = bounds.getCenter();

  // 마커 수에 따른 부드러운 줌 레벨 결정 (너무 과도하게 좁아지지 않도록 16~17 사이 최적화)
  const targetZoom = naverMarkers.length > 5 ? 16.2 : 16.8;
  naverMap.morph(center, targetZoom, { duration: 450, easing: 'easeOutCubic' });
}

function fitNaverMapBounds() {
  smoothFitNaverMapBounds('all');
}

// 목록 보기 ↔ 지도로 보기 뷰 모드 전환 (Leaflet 기본 활성화)
function switchViewMode(mode) {
  currentViewMode = mode;

  if (mode === 'list') {
    btnViewList.classList.add('active');
    btnViewMap.classList.remove('active');
    placesContainer.classList.remove('hidden');
    mapViewContainer.classList.add('hidden');
  } else {
    btnViewMap.classList.add('active');
    btnViewList.classList.remove('active');
    placesContainer.classList.add('hidden');
    mapViewContainer.classList.remove('hidden');

    const naverCanvas = document.getElementById('naver-map-canvas');
    const leafletCanvas = document.getElementById('leaflet-map');
    const mapEngineLabel = document.getElementById('map-engine-label');
    const btnToggle = document.getElementById('btn-toggle-map-engine');

    if (currentMapEngine === 'naver') {
      if (naverCanvas) naverCanvas.classList.remove('hidden');
      if (leafletCanvas) leafletCanvas.classList.add('hidden');
      if (mapEngineLabel) mapEngineLabel.textContent = '오픈맵';
      if (btnToggle) btnToggle.title = '클릭 시 Leaflet 오픈맵으로 전환';

      if (window.naver && window.naver.maps) {
        initNaverMap();
        updateNaverMapMarkers();
        setTimeout(() => {
          if (naverMap) {
            naverMap.autoResize();
            fitNaverMapBounds();
          }
        }, 120);
      } else {
        loadNaverMapSdk(naverClientId || 'tnm1g865f5').then((ok) => {
          if (ok && currentMapEngine === 'naver') {
            initNaverMap();
            updateNaverMapMarkers();
            setTimeout(() => {
              if (naverMap) {
                naverMap.autoResize();
                fitNaverMapBounds();
              }
            }, 120);
          } else {
            // 네이버 지도 로드 실패 시 안전하게 Leaflet으로 폴백
            currentMapEngine = 'leaflet';
            if (naverCanvas) naverCanvas.classList.add('hidden');
            if (leafletCanvas) leafletCanvas.classList.remove('hidden');
            if (mapEngineLabel) mapEngineLabel.textContent = '네이버';
            if (btnToggle) btnToggle.title = '클릭 시 네이버 공식 지도로 전환';
            initLeafletMap();
            updateMapMarkers();
            setTimeout(() => {
              if (leafletMap) {
                leafletMap.invalidateSize();
                fitMapBounds();
              }
            }, 120);
          }
        });
      }
    } else {
      if (naverCanvas) naverCanvas.classList.add('hidden');
      if (leafletCanvas) leafletCanvas.classList.remove('hidden');
      if (mapEngineLabel) mapEngineLabel.textContent = '네이버';
      if (btnToggle) btnToggle.title = '클릭 시 네이버 공식 지도로 전환';
      initLeafletMap();
      updateMapMarkers();
      setTimeout(() => {
        if (leafletMap) {
          leafletMap.invalidateSize();
          fitMapBounds();
        }
      }, 120);
    }
  }
}

btnViewList.addEventListener('click', () => switchViewMode('list'));
btnViewMap.addEventListener('click', () => switchViewMode('map'));

/* ===================================================
   검색 & 필터 이벤트 리스너
   =================================================== */
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) loadPlaces(q);
});

kwChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    kwChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    const q = chip.dataset.query;
    searchInput.value = q;
    loadPlaces(q);
  });
});

filterTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.filter;
    // 이미 활성화된 필터(전체 제외)를 다시 누르면 '전체(all)'로 토글 취소!
    const isAlreadyActive = currentFilter === target && target !== 'all';
    const finalFilter = isAlreadyActive ? 'all' : target;

    filterTabs.forEach((t) => t.classList.toggle('active', t.dataset.filter === finalFilter));
    document.querySelectorAll('.difficulty-index .index-card').forEach((c) => {
      c.classList.toggle('active', c.dataset.level === finalFilter);
    });
    currentFilter = finalFilter;
    renderFilteredPlaces();
    updateMapMarkers();
    smoothFitNaverMapBounds(finalFilter);
  });
});

// ⚡ 정렬 기준 변경 이벤트 (PC 및 모바일 터치 완벽 호환)
if (sortSelect) {
  const handleSortChange = () => {
    currentSort = sortSelect.value;

    // ⚡ 난이도 정렬(낮은 순/높은 순)을 선택했을 때 특정 레벨 필터가 켜져 있으면,
    // 사용자는 '전체 식당을 난이도 순으로' 보고 싶어 하므로 자동으로 '전체(all)'로 전환!
    if ((currentSort === 'level-asc' || currentSort === 'level-desc') && currentFilter !== 'all') {
      currentFilter = 'all';
      filterTabs.forEach((t) => t.classList.toggle('active', t.dataset.filter === 'all'));
      document.querySelectorAll('.difficulty-index .index-card').forEach((c) => c.classList.remove('active'));
    }

    renderFilteredPlaces();
    updateMapMarkers();

    const sortLabels = {
      'distance': '🚶‍♂️ 가까운 거리순으로 정렬되었습니다.',
      'level-asc': '🔰 전체 식당이 난이도 낮은 순(Lv.1→5)으로 정렬되었습니다.',
      'level-desc': '🥩 전체 식당이 난이도 높은 순(Lv.5→1)으로 정렬되었습니다.',
      'reviews': '학우 리뷰 많은 순으로 정렬되었습니다.',
      'name': '🔤 식당 가나다순으로 정렬되었습니다.',
    };
    if (sortLabels[currentSort]) {
      showToast(sortLabels[currentSort]);
    }
  };

  sortSelect.addEventListener('change', handleSortChange);
  sortSelect.addEventListener('input', handleSortChange);
}

// XSS 방지 이스케이프
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[m];
  });
}

/* ===================================================
   지도 플로팅 버튼, 로고 홈 리셋, 난이도 카드 필터 연동
   =================================================== */
const btnMapCenterMju = document.getElementById('btn-map-center-mju');
if (btnMapCenterMju) {
  btnMapCenterMju.addEventListener('click', () => {
    if (currentMapEngine === 'naver' && naverMap && window.naver && window.naver.maps) {
      naverMap.morph(new naver.maps.LatLng(MYONGJI_COORDS.lat, MYONGJI_COORDS.lng), 16);
    } else if (leafletMap) {
      leafletMap.flyTo([MYONGJI_COORDS.lat, MYONGJI_COORDS.lng], 16, { duration: 0.6 });
    }
  });
}

const btnMapCenterMjc = document.getElementById('btn-map-center-mjc');
if (btnMapCenterMjc) {
  btnMapCenterMjc.addEventListener('click', () => {
    if (currentMapEngine === 'naver' && naverMap && window.naver && window.naver.maps) {
      naverMap.morph(new naver.maps.LatLng(MJC_COORDS.lat, MJC_COORDS.lng), 16);
    } else if (leafletMap) {
      leafletMap.flyTo([MJC_COORDS.lat, MJC_COORDS.lng], 16, { duration: 0.6 });
    }
  });
}

const btnMapCenterBn = document.getElementById('btn-map-center-bn');
if (btnMapCenterBn) {
  btnMapCenterBn.addEventListener('click', () => {
    if (currentMapEngine === 'naver' && naverMap && window.naver && window.naver.maps) {
      naverMap.morph(new naver.maps.LatLng(BAENGNYEON_COORDS.lat, BAENGNYEON_COORDS.lng), 16);
    } else if (leafletMap) {
      leafletMap.flyTo([BAENGNYEON_COORDS.lat, BAENGNYEON_COORDS.lng], 16, { duration: 0.6 });
    }
  });
}

const btnMapFitBounds = document.getElementById('btn-map-fit-bounds');
if (btnMapFitBounds) {
  btnMapFitBounds.addEventListener('click', () => {
    if (currentMapEngine === 'naver' && naverMap && window.naver && window.naver.maps) {
      fitNaverMapBounds();
    } else {
      fitMapBounds();
    }
  });
}

// 🌐 네이버 지도 ↔ Leaflet 기본 지도 엔진 전환 토글
const btnToggleMapEngine = document.getElementById('btn-toggle-map-engine');
if (btnToggleMapEngine) {
  btnToggleMapEngine.addEventListener('click', async () => {
    const naverCanvas = document.getElementById('naver-map-canvas');
    const leafletCanvas = document.getElementById('leaflet-map');
    const mapEngineLabel = document.getElementById('map-engine-label');

    if (currentMapEngine === 'leaflet') {
      // Leaflet -> 네이버 지도 엔진으로 전환
      if (!window.naver || !window.naver.maps) {
        showToast('네이버 지도 SDK를 로드하고 있습니다...');
        const loaded = await loadNaverMapSdk(naverClientId || 'tnm1g865f5');
        if (!loaded) {
          showToast('네이버 지도 로드 실패: NCP 콘솔에 도메인 등록이 필요합니다.');
          return;
        }
      }

      currentMapEngine = 'naver';
      if (leafletCanvas) leafletCanvas.classList.add('hidden');
      if (naverCanvas) naverCanvas.classList.remove('hidden');
      if (mapEngineLabel) mapEngineLabel.textContent = '오픈맵';
      btnToggleMapEngine.title = '클릭 시 Leaflet 오픈맵으로 전환';

      const ok = initNaverMap();
      if (ok !== false) {
        updateNaverMapMarkers();
        setTimeout(() => {
          if (naverMap) {
            naverMap.autoResize();
            fitNaverMapBounds();
          }
        }, 150);
        showToast('네이버 공식 지도 엔진으로 전환되었습니다.');
      }
    } else {
      // 네이버 지도 -> Leaflet 오픈맵 엔진으로 전환
      currentMapEngine = 'leaflet';
      if (naverCanvas) naverCanvas.classList.add('hidden');
      if (leafletCanvas) leafletCanvas.classList.remove('hidden');
      if (mapEngineLabel) mapEngineLabel.textContent = '네이버';
      btnToggleMapEngine.title = '클릭 시 네이버 공식 지도로 전환';

      initLeafletMap();
      updateMapMarkers();
      setTimeout(() => {
        if (leafletMap) {
          leafletMap.invalidateSize();
          fitMapBounds();
        }
      }, 150);
      showToast('Leaflet 오픈맵 엔진으로 전환되었습니다.');
    }
  });
}

// ⛶ 지도 전체화면(Fullscreen) 토글
const btnMapFullscreen = document.getElementById('btn-map-fullscreen');
if (btnMapFullscreen) {
  btnMapFullscreen.addEventListener('click', () => {
    const isNowFullscreen = mapViewContainer.classList.toggle('fullscreen');
    btnMapFullscreen.classList.toggle('active', isNowFullscreen);

    const fsText = btnMapFullscreen.querySelector('.fs-text');
    const fsIcon = btnMapFullscreen.querySelector('.fs-icon');
    if (fsText) fsText.textContent = isNowFullscreen ? '축소' : '전체화면';
    if (fsIcon) fsIcon.textContent = isNowFullscreen ? '✕' : '⛶';

    // 네이버 지도 캔버스 크기 즉시 리사이징
    setTimeout(() => {
      if (currentMapEngine === 'naver' && naverMap && window.naver && window.naver.maps) {
        naverMap.autoResize();
        fitNaverMapBounds();
      } else if (leafletMap) {
        leafletMap.invalidateSize();
        fitMapBounds();
      }
    }, 100);

    showToast(isNowFullscreen ? '지도를 전체화면으로 표시합니다 (ESC로 닫기)' : '일반 화면으로 복귀했습니다.');
  });
}

// ESC 키 입력 시 전체화면 자동 닫기
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mapViewContainer && mapViewContainer.classList.contains('fullscreen')) {
    mapViewContainer.classList.remove('fullscreen');
    if (btnMapFullscreen) {
      btnMapFullscreen.classList.remove('active');
      const fsText = btnMapFullscreen.querySelector('.fs-text');
      const fsIcon = btnMapFullscreen.querySelector('.fs-icon');
      if (fsText) fsText.textContent = '전체화면';
      if (fsIcon) fsIcon.textContent = '⛶';
    }
    setTimeout(() => {
      if (naverMap) {
        naverMap.autoResize();
        fitNaverMapBounds();
      }
    }, 100);
    showToast('일반 화면으로 복귀했습니다.');
  }
});

// 좌측 상단 로고 클릭 시 첫 화면으로 완벽 리셋
function resetToHome(e) {
  if (e) e.preventDefault();
  searchInput.value = '';
  kwChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.query === '혼밥');
  });
  filterTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.filter === 'all');
  });
  document.querySelectorAll('.difficulty-index .index-card').forEach((c) => {
    c.classList.remove('active');
  });
  currentFilter = 'all';
  currentSort = 'distance';
  if (sortSelect) sortSelect.value = 'distance';
  switchViewMode('list');
  loadPlaces('혼밥');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const logoHome = document.getElementById('logo-home');
if (logoHome) {
  logoHome.addEventListener('click', resetToHome);
}

// 상단 현실 반영 혼밥 난이도 카드 클릭 시 즉시 해당 레벨 필터링 (이미 선택된 카드 다시 누르면 '전체'로 토글 취소)
document.querySelectorAll('.difficulty-index .index-card').forEach((card) => {
  card.addEventListener('click', () => {
    const level = card.dataset.level;
    if (!level) return;

    // 이미 선택된 카드를 다시 누르면 '전체(all)'로 토글 취소!
    const isAlreadyActive = currentFilter === level;
    const finalFilter = isAlreadyActive ? 'all' : level;

    filterTabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.filter === finalFilter);
    });
    document.querySelectorAll('.difficulty-index .index-card').forEach((c) => {
      c.classList.toggle('active', !isAlreadyActive && c === card);
    });

    currentFilter = finalFilter;
    renderFilteredPlaces();
    updateMapMarkers();
    smoothFitNaverMapBounds(finalFilter);

    document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ===================================================
   초기화 실행
   =================================================== */
updateFavBadge();
loadPlaces('혼밥');
