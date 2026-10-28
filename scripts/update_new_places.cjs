const fs = require('fs');
const path = require('path');

// 명지대 인문캠퍼스 중심 좌표
const MJU_Y = 37.5802;
const MJU_X = 126.9234;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 32개 신규 식당 고유 AI 정밀 큐레이션 데이터
const newCurations = {
  // 1. 호코 명지점
  "1476778581": {
    placeId: "1476778581",
    placeName: "호코 명지점",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "겉바속촉 두툼한 수제 일식 돈카츠와 진한 카레! 아늑한 바 좌석이 완비되어 눈치 전혀 없이 편안하게 즐기는 신상 카츠 맛집이에요.",
    tags: ["#수제돈카츠", "#신상일식당", "#바삭바삭카츠", "#1인바좌석", "#카레라멘맛집"]
  },
  // 2. 카츠창조
  "1696002840": {
    placeId: "1696002840",
    placeName: "카츠창조",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "명지대 정문 바로 앞 퓨전 돈카츠와 우동 명소! 정갈한 1인 트레이 서빙과 가성비 넘치는 구성으로 학우들의 원픽 혼밥 스팟이에요.",
    tags: ["#정문앞신상", "#퓨전돈카츠", "#1인트레이", "#가성비카츠", "#바삭한행복"]
  },
  // 3. 기린이라멘
  "323807784": {
    placeId: "323807784",
    placeName: "기린이라멘",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "진하고 뽀얀 닭육수 베이스의 깊고 담백한 정통 라멘! 조용한 1인석에서 대화 없이 나만의 면치기에 집중하기 최고예요.",
    tags: ["#닭육수라멘", "#진한국물", "#명지대신상라멘", "#1인석완비", "#인생라멘"]
  },
  // 4. 라라유부
  "1133035044": {
    placeId: "1133035044",
    placeName: "라라유부",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "연어, 우삼겹, 명란 등 토핑 폭탄 대왕 유부초밥과 치볶동(우동떡볶이)! 빠르고 든든하게 공강 혼밥을 해결할 수 있어요.",
    tags: ["#대왕유부초밥", "#토핑폭탄", "#치볶동", "#초스피드혼밥", "#간편든든식사"]
  },
  // 5. 메가혼밥 명지대점
  "459149867": {
    placeId: "459149867",
    placeName: "메가혼밥 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "이름부터 혼밥러를 위해 탄생한 전용 밥집! 키오스크 주문과 1인 칸막이 좌석으로 시선 신경 쓸 필요가 0%예요.",
    tags: ["#혼밥전문점", "#칸막이1인석", "#시선신경0%", "#푸짐한양", "#학생맞춤밥집"]
  },
  // 6. 예스리토스트
  "1995562661": {
    placeId: "1995562661",
    placeName: "예스리토스트",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "버터 풍미 가득 노릇하게 구워낸 두툼한 토스트! 공강 10분 컷으로 가볍고 든든하게 배 채우기 좋은 간편식 명소예요.",
    tags: ["#갓구운토스트", "#공강10분컷", "#지갑지킴이", "#달콤바삭", "#초스피드식사"]
  },
  // 7. 만나샐러드
  "1863582338": {
    placeId: "1863582338",
    placeName: "만나샐러드",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "신선한 연어·치킨 포케와 영양 가득 샐러드 보울! 쾌적하고 깔끔한 매장에서 시험 후 건강하게 식단 관리하기 완벽해요.",
    tags: ["#신선한포케", "#다이어트식단", "#단백질충전", "#깔끔한인테리어", "#가벼운혼밥"]
  },
  // 8. 샤브한끼
  "1394562011": {
    placeId: "1394562011",
    placeName: "샤브한끼",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "자리마다 1인 개인 인덕션 완비! 다인석 샤브샤브의 부담 없이 나만의 냄비에서 칼국수와 죽까지 당당하게 즐겨요.",
    tags: ["#1인개인인덕션", "#나만의샤브", "#눈치없는혼샤브", "#깔끔한육수", "#혼밥혁신"]
  },
  // 9. 애슐리퀸즈 명지대점
  "841885003": {
    placeId: "841885003",
    placeName: "애슐리퀸즈 명지대점",
    soloLevel: 4,
    levelLabel: "Lv.4 다인석 식당",
    psychology: "명지대 MCC관 2층 신규 입점 초대형 월드 뷔페! 시험 끝난 기념으로 풍성한 스시와 바비큐를 마음껏 플렉스하기 좋아요.",
    tags: ["#MCC관신규오픈", "#200가지뷔페", "#시험끝플렉스", "#초밥디저트무한", "#기념일추천"]
  },
  // 10. 샐러디 명지대점
  "904784744": {
    placeId: "904784744",
    placeName: "샐러디 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "학교 바로 앞 웜볼과 랩 샌드위치 전문점! 키오스크 주문과 아늑한 1인석에서 눈치 없이 건강한 한 끼를 즐기기 안성맞춤이에요.",
    tags: ["#학교바로앞", "#웜볼샐러드", "#식단관리", "#쾌적한1인석", "#가벼운한끼"]
  },
  // 11. 연희김밥 명지대점
  "27397434": {
    placeId: "27397434",
    placeName: "연희김밥 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "중독성 강한 매콤오징어김밥과 속 꽉 찬 참치김밥! 빠르게 포장하거나 매장에서 1줄 뚝딱 해결하는 명품 분식집이에요.",
    tags: ["#매콤오징어김밥", "#연희동명물", "#속꽉찬김밥", "#초스피드포장", "#간편혼밥"]
  },
  // 12. 봉구스밥버거 명지대점
  "24265919": {
    placeId: "24265919",
    placeName: "봉구스밥버거 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "한 손에 들고 숟가락으로 푹푹 떠먹는 가성비 밥버거! 대학생의 든든한 점심을 책임지는 영원한 혼밥 메이트예요.",
    tags: ["#추억의밥버거", "#초가성비한끼", "#스팸마요치즈", "#스피드포장", "#지갑지킴이"]
  },
  // 13. 미도쌀국수 남가좌점
  "582616669": {
    placeId: "582616669",
    placeName: "미도쌀국수 남가좌점",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "진한 소고기 사골 육수와 푸짐한 숙주! 쌀쌀해진 날씨에 따끈하게 속 풀며 면치기하기 좋은 동남아 쌀국수 맛집이에요.",
    tags: ["#진한국물쌀국수", "#푸짐한양", "#해장쌀국수", "#아늑한매장", "#속풀리면요리"]
  },
  // 14. 프랭크버거 명지대점
  "1921156583": {
    placeId: "1921156583",
    placeName: "프랭크버거 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "100% 순소고기 수제 패티의 육즙과 불향! 키오스크 주문으로 눈치 볼 필요 전혀 없이 깔끔하게 즐기는 수제버거예요.",
    tags: ["#소고기수제버거", "#육즙팡팡", "#키오스크주문", "#감자튀김맛집", "#간편혼밥"]
  },
  // 15. 호랑마라 명지대점
  "651984420": {
    placeId: "651984420",
    placeName: "호랑마라 명지대점",
    soloLevel: 3,
    levelLabel: "Lv.3 일반 밥집",
    psychology: "진하고 고소한 땅콩소스에 알싸한 마라 풍미! 1인 보울에 내가 좋아하는 재료만 담아 시험 스트레스 풀기 제격이에요.",
    tags: ["#얼얼한마라탕", "#스트레스해소", "#내맘대로토핑", "#마라수혈", "#매콤고소"]
  },
  // 16. 나주향 나주곰탕
  "1989045751": {
    placeId: "1989045751",
    placeName: "나주향 나주곰탕",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "맑고 개운한 양지 육수에 부드러운 고기가 한가득! 시험 끝나고 지친 몸에 든든한 원기 회복 뚝배기 보약을 선물해보세요.",
    tags: ["#맑은나주곰탕", "#속풀이국밥", "#든든한보양식", "#1인뚝배기", "#원기회복"]
  },
  // 17. 무청감자탕 남가좌점
  "1409914379": {
    placeId: "1409914379",
    placeName: "무청감자탕 남가좌점",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "부드러운 시래기와 살코기 두둑한 뼈해장국! 혼자 온 손님이 많아 편안하게 깍두기 올려 완뚝하기 좋은 감자탕 명가예요.",
    tags: ["#시래기뼈해장국", "#살코기가득", "#얼큰구수한국물", "#혼밥국밥추천", "#완뚝도전"]
  },
  // 18. 육회바른연어 명지대점
  "1720383166": {
    placeId: "1720383166",
    placeName: "육회바른연어 명지대점",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "고소한 육회덮밥과 입에서 살살 녹는 연어초밥 세트! 고생한 나에게 주는 가성비 좋은 선물 같은 깔끔한 1인 정식이에요.",
    tags: ["#육회덮밥", "#생연어초밥", "#단백질충전", "#깔끔한1인정식", "#나를위한보상"]
  },
  // 19. 봉구네가마솥순대국
  "26546071": {
    placeId: "26546071",
    placeName: "봉구네가마솥순대국",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "가마솥에서 장시간 우려낸 진국 사골과 쫄깃한 머릿고기! 학교 옆 골목에서 혼자 든든하게 속 채우기 좋은 순대국 맛집이에요.",
    tags: ["#가마솥순대국", "#토종순대", "#뽀얀육수", "#골목숨은맛집", "#든든한뚝배기"]
  },
  // 20. 제일쌀국수
  "1352293581": {
    placeId: "1352293581",
    placeName: "제일쌀국수",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "착한 가격과 아낌없는 양으로 학생들의 발길을 끄는 골목 쌀국수집! 조용하고 아늑한 분위기에서 편하게 식사하기 좋아요.",
    tags: ["#착한가격쌀국수", "#골목혼밥", "#진한국물", "#푸짐한숙주", "#조용한식사"]
  },
  // 21. 라면조아
  "337042284": {
    placeId: "337042284",
    placeName: "라면조아",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "화력 좋은 냄비에 꼬들하게 끓여낸 라면과 김밥! 소박하지만 혼밥하기 가장 부담 없는 추억의 라면 분식집이에요.",
    tags: ["#꼬들라면", "#분식집감성", "#초스피드점심", "#가성비최고", "#편안한분위기"]
  },
  // 22. 일로식당
  "13293368": {
    placeId: "13293368",
    placeName: "일로식당",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "손수 밀어 끓인 쫄깃한 손칼국수와 시원한 수제비! 혼자서도 정감 넘치고 따뜻하게 한 그릇 비워낼 수 있어요.",
    tags: ["#손칼국수", "#쫄깃한면발", "#시원한국물", "#학생단골국수", "#든든한면요리"]
  },
  // 23. 다래칼국수
  "16559198": {
    placeId: "16559198",
    placeName: "다래칼국수",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "바지락이 산더미처럼 들어간 시원 칼칼한 칼국수와 매콤 겉절이! 으슬으슬한 환절기에 든든하게 속 데우기 최고예요.",
    tags: ["#바지락칼국수", "#시원칼칼", "#매콤겉절이", "#혼밥칼국수", "#속풀이음식"]
  },
  // 24. 모래내설농탕 본점
  "16706082": {
    placeId: "16706082",
    placeName: "모래내설농탕 본점",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "오랜 세월 사랑받아온 깊고 묵직한 설렁탕 명가! 소면 먼저 건져먹고 깍두기 국물 붓는 전통 혼밥의 진수를 맛보세요.",
    tags: ["#전통설렁탕", "#진한사골육수", "#깍두기맛집", "#혼밥완뚝", "#명지대인근명소"]
  },
  // 25. 신박한식
  "158882315": {
    placeId: "158882315",
    placeName: "신박한식",
    soloLevel: 3,
    levelLabel: "Lv.3 일반 밥집",
    psychology: "정갈하게 담겨 나오는 영양 만점 밑반찬과 메인 요리! 자취생이 엄마 집밥 생각날 때 든든하게 영양 챙기기 딱 좋아요.",
    tags: ["#정갈한백반", "#집밥느낌", "#영양만점", "#자취생보물", "#든든한점심"]
  },
  // 26. 부안식당
  "13287579": {
    placeId: "13287579",
    placeName: "부안식당",
    soloLevel: 3,
    levelLabel: "Lv.3 일반 밥집",
    psychology: "손맛 넘치는 제육볶음과 얼큰 된장찌개가 일품인 노포 백반집! 넉넉한 인심으로 혼자서도 밥 두 공기 비우게 되는 곳이에요.",
    tags: ["#인심가득백반", "#제육볶음", "#된장찌개", "#편안한분위기", "#정겨운식사"]
  },
  // 27. 산동만두
  "1964466997": {
    placeId: "1964466997",
    placeName: "산동만두",
    soloLevel: 2,
    levelLabel: "Lv.2 혼밥 성지",
    psychology: "바삭한 피 속에 육즙이 가득 차오르는 수제 군만두와 찐만두! 혼자 조용히 미식을 즐기고 싶을 때 들르는 숨은 보석이에요.",
    tags: ["#수제육즙만두", "#겉바속촉군만두", "#고독한미식가", "#중식만두명가", "#별미혼밥"]
  },
  // 28. 늘우짜
  "287475206": {
    placeId: "287475206",
    placeName: "늘우짜",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "즉석에서 뽑아주는 뜨끈한 우동과 감칠맛 옛날 짜장면! 착한 가격에 5분 만에 나와 바쁜 점심이나 야식으로 제격이에요.",
    tags: ["#기계우동", "#옛날짜장", "#초스피드혼밥", "#가성비맛집", "#편안한식사"]
  },
  // 29. 시카고부대찌개
  "1491480546": {
    placeId: "1491480546",
    placeName: "시카고부대찌개",
    soloLevel: 3,
    levelLabel: "Lv.3 일반 밥집",
    psychology: "고소한 치즈와 햄 소시지가 듬뿍 들어간 1인 부대찌개! 다인석 메뉴를 혼자서도 보글보글 끓여먹을 수 있어 만족도 최상이에요.",
    tags: ["#햄폭탄부대찌개", "#라면사리필수", "#칼칼한국물", "#1인부대찌개", "#든든한한끼"]
  },
  // 30. 착한컵 홍은점
  "51264344": {
    placeId: "51264344",
    placeName: "착한컵 홍은점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "토핑 가득한 컵밥을 초고속으로 즐길 수 있는 곳! 강의 시간 전후 15분 만에 든든하게 해결하기 최고예요.",
    tags: ["#컵밥전문점", "#스피드한끼", "#가성비컵밥", "#바쁜수업시간", "#간편식사"]
  },
  // 31. 왕만두쉐프 명지대점
  "1337347257": {
    placeId: "1337347257",
    placeName: "왕만두쉐프 명지대점",
    soloLevel: 1,
    levelLabel: "Lv.1 입문 혼밥",
    psychology: "찜통에서 갓 쪄낸 큼직한 고기왕만두와 김치만두! 이동 중이나 매장에서 가볍고 든든하게 배 채우기 좋은 혼밥 스팟이에요.",
    tags: ["#갓찐왕만두", "#김이모락모락", "#속꽉찬고기만두", "#간편포장", "#든든한간식"]
  },
  // 32. 등촌샤브칼국수 명지대점
  "16556025": {
    placeId: "16556025",
    placeName: "등촌샤브칼국수 명지대점",
    soloLevel: 4,
    levelLabel: "Lv.4 다인석 식당",
    psychology: "미나리 버섯 칼국수와 고소한 볶음밥의 대명사! 시험 끝난 날 친구들과 가거나 혼밥 만렙 도전하기 좋은 핫플이에요.",
    tags: ["#얼큰버섯칼국수", "#미나리듬뿍", "#마무리볶음밥", "#명지대맛집", "#스트레스해소"]
  }
};

// 1. 기존 데이터 로드
const daedongPlacesPath = path.resolve('src/data/daedongPlaces.json');
const aiCurationsPath = path.resolve('src/data/aiCurations.json');
const selectedNewPlacesPath = path.resolve('scratch_selected_new_places.json');

const currentDaedong = JSON.parse(fs.readFileSync(daedongPlacesPath, 'utf8'));
const currentCurations = JSON.parse(fs.readFileSync(aiCurationsPath, 'utf8'));
const selectedNew = JSON.parse(fs.readFileSync(selectedNewPlacesPath, 'utf8'));

console.log(`현재 대동명지도 식당 수: ${currentDaedong.length}곳`);
console.log(`현재 AI 큐레이션 수: ${Object.keys(currentCurations).length}곳`);

const existingIds = new Set(currentDaedong.map((p) => p.id));
let addedPlacesCount = 0;

for (const rawPlace of selectedNew) {
  if (existingIds.has(rawPlace.id)) {
    console.log(`이미 존재하는 ID 스킵: ${rawPlace.place_name}`);
    continue;
  }

  const dist = getDistance(MJU_Y, MJU_X, Number(rawPlace.y), Number(rawPlace.x));

  const formattedPlace = {
    id: rawPlace.id,
    place_name: rawPlace.place_name,
    category_name: rawPlace.category_name,
    category_group_code: rawPlace.category_group_code || 'FD6',
    category_group_name: rawPlace.category_group_name || '음식점',
    phone: rawPlace.phone || '',
    address_name: rawPlace.address_name || '',
    road_address_name: rawPlace.road_address_name || rawPlace.address_name || '',
    x: rawPlace.x,
    y: rawPlace.y,
    place_url: rawPlace.place_url || `https://place.map.kakao.com/${rawPlace.id}`,
    distance: String(dist),
    source: 'daedong',
    is_new: true, // ✨ 신규 식당 플래그!
  };

  currentDaedong.push(formattedPlace);
  existingIds.add(rawPlace.id);
  addedPlacesCount++;
}

// 2. AI 큐레이션 병합
let addedCurationsCount = 0;
for (const [id, cur] of Object.entries(newCurations)) {
  if (!currentCurations[id]) {
    addedCurationsCount++;
  }
  currentCurations[id] = cur;
}

// 3. 파일 저장
fs.writeFileSync(daedongPlacesPath, JSON.stringify(currentDaedong, null, 2), 'utf8');
fs.writeFileSync(aiCurationsPath, JSON.stringify(currentCurations, null, 2), 'utf8');

console.log(`\n🎉 업데이트 완료!`);
console.log(`- 새로 추가된 대동명지도 식당: ${addedPlacesCount}곳 (총 ${currentDaedong.length}곳)`);
console.log(`- 새로 추가된 AI 큐레이션: ${addedCurationsCount}곳 (총 ${Object.keys(currentCurations).length}곳)`);
