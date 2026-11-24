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
    '배스킨', '베스킨', '와플대학', '와플', '도넛', '던킨', '크리스피크림', '마카롱', // '크리스피'만 쓰면 슈퍼크리스피(버거)까지 빠진다
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
  FAVORITE_PLACES: 'solo_map_favorite_places_v1', // 찜한 식당 정보(다른 메뉴를 검색해도 찜 목록에 보이게)
};

function getFavoritePlaces() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITE_PLACES)) || {}; } catch { return {}; }
}

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
  const saved = getFavoritePlaces();
  if (exists) {
    favs = favs.filter((id) => id !== placeId);
    delete saved[placeId];
  } else {
    favs.push(placeId);
    const place = currentPlaces.find((p) => p.id === placeId);
    if (place) saved[placeId] = place;
  }
  localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
  try { localStorage.setItem(STORAGE_KEYS.FAVORITE_PLACES, JSON.stringify(saved)); } catch { /* 저장 공간이 없으면 지금 검색 결과에서만 보인다 */ }
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
// 검색할 때마다 번호를 올리고, 응답이 왔을 때 번호가 바뀌었으면(그사이 새 검색) 버린다
let searchSeq = 0;
let isLoadingPlaces = false; // 불러오는 동안 정렬·필터를 눌러도 '식당 없음' 대신 로딩 화면을 유지
let placesError = false; // 불러오기에 실패하면 필터를 눌러도 '0곳' 대신 오류 안내와 다시 시도 버튼을 유지
let lastSearchKeyword = '';
async function loadPlaces(keyword) {
  const seq = ++searchSeq;
  isLoadingPlaces = true;
  placesError = false;
  lastSearchKeyword = keyword;
  currentPlaces = [];
  updateMapMarkers();
  placesContainer.innerHTML = soloEmptyState('대학가 식당을 찾고 있어요', '명지대 · 명지전문대 · 백련시장 주변 식당을 탐색합니다.');
  catalogTitle.textContent = `"${keyword}" 검색 결과`;
  catalogCount.textContent = '검색 중...';

  try {
    const res = await fetch(`/api/places/search?query=${encodeURIComponent(keyword)}`, { credentials: 'same-origin' });
    const data = await res.json();
    if (seq !== searchSeq) return; // 더 최근 검색이 있으면 이 응답은 버린다
    isLoadingPlaces = false;

    if (!data.success) {
      throw new Error(data.message || '식당 정보를 불러오지 못했습니다.');
    }

    // 순수 밥집/식사 식당만 필터링 (카페/디저트/음료 전면 배제)
    currentPlaces = (data.places || []).filter(isMealRestaurant);
    renderFilteredPlaces();
    updateMapMarkers();
    // 불러오는 동안 뽑기 창을 열었으면 다 받은 지금 뽑는다
    if (!rouletteModal.classList.contains('hidden')) spinRoulette();
  } catch (err) {
    if (seq !== searchSeq) return;
    isLoadingPlaces = false;
    console.error(err);
    placesError = true;
    // 'Failed to fetch' 같은 브라우저 영어 오류 대신 연결 안내를 보여 준다
    const message = err instanceof TypeError || err instanceof SyntaxError ? '인터넷 연결을 확인하고 다시 시도해 주세요.' : err.message;
    placesContainer.innerHTML = soloEmptyState('식당 정보를 가져올 수 없습니다', message, { variant: 'error' })
      + '<button type="button" class="btn-clear-filter sm-button" data-retry-search>다시 시도</button>';
    catalogCount.textContent = '불러오기 실패';
    syncMapEmptyState();
    // 뽑기 창이 기다리고 있었으면 실패를 알린다(다시 뽑기를 누르면 다시 불러온다)
    if (!rouletteModal.classList.contains('hidden')) {
      btnRouletteAgain.disabled = false;
      rouletteCardSlot.innerHTML = '<p style="color: #64748b; font-size: 14px;">식당을 불러오지 못했어요. 다시 뽑기를 눌러 주세요.</p>';
    }
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
    // 지금 검색 결과에 없는 찜 식당도 저장해 둔 정보로 보여 준다(찜 개수와 목록이 어긋나지 않게)
    const saved = getFavoritePlaces();
    list = getFavorites().map((id) => currentPlaces.find((p) => p.id === id) || saved[id]).filter(Boolean);
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

// 휴대폰에서는 20곳씩 끊어 보여 준다. 필터·검색이 바뀌면 처음 20곳으로 돌아간다.
const MOBILE_PAGE_SIZE = 20;
const mobileQuery = { matches: true }; // 모바일 전용 화면: PC에서도 같은 폭으로 보여 준다
let visiblePlaceCount = MOBILE_PAGE_SIZE;

function renderFilteredPlaces(keepCount = false) {
  if (isLoadingPlaces || placesError) return;
  if (!keepCount) visiblePlaceCount = MOBILE_PAGE_SIZE;
  const filtered = getFilteredList();
  catalogCount.textContent = `${filtered.length}곳`;

  if (filtered.length === 0) {
    const emptyMsg = currentFilter === 'fav'
      ? '아직 찜한 식당이 없습니다! 식당 카드의 하트 버튼을 눌러 나만의 혼밥 리스트를 만들어보세요.'
      : currentFilter === 'all'
        ? '이 검색어로 찾은 밥집이 없어요. 다른 메뉴나 식당 이름으로 검색해 보세요.' // 필터를 안 골랐는데 '필터를 변경하라'고 하지 않게
        : '해당 조건의 식당이 없습니다. 상단 필터를 변경하거나 다른 메뉴를 검색해 보세요.';

    const levelOnly = /^[1-5]$/.test(currentFilter) && currentPlaces.length > 0;
    placesContainer.innerHTML = levelOnly
      ? soloEmptyState(`Lv.${currentFilter} 식당은 없어요`, `이 검색 결과에서 Lv.${currentFilter} 조건에 맞는 곳이 없어요. 전체 ${currentPlaces.length}곳을 볼 수 있어요.`, { icon: 'search' })
        + `<button type="button" class="btn-clear-filter sm-button" data-clear-filter>전체 ${currentPlaces.length}곳 보기</button>`
      : soloEmptyState(currentFilter === 'fav' ? '찜한 식당이 비어있습니다' : '일치하는 식당이 없습니다', emptyMsg, { icon: currentFilter === 'fav' ? 'heart' : 'search' });
    return;
  }

  const shown = mobileQuery.matches ? filtered.slice(0, visiblePlaceCount) : filtered;
  const moreButton = shown.length < filtered.length
    ? `<button type="button" class="btn-load-more sm-button">식당 더 보기 <span>${shown.length} / ${filtered.length}</span></button>`
    : '';
  placesContainer.innerHTML = shown.map((place) => createCardHtml(place)).join('') + moreButton;
}

// 카드 빈 곳을 누르면 식당 상세 화면(위치·전화·지도·리뷰)으로 간다. 버튼·링크 클릭은 그대로 둔다.
placesContainer.addEventListener('click', (e) => {
  if (e.target.closest('[data-retry-search]')) { loadPlaces(lastSearchKeyword); return; }
  if (e.target.closest('[data-clear-filter]')) { setFilter('all'); renderFilteredPlaces(); updateMapMarkers(); return; }
  if (e.target.closest('.btn-load-more')) {
    visiblePlaceCount += MOBILE_PAGE_SIZE;
    renderFilteredPlaces(true);
    return;
  }
  if (e.target.closest('a, button')) return;
  const card = e.target.closest('.place-card-item');
  if (card) openPlaceDetail(card.id.replace('place-card-', ''));
});

// 식당명과 혼밥 정보를 먼저 읽고 필요한 작업을 선택하는 공통 카드.
function createCardHtml(place) {
  const soloInfo = getDynamicSoloIndex(place);
  const walkText = formatDistanceWalking(place.distance);
  const cleanAddr = place.road_address_name || place.address_name || '주소 정보 없음';
  const category = (place.category_name || '음식점').split('>').map(t => t.trim()).filter(Boolean).slice(1, 3).join(' · ') || '음식점';
  const reviews = getPlaceReviews(place.id);
  const reviewCount = place.displaySolo?.reviewCount || reviews.length;
  // 카드에는 고르는 데 필요한 정보만. 위치·전화·태그·지도·리뷰 작성은 카드를 누르면 펼쳐진다.
  return `
    <article class="place-card-item clean-card sm-card ${soloInfo.pillClass}" id="place-card-${place.id}">
      <div class="card-header-row">
        <div class="card-title-group">
          <h3 class="place-title">${escapeHtml(place.place_name)}</h3>
          <div class="card-cat-line"><span class="place-category" title="${escapeHtml(place.category_name || '')}">${escapeHtml(category)}</span><span class="distance-pill">${walkText}</span></div>
        </div>
        <button type="button" class="btn-heart-fav ${isPlaceFavorite(place.id) ? 'active' : ''} sm-button sm-button--icon sm-button--ghost" aria-label="찜하기" aria-pressed="${isPlaceFavorite(place.id)}" title="찜하기" onclick="handleToggleFav('${place.id}', event)">${soloIcon('heart')}</button>
      </div>
      <div class="card-level-row">
        <span class="solo-badge-chip sm-level-badge">${soloInfo.label}</span>
        <span class="sm-level-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <span class="level-score">${soloInfo.lv}/5</span>
        <span class="card-review-count">리뷰 ${reviewCount}</span>
      </div>
      <p class="solo-psychology-text">${escapeHtml(soloInfo.psychology)}</p>
      <div class="card-footer-actions">
        <button type="button" class="btn-review-list sm-button sm-button--ghost" onclick="openReviewsList('${place.id}')">${soloIcon('chat')} 리뷰 ${reviewCount}개</button>
        <button type="button" class="btn-checkin sm-button" onclick="checkInById('${place.id}', this)">${soloIcon('check')} 다녀왔어요</button>
      </div>
      <button type="button" class="card-detail-link sm-button sm-button--ghost" onclick="openPlaceDetail('${place.id}')">자세히 보기 <span aria-hidden="true">›</span></button>
    </article>`;
}

// 두 지도 엔진에서 같은 정보 위계와 버튼을 사용한다.
function createMapPopupHtml(place, soloInfo, walk) {
  // 지도 위 창은 작게: 이름·레벨·거리 + 상세 보기/리뷰 보기. 설명·주소·지도 링크·다녀왔어요는 상세 화면에 있다
  return `<div class="map-popup-card clean-popup compact-popup ${soloInfo.pillClass}">
    <button type="button" class="popup-close-btn sm-button sm-button--icon sm-button--ghost" aria-label="식당 정보 닫기" title="닫기" onclick="closeCurrentInfoWindow()">${soloIcon('close')}</button>
    <h3 class="popup-title">${escapeHtml(place.place_name)}</h3>
    <div class="popup-badges-row"><span class="sm-level-badge">${escapeHtml(soloInfo.label)}</span><span class="popup-walk">${walk}</span></div>
    <div class="popup-footer-actions">
      <button type="button" class="popup-btn primary sm-button" onclick="closeCurrentInfoWindow(); openPlaceDetail('${place.id}')">상세 보기</button>
      <button type="button" class="popup-btn secondary sm-button sm-button--ghost" onclick="openReviewsList('${place.id}')">리뷰 보기</button>
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

  showToast(isNowFav ? '찜 목록에 추가했어요.' : '찜 목록에서 뺐어요.');

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

// Esc도 닫기 버튼과 같게 기록을 되돌리며 닫는다(ui.js의 공통 Esc는 창만 숨겨 '뽑기 창' 기록이 남고, 나중에 홈 주소에 검색 결과가 남는 원인이 됐다)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !rouletteModal.classList.contains('hidden')) closeRouletteModal();
}, true);
rouletteModal.addEventListener('click', (e) => {
  if (e.target === rouletteModal) closeRouletteModal();
});

btnRouletteAgain.addEventListener('click', () => {
  spinRoulette();
});

btnRouletteGo.addEventListener('click', () => {
  if (!currentWinningPlace) return;
  closeRouletteModal(false); // 창 기록은 상세 화면 기록으로 바꾼다(openPlaceDetail)
  // 당첨 식당의 상세 화면으로 바로 간다
  openPlaceDetail(currentWinningPlace.id);
});

function openRouletteModal() {
  if (!history.state?.roulette) history.pushState({ ...(history.state || {}), roulette: true }, '', location.href);
  rouletteModal.classList.remove('hidden');
  spinRoulette();
}

let rouletteClosing = false; // 닫기 버튼으로 뒤로 간 popstate는 화면을 다시 그리지 않는다
function closeRouletteModal(viaHistory = true) {
  clearInterval(rouletteInterval);
  rouletteModal.classList.add('hidden');
  if (viaHistory && history.state?.roulette) { rouletteClosing = true; history.back(); }
}

// 뽑기 창 안에서 고르는 난이도(홈에는 결과 화면의 레벨 필터가 없어서 창 안에서 고른다)
let rouletteLevel = 'all';
document.querySelectorAll('[data-roulette-level]').forEach((btn) => btn.addEventListener('click', () => {
  rouletteLevel = btn.dataset.rouletteLevel;
  document.querySelectorAll('[data-roulette-level]').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  spinRoulette();
}));

function spinRoulette() {
  // 룰렛 추천 시 순수 밥집(식사) 식당만, 고른 난이도가 있으면 그 난이도만
  // 홈에 들어오자마자 뽑으면 식당 목록이 아직 오는 중이다: 불러오는 중이라고 보여 주고, 다 오면 loadPlaces가 다시 뽑는다
  if (placesError) loadPlaces(lastSearchKeyword);
  // 홈의 뽑기는 직전 검색(0곳일 수도 있는 국밥·zzz 등)이 아니라 명지대 주변 전체 식당에서 고른다
  else if (!document.body.classList.contains('results-open') && lastSearchKeyword !== '혼밥' && !isLoadingPlaces) loadPlaces('혼밥');
  if (isLoadingPlaces) {
    rouletteCardSlot.classList.remove('is-winner');
    btnRouletteGo.disabled = true;
    rouletteCardSlot.innerHTML = '<p style="color: #64748b; font-size: 14px;">근처 밥집을 불러오는 중이에요...</p>';
    return;
  }
  const meals = (currentPlaces || []).filter(isMealRestaurant);
  const places = rouletteLevel === 'all' ? meals : meals.filter((p) => String(getDynamicSoloIndex(p).lv) === rouletteLevel);
  if (places.length === 0) {
    rouletteCardSlot.classList.remove('is-winner');
    btnRouletteGo.disabled = true;
    rouletteCardSlot.innerHTML = `
      <p style="color: #64748b; font-size: 14px;">${meals.length ? `Lv.${rouletteLevel} 식당이 없어요. 다른 난이도를 골라 보세요.` : '추천 가능한 밥집 식당이 없습니다. 먼저 식당을 검색해 주세요!'}</p>
    `;
    return;
  }

  rouletteCardSlot.classList.remove('is-winner');
  // 다시 뽑기를 키보드로 눌렀으면, 뽑는 동안 버튼이 꺼져 초점이 사라지므로 다 뽑은 뒤 그 버튼으로 되돌린다
  const refocusAgain = document.activeElement === btnRouletteAgain;
  btnRouletteAgain.disabled = true;
  btnRouletteGo.disabled = true;

  const ROULETTE_FOODS = ['rice', 'stew', 'noodle', 'japanese', 'burger', 'jjajang', 'kimbap', 'snack', 'pho', 'grill'];
  const funnyPhrases = [
    '든든한 국밥과 라멘 사이 고민 중...',
    '바삭한 돈까스냐 매콤한 마라탕이냐...',
    '빠르게 햄버거 세트 한 입?',
    '오늘은 떡볶이에 도전해 볼까...',
    '당당하게 고깃집 1인분 도전?',
  ];

  let step = 0;
  clearInterval(rouletteInterval);

  rouletteInterval = setInterval(() => {
    const randomTemp = places[Math.floor(Math.random() * places.length)];
    const phrase = funnyPhrases[step % funnyPhrases.length];

    const food = ROULETTE_FOODS[step % ROULETTE_FOODS.length];
    rouletteCardSlot.innerHTML = `
      <div class="slot-rolling-anim">
        <img class="slot-food" src="/food/${food}.webp" alt="" width="88" height="88">
        <p class="slot-name">${escapeHtml(randomTemp.place_name)}</p>
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
        <div class="winner-icon-wrap ${soloInfo.pillClass}">
          <img class="winner-char" src="/levels/level-${soloInfo.lv}.webp" alt="" width="96" height="96">
        </div>
        <div class="winner-badges ${soloInfo.pillClass}">
          <span class="sm-level-badge">${escapeHtml(soloInfo.label)}</span>
          <span class="distance-pill sm-badge">${walk}</span>
        </div>
        <h4 class="winner-title">${escapeHtml(winner.place_name)}</h4>
        <span class="winner-category">${escapeHtml(winner.category_name || '식당')}</span>
        <p class="winner-psychology">${soloInfo.psychology}</p>
        <p class="winner-meta">${soloIcon('pin')} ${escapeHtml(winner.road_address_name || winner.address_name || '명지대 근처')}</p>
      </div>
    `;

    btnRouletteAgain.disabled = false;
    btnRouletteGo.disabled = false;
    if (refocusAgain && !rouletteModal.classList.contains('hidden')) btnRouletteAgain.focus();
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
  syncMapEmptyState();
  // 레벨 필터·검색이 바뀌어 지도에서 빠진 식당의 정보 카드는 닫는다
  if (!mapSheet.classList.contains('hidden') && !getMapPlaces().some((p) => String(p.id) === mapSheet.dataset.placeId)) closeCurrentInfoWindow();
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
          <span class="marker-food"><img src="/food/${retroFoodKey(place.category_name, place.place_name)}.webp" alt="" width="32" height="32"><span class="marker-level-badge">${personalMarkerLabel(place.id).icon || soloInfo.lv}</span></span>
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
      .addTo(leafletMap);
    marker.on('click', () => { closeCurrentInfoWindow(); showMapSheet(place); });

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
      maxZoom: 20, // 골목 식당이 붙어 있어 18에선 핀이 겹친다. 20까지 확대해 하나씩 보이게(묶음은 20에서만 풀림)
      zoomControl: true,
      zoomControlOptions: {
        position: naver.maps.Position.TOP_LEFT,
      },
    });
    window.naverMap = naverMap;
    // 넓게 볼 때(줌 16 이하)는 129개 상호명이 겹치므로 숫자 배지만 보이고, 확대·호버·선택 시 이름을 보인다.
    const syncMarkerDensity = () => document.getElementById('naver-map-canvas').classList.toggle('map-compact', naverMap.getZoom() <= 16);
    naver.maps.Event.addListener(naverMap, 'zoom_changed', syncMarkerDensity);
    syncMarkerDensity();
    // 이동·확대가 끝날 때마다 화면 기준으로 핀을 다시 묶는다
    naver.maps.Event.addListener(naverMap, 'idle', clusterNaverMarkers);
    naver.maps.Event.once(naverMap, 'idle', addZoomHitAreas);

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

// 핀을 누르면 핀 위 말풍선 대신 화면 아래 고정 카드로 보여 준다(위쪽 버튼·화면 끝에 가려지지 않게)
const mapSheet = document.createElement('div');
mapSheet.id = 'map-place-sheet';
mapSheet.className = 'map-place-sheet hidden';
mapSheet.setAttribute('role', 'dialog');
mapSheet.setAttribute('aria-label', '선택한 식당');
document.body.appendChild(mapSheet);
// 같은 건물 식당 목록 카드
function showClusterSheet(places) {
  mapSheet.innerHTML = `<div class="map-popup-card clean-popup compact-popup cluster-list">
    <button type="button" class="popup-close-btn sm-button sm-button--icon sm-button--ghost" aria-label="닫기" onclick="closeCurrentInfoWindow()">${soloIcon('close')}</button>
    <h3 class="popup-title">이 건물 식당 ${places.length}곳</h3>
    <ul>${places.map((p) => { const info = getDynamicSoloIndex(p); return `<li><button type="button" class="cluster-item ${info.pillClass}" data-place-id="${escapeHtml(p.id)}"><strong>${escapeHtml(p.place_name)}</strong><span class="sm-level-badge">${escapeHtml(info.label)}</span></button></li>`; }).join('')}</ul>
  </div>`;
  mapSheet.querySelectorAll('.cluster-item').forEach((b) => b.addEventListener('click', () => {
    const place = places.find((p) => String(p.id) === b.dataset.placeId);
    if (place) showMapSheet(place);
  }));
  mapSheet.classList.remove('hidden');
}
function showMapSheet(place) {
  const soloInfo = getDynamicSoloIndex(place);
  mapSheet.innerHTML = createMapPopupHtml(place, soloInfo, formatDistanceWalking(place.distance));
  mapSheet.dataset.placeId = place.id;
  mapSheet.classList.remove('hidden');
}

window.closeCurrentInfoWindow = function () {
  mapSheet.classList.add('hidden');
  document.querySelectorAll('.map-marker-anchor-wrap.active').forEach((w) => w.classList.remove('active'));
  naverInfoWindows.forEach((w) => w.close());
  if (currentOpenedNaverMarker) {
    currentOpenedNaverMarker.setZIndex(100);
  }
  currentOpenedNaverMarker = null;
  if (leafletMap) {
    leafletMap.closePopup();
  }
};

// 지도 핀은 키보드로도 고를 수 있게: Tab으로 가서 Enter·Space를 누르면 클릭과 같게 식당 카드를 연다.
// 화면 요소를 click()하면 네이버 지도가 좌표 없는 클릭으로 오류를 내서, 그 핀의 마커 클릭 이벤트를 직접 일으킨다
document.addEventListener('keydown', (e) => {
  const pin = e.target.closest?.('.map-marker-anchor-wrap[role="button"]');
  if (!pin || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  const marker = naverMarkers.find((m) => m.getElement?.()?.contains(pin));
  if (!marker) return;
  naver.maps.Event.trigger(marker, 'click');
  // 키보드로 연 카드는 초점을 카드 안(상세 보기)으로 옮기고, Esc로 닫으면 그 핀으로 돌아온다
  if (!mapSheet.classList.contains('hidden')) { lastKeyboardPin = pin; mapSheet.querySelector('.popup-btn, button')?.focus(); }
});
let lastKeyboardPin = null;
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || mapSheet.classList.contains('hidden')) return;
  const fromSheet = mapSheet.contains(document.activeElement);
  closeCurrentInfoWindow();
  if (fromSheet && lastKeyboardPin?.isConnected) lastKeyboardPin.focus();
});

// 네이버 지도 +·− 버튼은 28×22px이라 손가락으로 누르기 작다. 모양은 그대로 두고, 그 위에 44×44px 투명 버튼을 겹쳐 누르는 영역만 넓힌다.
// 버튼을 +·− 바로 옆(같은 부모)에 두어, 지도 위 다른 요소 높이가 바뀌어도 위치가 어긋나지 않게 한다
function addZoomHitAreas() {
  const canvas = document.getElementById('naver-map-canvas');
  [['지도 확대', 1], ['지도 축소', -1]].forEach(([label, step]) => {
    const link = canvas.querySelector(`img[alt="${label}"]`)?.closest('a');
    const box = link?.parentElement;
    if (!box || box.querySelector(`[data-zoom-hit="${step}"]`)) return;
    link.tabIndex = -1; // 키보드·스크린리더는 겹친 버튼 하나만 만나게
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-zoom-hit';
    btn.dataset.zoomHit = step;
    btn.setAttribute('aria-label', label);
    btn.style.left = `${link.offsetLeft + link.offsetWidth / 2 - 22}px`;
    btn.style.top = `${link.offsetTop + link.offsetHeight / 2 - 22}px`;
    btn.addEventListener('click', () => naverMap.setZoom(naverMap.getZoom() + step, true));
    box.appendChild(btn);
  });
}

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
      <div class="map-marker-anchor-wrap" role="button" tabindex="0" aria-label="${escapeHtml(place.place_name)}, ${escapeHtml(soloInfo.label)}">
        <div class="map-place-marker ${soloInfo.pillClass} ${personalMarkerLabel(place.id).className}" title="${escapeHtml(place.place_name)} (${soloInfo.label})">
          <span class="marker-food"><img src="/food/${retroFoodKey(place.category_name, place.place_name)}.webp" alt="" width="32" height="32"><span class="marker-level-badge">${personalMarkerLabel(place.id).icon || soloInfo.lv}</span></span>
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
    marker.__place = place; // 묶음 목록에서 식당 정보를 꺼내 쓴다

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
        closeCurrentInfoWindow();
        return;
      }
      closeCurrentInfoWindow();
      marker.setZIndex(10000);
      marker.getElement?.()?.querySelector('.map-marker-anchor-wrap')?.classList.add('active');
      showMapSheet(place);
      currentOpenedNaverMarker = marker;
    });

    naverMarkers.push(marker);
    naverInfoWindows.push(infoWindow);
  });

  clusterNaverMarkers();

  // 지도 빈 곳 클릭 시 열려있는 팝업 자동 닫기
  naver.maps.Event.clearListeners(naverMap, 'click');
  naver.maps.Event.addListener(naverMap, 'click', () => {
    closeCurrentInfoWindow();
  });
}

// ── 핀 묶음: '전체'처럼 식당이 많으면 핀이 겹쳐 무엇이 있는지 안 보인다.
// 화면에서 CLUSTER_PX 안에 모인 핀은 숫자 묶음 하나로 보여 주고, 누르면 그 자리로 확대한다. 가장 크게 확대하면 모두 따로 보인다.
const CLUSTER_PX = 52;
let naverClusterMarkers = [];
function clusterNaverMarkers() {
  if (!naverMap || !window.naver?.maps || typeof naverMap.getProjection !== 'function') return;
  naverClusterMarkers.forEach((c) => c.setMap(null));
  naverClusterMarkers = [];
  // 내 정복·추천 지도는 몇 곳뿐이고 색으로 구분해야 해서 묶지 않는다
  if (typeof personalMapMode !== 'undefined' && personalMapMode) { naverMarkers.forEach((m) => m.getMap() || m.setMap(naverMap)); return; }
  const proj = naverMap.getProjection();
  const zoom = naverMap.getZoom();
  const maxZoom = naverMap.getMaxZoom ? naverMap.getMaxZoom() : 18;
  if (!proj) return;
  // 가장 크게 확대해도 같은 건물 식당은 좌표가 거의 같아 겹친다 → 그때는 아주 가까운 핀만 묶고, 누르면 목록으로 보여 준다
  const atMax = zoom >= maxZoom;
  const px = atMax ? 26 : CLUSTER_PX;
  const groups = [];
  naverMarkers.forEach((m) => {
    const pt = proj.fromCoordToOffset(m.getPosition());
    const g = groups.find((x) => Math.abs(x.x - pt.x) < px && Math.abs(x.y - pt.y) < px);
    if (g) g.items.push(m); else groups.push({ x: pt.x, y: pt.y, items: [m] });
  });
  groups.forEach((g) => {
    // 선택한 핀은 묶지 않는다
    const keepOpen = g.items.includes(currentOpenedNaverMarker);
    if (g.items.length === 1 || keepOpen) { g.items.forEach((m) => m.getMap() || m.setMap(naverMap)); return; }
    g.items.forEach((m) => m.setMap(null));
    let lat = 0, lng = 0;
    g.items.forEach((m) => { lat += m.getPosition().lat(); lng += m.getPosition().lng(); });
    const center = new naver.maps.LatLng(lat / g.items.length, lng / g.items.length);
    const c = new naver.maps.Marker({
      position: center, map: naverMap, zIndex: 200,
      icon: { content: `<button type="button" class="map-cluster" aria-label="식당 ${g.items.length}곳 묶음, ${atMax ? '눌러서 목록 보기' : '눌러서 확대'}">${g.items.length}<small>곳</small></button>`, anchor: new naver.maps.Point(26, 26) },
    });
    naver.maps.Event.addListener(c, 'click', () => {
      if (atMax) showClusterSheet(g.items.map((m) => m.__place).filter(Boolean));
      else naverMap.morph(center, Math.min(maxZoom, zoom + 2), { duration: 350, easing: 'easeOutCubic' });
    });
    naverClusterMarkers.push(c);
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
// 지도로 보기에서 식당이 0곳(또는 불러오기 실패)이면 빈 지도만 보이지 않게, 목록 칸의 안내 문구를 지도 위에 함께 보여 준다
function syncMapEmptyState() {
  if (currentViewMode !== 'map') return;
  const empty = !isLoadingPlaces && (placesError || getMapPlaces().length === 0);
  placesContainer.classList.toggle('hidden', !empty);
}

function switchViewMode(mode) {
  currentViewMode = mode;
  if (mode === 'list') closeCurrentInfoWindow();

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
    syncMapEmptyState();

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
/* 검색 결과는 홈 아래로 이어 붙이지 않고 별도 화면(body.results-open)으로 연다.
   주소에 ?q=검색어를 남겨서 휴대폰 뒤로 가기로 홈에 돌아오고, 그 주소로 바로 들어와도 결과가 열린다. */
function showResults(q, push = true, level = 'all') {
  const wasResults = document.body.classList.contains('results-open');
  document.body.classList.add('results-open');
  const url = `?q=${encodeURIComponent(q)}`;
  if (push && location.search !== url) {
    // 결과 화면·상세 화면에서 또 검색하면 기록을 쌓지 않고 바꾼다(뒤로 가기·← 가 이전 검색이 아니라 홈으로)
    // depth: 결과 → 상세 → 새 검색처럼 상세 기록을 새 결과로 바꾸면, 밑에 이전 결과 기록이 쌓인 수(← 는 그만큼 더 뒤로 가서 홈으로)
    // level: 레벨 카드로 연 결과는 뒤로·앞으로 가기로 돌아와도 그 레벨을 다시 고른다
    const st = history.state;
    if (st?.place || (wasResults && st?.q)) history.replaceState({ q, level, depth: (st.depth || 0) + (st.place && st.q ? 1 : 0) }, '', url);
    else history.pushState({ q, level }, '', url);
  }
  window.scrollTo(0, 0);
}

function showHome() {
  closeCurrentInfoWindow();
  document.body.classList.remove('results-open');
  // 홈에는 직전 검색어(0곳이던 zzz 등)를 남기지 않고 처음처럼 '혼밥'·'전체' 칸으로 돌린다
  searchInput.value = '혼밥';
  kwChips.forEach((c) => c.classList.toggle('active', c.dataset.query === '혼밥'));
  window.scrollTo(0, 0);
}

const LEVEL_NAMES = { 1: '입문 혼밥', 2: '혼밥 성지', 3: '일반 밥집', 4: '다인석 식당', 5: '혼밥 끝판왕' };
function setFilter(f) {
  currentFilter = f;
  filterTabs.forEach((t) => t.classList.toggle('active', t.dataset.filter === f));
  document.querySelectorAll('.difficulty-index .index-card').forEach((c) => c.classList.toggle('active', c.dataset.level === f));
}
function openSearch(q, push = true, level = 'all') {
  // 상세 화면 위에서 새로 검색하면 상세를 닫고 새 결과를 보여 준다(주소만 바뀌고 이전 식당이 남지 않게)
  if (document.body.classList.contains('detail-open')) closePlaceDetail();
  setFilter(level); // 새 검색은 전체에서 시작(이전 레벨 필터 때문에 0곳으로 보이지 않게)
  searchInput.value = q;
  // 같은 검색어의 메뉴 칸이 있으면 그 칸만, 없으면 아무 칸도 선택하지 않는다.
  kwChips.forEach((c) => c.classList.toggle('active', c.dataset.query === q));
  loadPlaces(q);
  // 메뉴 칸으로 연 검색은 실제 검색어(아시아음식) 대신 칸 이름(아시안)으로 제목을 보여 준다
  setCatalogTitle(q, level);
  showResults(q, push, level);
}
// 결과 제목: 레벨(1~5)이면 'Lv.4 다인석 식당', 메뉴 칸 검색이면 칸 이름, 아니면 검색어
function setCatalogTitle(q, level = 'all') {
  const chip = [...kwChips].find((c) => c.dataset.query === q);
  // '다인석 식당 식당'처럼 겹치지 않게, 이름이 '식당'으로 끝나면 덧붙이지 않는다
  if (/^[1-5]$/.test(level)) catalogTitle.textContent = `Lv.${level} ${LEVEL_NAMES[level]}${LEVEL_NAMES[level].endsWith('식당') ? '' : ' 식당'}`;
  else catalogTitle.textContent = `"${chip && q !== '혼밥' ? chip.textContent.trim() : q}" 검색 결과`;
}

window.addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search);
  const q = params.get('q'), place = params.get('place');
  // 닫기 버튼으로 뒤로 간 경우: 홈이 그대로 보이고 있으면 다시 그리지 않는다(아니면 아래에서 주소에 맞춰 화면을 맞춘다)
  if (rouletteClosing) { rouletteClosing = false; if (!document.body.classList.contains('results-open') && !document.body.classList.contains('detail-open')) return; }
  if (!rouletteModal.classList.contains('hidden')) { closeRouletteModal(false); return; }
  // 앞으로 가기로 뽑기 기록에 돌아오면 뽑기 창을 다시 연다
  // 뽑기는 홈 화면의 기능이라, 다른 화면에서 이 기록으로 돌아오면 홈을 보여 준 뒤 연다
  if (history.state?.roulette) {
    if (document.body.classList.contains('detail-open')) closePlaceDetail();
    if (document.body.classList.contains('results-open')) showHome();
    openRouletteModal();
    return;
  }
  // 뒤로·앞으로 가기로 다른 화면에 가면 이전 화면에 떠 있던 안내·로그인·리뷰 창은 닫는다
  ['growth-guide-modal', 'auth-modal', 'reviews-list-modal', 'review-modal'].forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  const myPage = document.getElementById('mypage-modal');
  if (params.get('my')) {
    // 기록 → 식당 상세 → 뒤로: 상세는 닫고 기록을 다시 보여 준다
    if (document.body.classList.contains('detail-open')) closePlaceDetail();
    if (myPage.classList.contains('hidden')) openMyPage(false);
    return;
  }
  myPage.classList.add('hidden');
  if (place) { openPlaceDetail(place, false); return; }
  // 상세에서 뒤로 오면 목록을 다시 불러오지 않고 보던 자리로 돌아간다
  if (document.body.classList.contains('detail-open')) { closePlaceDetail(); if (q && q === searchInput.value) return; }
  if (q) openSearch(q, false, history.state?.level || 'all');
  else showHome();
});

document.getElementById('btn-results-back')?.addEventListener('click', () => {
  if (history.state?.q) history.go(-1 - (history.state.depth || 0));
  else {
    history.replaceState(null, '', location.pathname);
    showHome();
  }
});

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) openSearch(q);
});

kwChips.forEach((chip) => {
  chip.addEventListener('click', () => openSearch(chip.dataset.query));
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
    // 레벨 카드로 연 '혼밥' 결과는 제목도 고른 레벨에 맞춘다(전체로 바꿨는데 'Lv.4'가 남지 않게)
    if (searchInput.value === '혼밥') setCatalogTitle('혼밥', finalFilter);
    // 뒤로·앞으로 가기로 이 결과에 돌아와도 고른 필터가 남게 기록에 적어 둔다
    if (history.state?.q && !history.state.place) history.replaceState({ ...history.state, level: finalFilter }, '');
    renderFilteredPlaces();
    updateMapMarkers();
    smoothFitNaverMapBounds(finalFilter);
  });
});

// ⚡ 정렬 기준 변경 이벤트 (PC 및 모바일 터치 완벽 호환)
if (sortSelect) {
  const sortPills = document.querySelectorAll('.sort-pill');
  sortPills.forEach((pill) => pill.addEventListener('click', () => {
    if (sortSelect.value === pill.dataset.sort) return;
    sortSelect.value = pill.dataset.sort;
    sortSelect.dispatchEvent(new Event('change'));
  }));
  const handleSortChange = () => {
    currentSort = sortSelect.value;
    sortPills.forEach((p) => { const on = p.dataset.sort === currentSort; p.classList.toggle('active', on); p.setAttribute('aria-pressed', String(on)); });

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
      'distance': '가까운 순으로 정렬했어요.',
      'level-asc': '혼밥하기 쉬운 순(Lv.1→5)으로 정렬했어요.',
      'level-desc': '혼밥하기 어려운 순(Lv.5→1)으로 정렬했어요.',
      'reviews': '학우 리뷰 많은 순으로 정렬했어요.',
      'name': '이름순으로 정렬했어요.',
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
  history.replaceState(null, '', location.pathname);
  showHome();
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
    // 홈의 레벨 카드는 "전체 식당 중 이 레벨"을 결과 화면으로 연다
    openSearch('혼밥', true, level);
  });
});

/* ===================================================
   초기화 실행
   =================================================== */
updateFavBadge();
// ?q=검색어로 들어오면 결과 화면부터, 아니면 홈에서 시작(목록 데이터는 미리 받아 둔다)
const initialQuery = new URLSearchParams(location.search).get('q');
const initialParams = new URLSearchParams(location.search);
// 공유받은 검색·식당 링크(?q= / ?place=)로 처음 들어오면 밑에 홈(과 검색 결과) 기록을 깔아 둔다:
// '홈으로 돌아가기'·뒤로 가기가 사이트 밖이나 이전 상세가 아니라 홈으로 간다
// (새로고침은 이미 기록이 있어 건너뛰고, 기록 화면 주소(?my=1)는 account.js가 따로 처리한다)
const sharedPlace = initialParams.get('place');
if ((initialQuery || sharedPlace) && !history.state && !initialParams.get('my')) {
  const sharedUrl = location.search;
  history.replaceState(null, '', location.pathname);
  if (initialQuery) history.pushState({ q: initialQuery }, '', `?q=${encodeURIComponent(initialQuery)}`);
  if (sharedPlace) history.pushState({ place: sharedPlace, q: initialQuery || '', depth: 0 }, '', sharedUrl);
}
if (initialQuery) openSearch(initialQuery, false);
else loadPlaces('혼밥');
// ?place=식당ID로 들어오면 상세 화면부터 연다 (상세 화면 코드는 account.js에 있어 모든 스크립트가 읽힌 뒤 연다)
const initialPlace = new URLSearchParams(location.search).get('place');
if (initialPlace) document.addEventListener('DOMContentLoaded', () => openPlaceDetail(initialPlace, false));
