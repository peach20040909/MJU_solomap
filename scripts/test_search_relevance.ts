// 메뉴 검색에 엉뚱한 식당이 섞이지 않는지 (2026-11-24 QA에서 실제로 섞였던 카카오 결과로 확인)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterKakaoResults } from '../src/lib/searchRelevance.js';

const p = (place_name: string, category_name: string) => ({ place_name, category_name });
const names = (list: { place_name: string }[]) => list.map((x) => x.place_name);

test('국밥 검색: 곱창집·오리집·동남아·떡볶이는 빼고 국밥·순대·감자탕만', () => {
  const kakao = [
    p('백년순대국', '음식점 > 한식 > 국밥'), p('태양곱창 남가좌점', '음식점 > 한식 > 육류,고기 > 곱창,막창'),
    p('낭낭오리집', '음식점 > 한식 > 육류,고기 > 오리'), p('황씨네', '음식점 > 아시아음식 > 동남아음식'),
    p('배떡 응암점', '음식점 > 분식 > 떡볶이'), p('시골감자국', '음식점 > 한식 > 감자탕'), p('연희순대국', '음식점 > 한식'),
  ];
  assert.deepEqual(names(filterKakaoResults(kakao, '국밥', false)), ['백년순대국', '시골감자국', '연희순대국']);
});

test('버거 검색: 제과점·술집·치킨집은 빼고 버거·패스트푸드만', () => {
  const kakao = [
    p('맥도날드', '음식점 > 패스트푸드 > 맥도날드'), p('파리바게뜨', '음식점 > 간식 > 제과,베이커리'),
    p('호호키친', '음식점 > 술집 > 호프,요리주점'), p('부어치킨', '음식점 > 치킨'), p('유진버거', '음식점 > 양식 > 햄버거'),
  ];
  assert.deepEqual(names(filterKakaoResults(kakao, '버거', false)), ['맥도날드', '유진버거']);
});

test('전체(혼밥) 검색: 술집·수산물 시장만 빼고 그대로', () => {
  const kakao = [p('락희안', '음식점 > 중식'), p('수아레', '음식점 > 술집'), p('대진수산물 직거래어장', '음식점 > 한식 > 해물,생선')];
  assert.deepEqual(names(filterKakaoResults(kakao, '혼밥', true)), ['락희안']);
});

test('자유 검색어는 맞는 곳이 없으면 카카오 결과를 그대로 둔다', () => {
  const kakao = [p('한국밥상', '음식점 > 한식')];
  assert.deepEqual(names(filterKakaoResults(kakao, '제육', false)), ['한국밥상']);
  assert.deepEqual(names(filterKakaoResults(kakao, '돈까스', false)), []); // 메뉴 칸 검색은 엄격하게
});
