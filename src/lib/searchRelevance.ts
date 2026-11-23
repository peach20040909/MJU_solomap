/**
 * [이 파일이 하는 일]
 * 메뉴 검색 결과에서 엉뚱한 식당을 걸러 낸다.
 * 카카오 키워드 검색은 메뉴판에 '국밥'이 한 줄만 있어도 곱창집·오리집까지 돌려주므로,
 * 식당 이름이나 분류에 그 메뉴를 뜻하는 단어가 있는 곳만 남긴다.
 */

type PlaceLike = { place_name: string; category_name?: string };

// 메뉴 칸 검색어 → 식당 이름·분류에서 찾을 단어 (같은 뜻의 단어까지)
export const MENU_TERMS: Record<string, string[]> = {
  국밥: ['국밥', '해장', '곰탕', '순대', '설렁', '설농', '감자탕', '뼈다귀', '내장탕'],
  라멘: ['라멘', '라면', '우동', '일본식라면'],
  돈까스: ['돈까스', '돈가스', '카츠'],
  버거: ['버거', '햄버거', '패스트푸드'],
  중식: ['중식', '중국', '마라', '짜장', '짬뽕', '양꼬치'],
  김밥: ['김밥', '도시락', '주먹밥'],
  분식: ['분식', '떡볶이', '김밥', '만두', '토스트'],
  아시아음식: ['아시아', '베트남', '태국', '쌀국수', '동남아', '인도'],
  고기: ['육류', '고기', '곱창', '막창', '삼겹', '갈비', '구이', '오리', '족발', '보쌈', '두루치기'],
  // 자주 치는 검색어 중 가게 이름에 그 단어가 없는 경우가 많은 것 (마라왕·호랑마라, 스시하나에)
  마라탕: ['마라', '훠궈'],
  초밥: ['초밥', '스시', '롤'],
};

// 밥집이 아닌 곳 (술집·카페·제과점·시장 등). 카카오 분류 기준.
const NOT_MEAL = /술집|호프|주점|포차|이자카야|카페|커피|제과|베이커리|떡,한과|수산물|직거래|마트|슈퍼|편의점|아이스크림|디저트/;

export function searchTerms(query: string): string[] {
  const q = query.toLowerCase().trim();
  return MENU_TERMS[q] ?? [q];
}

export function matchesTerms(place: PlaceLike, terms: string[]): boolean {
  const text = `${place.place_name} ${place.category_name ?? ''}`.toLowerCase();
  return terms.some((t) => text.includes(t));
}

export function isMealPlace(place: PlaceLike): boolean {
  // 분류가 '한식 > 해물'이어도 이름이 '수산물 직거래어장'인 시장 같은 곳이 있어 이름도 본다
  return !NOT_MEAL.test(`${place.category_name ?? ''} ${place.place_name}`);
}

/**
 * 카카오 결과 거르기. 메뉴 검색이면 이름·분류가 맞는 곳만 남기고,
 * 그렇게 해서 하나도 남지 않는 자유 검색어는 카카오 결과를 그대로 둔다(검색이 텅 비지 않게).
 */
export function filterKakaoResults<T extends PlaceLike>(places: T[], query: string, isGeneral: boolean): T[] {
  const meals = places.filter(isMealPlace);
  if (isGeneral) return meals;
  const terms = searchTerms(query);
  const relevant = meals.filter((p) => matchesTerms(p, terms));
  const isMenuChip = query.toLowerCase().trim() in MENU_TERMS;
  return relevant.length || isMenuChip ? relevant : meals;
}
