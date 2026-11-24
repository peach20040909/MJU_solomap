/**
 * [이 파일이 하는 일]
 * 식당(장소) 검색, 목록 조회 및 상세 정보 조회 요청을 처리하는 컨트롤러입니다.
 * 카카오 로컬 API, 대동명지도 정적 DB, Gemini AI 큐레이션 및
 * Prisma 데이터베이스의 학우 평가 난이도(avgSoloLevel)를 통합하여 응답합니다.
 */

import type { Request, Response, NextFunction } from 'express';
import { searchPlacesByKeyword, MYONGJI_SEOUL_COORDS, type KakaoPlaceDocument } from '../lib/kakao.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { getPlaceCuration } from '../lib/gemini.js';
import { calculateDisplaySoloLevel } from '../services/review.service.js';
import { createRequire } from 'module';
import { searchTerms, matchesTerms, filterKakaoResults } from '../lib/searchRelevance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 대동명지도 2026 ver. 명지대 실제 대학가 검증 맛집 데이터 로드
let daedongPlaces: KakaoPlaceDocument[] = [];
try {
  daedongPlaces = require('../data/daedongPlaces.json');
} catch {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'src/data/daedongPlaces.json'),
      path.resolve(process.cwd(), 'dist/data/daedongPlaces.json'),
      path.resolve(__dirname, '../data/daedongPlaces.json'),
    ];
    const validPath = candidatePaths.find((p) => fs.existsSync(p));
    if (validPath) {
      const raw = fs.readFileSync(validPath, 'utf8');
      daedongPlaces = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('⚠️ daedongPlaces.json 로드 실패:', err);
  }
}


/**
 * 1. 식당 키워드 검색 컨트롤러: GET /api/places/search?query=...
 * (대동명지도 + 카카오 실시간 검색 + AI 큐레이션 + DB 학우 평가 난이도 융합)
 */
export async function searchPlaces(req: Request, res: Response, next: NextFunction) {
  try {
    // ?query=a&query=b 처럼 배열로 오면 문자열이 아니라서 400으로 알린다
    const rawQuery = req.query.query;
    if (rawQuery !== undefined && typeof rawQuery !== 'string') {
      return res.status(400).json({ message: '검색어는 하나만 입력해 주세요.' });
    }
    const query = rawQuery || '혼밥';

    // 1-1. 대동명지도에서 검색어 매칭 식당 우선 추출
    const qLower = query.toLowerCase().trim();
    const isGeneralQuery =
      qLower === '혼밥' || qLower === '전체' || qLower === '맛집' || qLower === '식당' || qLower === '';

    let matchedDaedong: KakaoPlaceDocument[] = [];
    if (isGeneralQuery) {
      matchedDaedong = [...daedongPlaces];
    } else {
      // 메뉴 칸 검색어는 카카오 분류명과 단어가 달라(국밥 ↔ 해장국·곰탕) 같은 뜻의 단어로 넓혀 찾는다 (src/lib/searchRelevance.ts).
      const terms = searchTerms(query);
      matchedDaedong = daedongPlaces.filter((p) => matchesTerms(p, terms));
    }

    // 1-2. 카카오 로컬 API 3대 거점 실시간 검색 병렬 수행
    const hubs = [
      { name: '명지대 인문캠', x: MYONGJI_SEOUL_COORDS.x, y: MYONGJI_SEOUL_COORDS.y, radius: 800 },
      { name: '명지전문대', x: '126.9240', y: '37.5845', radius: 800 },
      { name: '백련시장', x: '126.9231', y: '37.5768', radius: 800 },
    ];

    const kakaoSearchTerm = isGeneralQuery ? '명지대 맛집' : `${query} 명지대`;

    const searchPromises = hubs.map((hub) =>
      searchPlacesByKeyword(kakaoSearchTerm, {
        x: hub.x,
        y: hub.y,
        radius: hub.radius,
        page: 1,
        size: 15,
      }).catch(() => null)
    );

    const hubResults = await Promise.all(searchPromises);

    // 1-3. 중복 식당 제거 및 병합
    const combinedPlaces: KakaoPlaceDocument[] = [];
    const existingIds = new Set<string>();
    const existingNames = new Set<string>();

    for (const place of matchedDaedong) {
      const normName = place.place_name.replace(/\s+/g, '');
      existingIds.add(place.id);
      existingNames.add(normName);
      combinedPlaces.push(place);
    }

    for (const result of hubResults) {
      if (!result || !result.documents) continue;
      // 메뉴판에 한 줄만 있어도 나오는 엉뚱한 식당(국밥 검색의 곱창집 등)과 술집·제과점을 거른다
      for (const place of filterKakaoResults(result.documents, query, isGeneralQuery)) {
        const normName = place.place_name.replace(/\s+/g, '');
        if (!existingIds.has(place.id) && !existingNames.has(normName)) {
          existingIds.add(place.id);
          existingNames.add(normName);
          combinedPlaces.push(place);
        }
      }
    }

    // 1-4. DB에서 리뷰 평점 및 평균 난이도 일괄 조회
    const placeIds = combinedPlaces.map((p) => p.id);
    let dbPlacesMap = new Map<string, any>();
    try {
      const dbPlaces = await prisma.place.findMany({
        where: { id: { in: placeIds } },
        select: {
          id: true,
          baseSoloLevel: true,
          avgSoloLevel: true,
          reviewCount: true,
        },
      });
      dbPlacesMap = new Map(dbPlaces.map((p) => [p.id, p]));
    } catch (err) {
      // DB 미연결 시 기본 데이터만 사용
    }

    // 1-5. 각 식당마다 Gemini AI 큐레이션 및 서버 단일화 난이도(displaySolo) 결합
    const placesWithCuration = await Promise.all(
      combinedPlaces.map(async (place) => {
        const curation = await getPlaceCuration(place);
        const dbPlace = dbPlacesMap.get(place.id);
        const baseLevel = dbPlace?.baseSoloLevel ?? curation?.soloLevel ?? 3;
        const displaySolo = calculateDisplaySoloLevel(
          baseLevel,
          dbPlace?.avgSoloLevel,
          dbPlace?.reviewCount || 0
        );

        return {
          ...place,
          curation,
          displaySolo,
        };
      })
    );

    res.json({
      success: true,
      meta: {
        total_count: placesWithCuration.length,
        pageable_count: placesWithCuration.length,
        is_end: true,
        daedong_count: matchedDaedong.length,
      },
      places: placesWithCuration,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. 식당 목록 조회 컨트롤러: GET /api/places
 * (DB의 Place 테이블 기반 목록 + 학우 평가 난이도 집계)
 */
export async function getPlaces(req: Request, res: Response, next: NextFunction) {
  try {
    const area = req.query.area as string;
    const soloLevel = req.query.soloLevel ? Number(req.query.soloLevel) : undefined;
    const search = req.query.query ? (req.query.query as string).trim() : undefined;

    const where: any = {};
    if (area && area !== '전체') {
      where.area = area;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const places = await prisma.place.findMany({
      where,
      orderBy: { reviewCount: 'desc' },
      take: 100,
    });

    const enriched = await Promise.all(
      places.map(async (p) => {
        const displaySolo = calculateDisplaySoloLevel(p.baseSoloLevel, p.avgSoloLevel, p.reviewCount);
        const curation = await getPlaceCuration({
          id: p.id,
          place_name: p.name,
          category_name: p.category,
          road_address_name: p.roadAddress,
        });

        return {
          ...p,
          displaySolo,
          curation,
        };
      })
    );

    // 난이도 필터링
    const filtered = soloLevel
      ? enriched.filter((p) => p.displaySolo.level === soloLevel)
      : enriched;

    res.status(200).json({
      totalCount: filtered.length,
      places: filtered,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. 식당 상세 정보 조회 컨트롤러: GET /api/places/:id
 * (기본 정보 + 최신 리뷰 5개 + 학우 평가 평균 난이도 + Gemini 큐레이션 통합)
 */
export async function getPlaceDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      res.status(400).json({ message: '식당 ID가 필요합니다.' });
      return;
    }

    // 3-1. DB에서 식당 조회 (DB 연결 환경에서는 리뷰 포함 실시간 조회, 미연결 시 정적 데이터 폴백)
    let placeData: any = null;
    if (process.env.DATABASE_URL) {
      try {
        placeData = await prisma.place.findUnique({
          where: { id },
          include: {
            reviews: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                userId: true,
                soloLevel: true,
                content: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    nickname: true,
                    isVerified: true,
                  },
                },
              },
            },
          },
        });
      } catch (err) {
        console.warn('ℹ️ [getPlaceDetail] DB 미연결로 정적 데이터로 폴백합니다.');
      }
    }

    // DB에 아직 없거나 미연결인 경우 대동명지도 정적 데이터에서 찾아서 안전하게 구성
    if (!placeData) {
      const foundInDaedong = daedongPlaces.find((p) => p.id === id);
      if (foundInDaedong) {
        placeData = {
          id: foundInDaedong.id,
          name: foundInDaedong.place_name,
          category: foundInDaedong.category_name,
          roadAddress: foundInDaedong.road_address_name || foundInDaedong.address_name,
          lat: parseFloat(foundInDaedong.y),
          lng: parseFloat(foundInDaedong.x),
          area: '명지대',
          baseSoloLevel: 3,
          avgSoloLevel: null,
          reviewCount: 0,
          reviews: [],
        };
      }
    }

    if (!placeData) {
      res.status(404).json({
        message: '식당 정보를 찾을 수 없습니다.',
      });
      return;
    }

    // 3-2. 화면 표시용 난이도 계산 (서버 단일 함수 호출)
    const displaySolo = calculateDisplaySoloLevel(
      placeData.baseSoloLevel,
      placeData.avgSoloLevel,
      placeData.reviewCount
    );

    // 3-3. Gemini AI 큐레이션 로드
    const curation = await getPlaceCuration({
      id: placeData.id,
      place_name: placeData.name,
      category_name: placeData.category,
      road_address_name: placeData.roadAddress,
    });

    res.status(200).json({
      place: {
        id: placeData.id,
        name: placeData.name,
        category: placeData.category,
        roadAddress: placeData.roadAddress,
        lat: placeData.lat,
        lng: placeData.lng,
        area: placeData.area,
      },
      displaySolo,
      curation,
      totalReviewCount: placeData.reviewCount,
      reviews: placeData.reviews || [],
    });
  } catch (error) {
    next(error);
  }
}
