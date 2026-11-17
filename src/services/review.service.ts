/**
 * [이 파일이 하는 일]
 * 혼밥 리뷰의 등록, 수정, 삭제, 조회 및
 * 식당별 평균 혼밥 난이도 자동 재계산 트랜잭션을 처리하는 서비스입니다.
 */

import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { HttpError } from './auth.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 5단계 혼밥 난이도 라벨 표준 상수
export const SOLO_LEVEL_LABELS: Record<number, string> = {
  1: 'Lv.1 입문 혼밥',
  2: 'Lv.2 혼밥 성지',
  3: 'Lv.3 일반 밥집',
  4: 'Lv.4 다인석 식당',
  5: 'Lv.5 혼밥 끝판왕',
};

/**
 * [단일화된 난이도 계산 함수]
 * 화면에 보여줄 난이도를 서버 한 곳에서만 계산:
 * - 리뷰가 1개 이상이면: avgSoloLevel 반올림 + "(학우평가)" 라벨 부여
 * - 리뷰가 없으면: baseSoloLevel 기본 난이도 표시
 */
export function calculateDisplaySoloLevel(
  baseSoloLevel: number,
  avgSoloLevel: number | null | undefined,
  reviewCount: number = 0
) {
  if (reviewCount > 0 && typeof avgSoloLevel === 'number' && !isNaN(avgSoloLevel)) {
    const rounded = Math.min(5, Math.max(1, Math.round(avgSoloLevel)));
    return {
      level: rounded,
      rawAvg: Number(avgSoloLevel.toFixed(1)),
      label: `${SOLO_LEVEL_LABELS[rounded] || `Lv.${rounded}`} (학우평가)`,
      isStudentEvaluated: true,
      reviewCount,
    };
  }

  const safeBase = Math.min(5, Math.max(1, baseSoloLevel || 3));
  return {
    level: safeBase,
    rawAvg: null,
    label: SOLO_LEVEL_LABELS[safeBase] || `Lv.${safeBase}`,
    isStudentEvaluated: false,
    reviewCount: 0,
  };
}

// 필요 시 식당이 DB에 없으면 daedongPlaces.json에서 찾아 자동 생성하는 헬퍼
async function ensurePlaceExists(placeId: string) {
  const existing = await prisma.place.findUnique({ where: { id: placeId } });
  if (existing) return existing;

  // DB에 없으면 JSON 파일에서 검색
  try {
    const daedongPath = path.resolve(__dirname, '../data/daedongPlaces.json');
    if (fs.existsSync(daedongPath)) {
      const places = JSON.parse(fs.readFileSync(daedongPath, 'utf-8'));
      const found = places.find((p: any) => String(p.id) === placeId);
      if (found) {
        return await prisma.place.create({
          data: {
            id: String(found.id),
            name: found.place_name,
            category: found.category_name,
            roadAddress: found.road_address_name || found.address_name || '주소 정보 없음',
            lat: parseFloat(found.y) || 37.5802,
            lng: parseFloat(found.x) || 126.9234,
            area: '명지대',
            baseSoloLevel: 3,
            reviewCount: 0,
          },
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ [ensurePlaceExists] JSON 탐색 실패:', err);
  }

  throw new HttpError(404, '존재하지 않는 식당입니다.');
}

/**
 * 1. 특정 식당의 리뷰 목록 조회 (누구나 조회 가능, 최신순)
 */
export async function getReviewsByPlace(placeId: string) {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const reviews = await prisma.review.findMany({
    where: { placeId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      placeId: true,
      soloLevel: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          nickname: true,
          isVerified: true,
        },
      },
    },
  });

  return reviews;
}

/**
 * 2. 혼밥 리뷰 작성 (1인 1식당 1리뷰 제약 + 난이도 자동 갱신 트랜잭션)
 */
export async function createReview(
  userId: string,
  input: { placeId?: string; soloLevel?: number; content?: string }
) {
  const { placeId, soloLevel, content } = input;

  if (!placeId) {
    throw new HttpError(400, '식당 ID(placeId)가 필요합니다.');
  }

  const levelNum = Number(soloLevel);
  if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 5) {
    throw new HttpError(400, '혼밥 난이도는 1~5 사이의 정수여야 합니다.');
  }

  const cleanContent = content ? content.trim() : '';
  if (cleanContent.length < 1 || cleanContent.length > 500) {
    throw new HttpError(400, '리뷰 내용은 1자 이상 500자 이하로 작성해주세요.');
  }

  // 대상 식당 존재 확인 또는 자동 연동
  await ensurePlaceExists(placeId);

  // 1인 1리뷰 제약 검사: 이미 작성한 리뷰가 있는지 확인
  const existingReview = await prisma.review.findUnique({
    where: {
      userId_placeId: { userId, placeId },
    },
  });

  if (existingReview) {
    // 프론트엔드가 기존 리뷰 수정 모달로 전환할 수 있도록 reviewId를 함께 에러로 전달
    const conflictError: any = new HttpError(
      409,
      '이미 이 식당에 작성한 리뷰가 있습니다. 기존 리뷰를 수정해주세요.'
    );
    conflictError.reviewId = existingReview.id;
    throw conflictError;
  }

  // 리뷰 생성과 식당 평균 난이도 갱신을 한 번의 트랜잭션으로 원자적 처리
  const result = await prisma.$transaction(async (tx) => {
    // 1. 리뷰 레코드 생성
    const newReview = await tx.review.create({
      data: {
        userId,
        placeId,
        soloLevel: levelNum,
        content: cleanContent,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            isVerified: true,
          },
        },
      },
    });

    // 2. 이 식당의 리뷰 난이도 평균 및 총 리뷰 수 집계
    const agg = await tx.review.aggregate({
      where: { placeId },
      _avg: { soloLevel: true },
      _count: { id: true },
    });

    // 3. Place 테이블의 avgSoloLevel, reviewCount 즉시 갱신
    await tx.place.update({
      where: { id: placeId },
      data: {
        avgSoloLevel: agg._avg.soloLevel,
        reviewCount: agg._count.id,
      },
    });

    return newReview;
  }).catch(async (error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // 사전 조회 이후 다른 요청이 먼저 저장한 경우도 기존 수정 전환을 지원한다.
      const existing = await prisma.review.findUnique({ where: { userId_placeId: { userId, placeId } } });
      if (existing) {
        throw Object.assign(new HttpError(409, '이미 이 식당에 작성한 리뷰가 있습니다. 기존 리뷰를 수정해주세요.'), { reviewId: existing.id });
      }
    }
    throw error;
  });

  return result;
}

/**
 * 3. 혼밥 리뷰 수정 (작성자 본인 검증 + 난이도 자동 갱신 트랜잭션)
 */
export async function updateReview(
  userId: string,
  reviewId: string,
  input: { soloLevel?: number; content?: string }
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new HttpError(404, '존재하지 않는 리뷰입니다.');
  }

  // 본인 작성 여부 권한 검사
  if (review.userId !== userId) {
    throw new HttpError(403, '본인이 작성한 리뷰만 수정할 수 있습니다.');
  }

  const updateData: { soloLevel?: number; content?: string } = {};

  if (input.soloLevel !== undefined) {
    const levelNum = Number(input.soloLevel);
    if (!Number.isInteger(levelNum) || levelNum < 1 || levelNum > 5) {
      throw new HttpError(400, '혼밥 난이도는 1~5 사이의 정수여야 합니다.');
    }
    updateData.soloLevel = levelNum;
  }

  if (input.content !== undefined) {
    const cleanContent = input.content.trim();
    if (cleanContent.length < 1 || cleanContent.length > 500) {
      throw new HttpError(400, '리뷰 내용은 1자 이상 500자 이하로 작성해주세요.');
    }
    updateData.content = cleanContent;
  }

  // 리뷰 수정 및 식당 평균 난이도 재계산 트랜잭션
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            isVerified: true,
          },
        },
      },
    });

    // 식당 평균 난이도 다시 계산
    const agg = await tx.review.aggregate({
      where: { placeId: review.placeId },
      _avg: { soloLevel: true },
      _count: { id: true },
    });

    await tx.place.update({
      where: { id: review.placeId },
      data: {
        avgSoloLevel: agg._avg.soloLevel,
        reviewCount: agg._count.id,
      },
    });

    return res;
  });

  return updated;
}

/**
 * 4. 혼밥 리뷰 삭제 (작성자 본인 검증 + 난이도 자동 갱신 트랜잭션)
 */
export async function deleteReview(userId: string, reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new HttpError(404, '존재하지 않는 리뷰입니다.');
  }

  // 본인 작성 여부 권한 검사
  if (review.userId !== userId) {
    throw new HttpError(403, '본인이 작성한 리뷰만 삭제할 수 있습니다.');
  }

  // 리뷰 삭제 및 식당 평균 난이도 재계산 트랜잭션
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({
      where: { id: reviewId },
    });

    const agg = await tx.review.aggregate({
      where: { placeId: review.placeId },
      _avg: { soloLevel: true },
      _count: { id: true },
    });

    // 리뷰가 0개가 되면 avgSoloLevel을 null로 리셋
    await tx.place.update({
      where: { id: review.placeId },
      data: {
        avgSoloLevel: agg._count.id > 0 ? agg._avg.soloLevel : null,
        reviewCount: agg._count.id,
      },
    });
  });

  return true;
}

/**
 * 5. 내가 작성한 리뷰 목록 조회
 */
export async function getMyReviews(userId: string) {
  const reviews = await prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      place: {
        select: {
          id: true,
          name: true,
          category: true,
          roadAddress: true,
          area: true,
          baseSoloLevel: true,
          avgSoloLevel: true,
          reviewCount: true,
        },
      },
    },
  });

  return reviews.map((r) => ({
    ...r,
    displaySolo: calculateDisplaySoloLevel(
      r.place.baseSoloLevel,
      r.place.avgSoloLevel,
      r.place.reviewCount
    ),
  }));
}
