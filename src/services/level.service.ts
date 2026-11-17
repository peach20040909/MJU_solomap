/**
 * [이 파일이 하는 일]
 * 방문 체크인('다녀왔어요') 및 '혼밥 레벨 키우기' 게이미피케이션 로직을 처리하는 서비스입니다.
 * - 체크인 당시 식당 난이도(levelAtVisit)를 누적 경험치로 산정
 * - 레벨(Lv.1~5), 칭호, 진행도(%), 정복 식당 집계
 * - 당일 중복 체크인 방지 (409)
 * - 미정복 식당 중 현재 레벨에 맞는 단계별 맞춤 식당 3곳 추천
 */

import prisma from '../lib/prisma.js';
import { HttpError } from './auth.service.js';
import { calculateDisplaySoloLevel, ensurePlaceExists } from './review.service.js';
import { getPlaceCuration } from '../lib/gemini.js';
import { MYONGJI_SEOUL_COORDS } from '../lib/kakao.js';

// 혼밥 레벨 티어 규칙 정의 상수
export interface LevelTier {
  level: number;
  title: string;
  minExp: number;
  maxExp: number | null; // 다음 레벨 필요 최소 경험치
}

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, title: 'Lv.1 🐣 혼밥 입문자', minExp: 0, maxExp: 5 },
  { level: 2, title: 'Lv.2 🍚 혼밥 새내기', minExp: 5, maxExp: 15 },
  { level: 3, title: 'Lv.3 🍜 혼밥 숙련자', minExp: 15, maxExp: 30 },
  { level: 4, title: 'Lv.4 🔥 혼밥 고수', minExp: 30, maxExp: 50 },
  { level: 5, title: 'Lv.5 👑 혼밥 끝판왕', minExp: 50, maxExp: null },
];

/**
 * 한국 표준시(KST, UTC+9) 기준 'YYYY-MM-DD' 날짜 문자열 반환 헬퍼
 */
export function getKSTDateString(date: Date = new Date()): string {
  // UTC 시간에 9시간 더하기
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

/**
 * 체크인 기록 배열로부터 레벨, 칭호, 진행률을 계산하는 순수 함수
 */
export function calculateLevelFromCheckIns(checkIns: { levelAtVisit: number; placeId: string }[]) {
  const exp = checkIns.reduce((sum, c) => sum + c.levelAtVisit, 0);
  const conqueredPlacesSet = new Set(checkIns.map((c) => c.placeId));
  const hasConqueredLevel5 = checkIns.some((c) => c.levelAtVisit === 5);

  let currentTier = LEVEL_TIERS[0];

  // Lv.5 끝판왕 조건: 경험치 50점 이상 AND Lv.5 식당 1곳 이상 정복
  if (exp >= 50 && hasConqueredLevel5) {
    currentTier = LEVEL_TIERS[4];
  } else if (exp >= 30) {
    currentTier = LEVEL_TIERS[3];
  } else if (exp >= 15) {
    currentTier = LEVEL_TIERS[2];
  } else if (exp >= 5) {
    currentTier = LEVEL_TIERS[1];
  } else {
    currentTier = LEVEL_TIERS[0];
  }

  // 다음 레벨까지의 진행률(0~100%) 계산
  let progressPercent = 100;
  if (currentTier.maxExp !== null) {
    const range = currentTier.maxExp - currentTier.minExp;
    const gained = exp - currentTier.minExp;
    progressPercent = Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  }

  return {
    level: currentTier.level,
    title: currentTier.title,
    exp,
    nextLevelExp: currentTier.maxExp,
    progressPercent,
    conqueredPlaceCount: conqueredPlacesSet.size,
    visitCount: checkIns.length,
    hasConqueredLevel5,
  };
}

/**
 * 1. 식당 방문 체크인 ('다녀왔어요')
 * - 당일 동일 식당 중복 체크인 방지 (409)
 * - 당시 식당 난이도를 levelAtVisit로 저장
 */
export async function checkInPlace(userId: string, placeId: string, placeName?: unknown) {
  // 리뷰와 같은 규칙: DB에 아직 없는 식당은 JSON·카카오 재검색으로 확인해 등록한다. 없으면 404.
  const place = await ensurePlaceExists(placeId, placeName);

  const visitDate = getKSTDateString();

  // 당일 중복 체크인 검사
  const existingCheckIn = await prisma.checkIn.findUnique({
    where: {
      userId_placeId_visitDate: {
        userId,
        placeId,
        visitDate,
      },
    },
  });

  if (existingCheckIn) {
    throw new HttpError(409, '오늘은 이미 체크인했어요. 내일 다시 도전해보세요!');
  }

  // 현재 시점의 화면 표시 난이도 산출
  const displaySolo = calculateDisplaySoloLevel(
    place.baseSoloLevel,
    place.avgSoloLevel,
    place.reviewCount
  );

  // 체크인 레코드 생성
  const checkIn = await prisma.checkIn.create({
    data: {
      userId,
      placeId,
      levelAtVisit: displaySolo.level,
      visitDate,
    },
    include: {
      place: {
        select: {
          id: true,
          name: true,
          category: true,
          roadAddress: true,
        },
      },
    },
  });

  // 갱신된 사용자의 혼밥 레벨 정보 반환
  const allCheckIns = await prisma.checkIn.findMany({
    where: { userId },
    select: { levelAtVisit: true, placeId: true },
  });

  const levelInfo = calculateLevelFromCheckIns(allCheckIns);

  return {
    checkIn,
    levelInfo,
  };
}

/**
 * 2. 내 혼밥 레벨 상세 정보 조회
 */
export async function getUserLevelInfo(userId: string) {
  const checkIns = await prisma.checkIn.findMany({
    where: { userId },
    select: { levelAtVisit: true, placeId: true },
  });

  return calculateLevelFromCheckIns(checkIns);
}

/**
 * 3. 내가 정복(체크인)한 식당 목록 조회 (식당별 방문 횟수, 최근 방문일, 좌표 포함)
 */
export async function getUserConqueredPlaces(userId: string) {
  const checkIns = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      place: {
        select: {
          id: true,
          name: true,
          category: true,
          roadAddress: true,
          lat: true,
          lng: true,
          area: true,
          baseSoloLevel: true,
          avgSoloLevel: true,
          reviewCount: true,
        },
      },
    },
  });

  // 식당별로 그룹화 집계 (최근 방문일, 총 방문 횟수)
  const placeMap = new Map<string, any>();

  for (const c of checkIns) {
    const existing = placeMap.get(c.placeId);
    if (!existing) {
      const displaySolo = calculateDisplaySoloLevel(
        c.place.baseSoloLevel,
        c.place.avgSoloLevel,
        c.place.reviewCount
      );

      placeMap.set(c.placeId, {
        placeId: c.place.id,
        name: c.place.name,
        category: c.place.category,
        roadAddress: c.place.roadAddress,
        lat: c.place.lat,
        lng: c.place.lng,
        area: c.place.area,
        displaySolo,
        visitCount: 1,
        lastVisitedAt: c.createdAt,
        lastVisitDate: c.visitDate,
      });
    } else {
      existing.visitCount += 1;
    }
  }

  const conqueredList = Array.from(placeMap.values());

  return {
    totalConqueredCount: conqueredList.length,
    totalCheckInCount: checkIns.length,
    conqueredPlaces: conqueredList,
  };
}

/**
 * 4. 다음 레벨 도전을 위한 맞춤 식당 3곳 추천
 * - 아직 체크인하지 않은 식당 중
 * - 난이도가 (내 레벨) 또는 (내 레벨+1)인 곳
 * - 명지대 중심에서 가장 가까운 순서로 정렬하여 3곳 반환
 */
export async function getRecommendedPlaces(userId: string) {
  // 사용자의 체크인 기록 조회
  const checkIns = await prisma.checkIn.findMany({
    where: { userId },
    select: { placeId: true, levelAtVisit: true },
  });

  const levelInfo = calculateLevelFromCheckIns(checkIns);
  const conqueredPlaceIds = new Set(checkIns.map((c) => c.placeId));

  // 타겟 난이도: 내 현재 레벨 또는 내 레벨 + 1 (최대 Lv.5)
  const targetLevelA = levelInfo.level;
  const targetLevelB = Math.min(5, levelInfo.level + 1);

  // 미방문 식당 조회
  const candidates = await prisma.place.findMany({
    where: {
      id: { notIn: Array.from(conqueredPlaceIds) },
    },
  });

  // 명지대학교 인문캠퍼스 기준 좌표
  const mjuLat = parseFloat(MYONGJI_SEOUL_COORDS.y);
  const mjuLng = parseFloat(MYONGJI_SEOUL_COORDS.x);

  // 거리 계산 및 타겟 난이도 필터링
  const scoredPlaces = candidates
    .map((p) => {
      const displaySolo = calculateDisplaySoloLevel(p.baseSoloLevel, p.avgSoloLevel, p.reviewCount);
      // 유클리드 거리 (m 단위 근사)
      const dLat = (p.lat - mjuLat) * 111000;
      const dLng = (p.lng - mjuLng) * 88800;
      const distanceMeters = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));

      return {
        ...p,
        displaySolo,
        distanceMeters,
      };
    })
    .filter((p) => p.displaySolo.level === targetLevelA || p.displaySolo.level === targetLevelB)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 3);

  // AI 큐레이션 결합
  const recommendations = await Promise.all(
    scoredPlaces.map(async (p) => {
      const curation = await getPlaceCuration({
        id: p.id,
        place_name: p.name,
        category_name: p.category,
        road_address_name: p.roadAddress,
      });

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        roadAddress: p.roadAddress,
        lat: p.lat,
        lng: p.lng,
        area: p.area,
        distanceMeters: p.distanceMeters,
        displaySolo: p.displaySolo,
        curation,
      };
    })
  );

  return {
    userLevel: levelInfo.level,
    userTitle: levelInfo.title,
    targetLevels: [targetLevelA, targetLevelB],
    recommendations,
  };
}

