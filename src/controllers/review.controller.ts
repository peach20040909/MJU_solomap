/**
 * [이 파일이 하는 일]
 * 혼밥 리뷰의 등록, 특정 식당 리뷰 조회, 수정, 삭제(CRUD) 및 내 리뷰 조회 요청을 받아
 * 서비스 계층과 연동하고 적절한 HTTP 상태 코드(200, 201, 204, 400, 403, 404, 409)를 응답하는 컨트롤러입니다.
 */

import type { Request, Response, NextFunction } from 'express';
import * as reviewService from '../services/review.service.js';

// Express 5 파라미터 안전 추출 헬퍼 (string | string[] 대응)
function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

/**
 * 1. 리뷰 작성 컨트롤러: POST /api/reviews
 * (학교 메일 인증을 마친 학우만 등록 가능, 1인 1리뷰 제약)
 */
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const review = await reviewService.createReview(req.user!.id, req.body);
    res.status(201).json({
      message: '리뷰가 성공적으로 등록되었습니다.',
      review,
    });
  } catch (error: any) {
    // 1인 1리뷰 중복(409)인 경우 프론트에서 수정 모달로 전환할 수 있도록 reviewId 전달
    if (error.statusCode === 409 && error.reviewId) {
      res.status(409).json({
        message: error.message,
        reviewId: error.reviewId,
      });
      return;
    }
    next(error);
  }
}

/**
 * 2. 특정 식당의 리뷰 목록 조회: GET /api/places/:id/reviews 또는 GET /api/reviews/place/:placeId
 * (누구나 조회 가능, 최신순)
 */
export async function getPlaceReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const rawPlaceId = req.params.placeId || req.params.id;
    const placeId = getParam(rawPlaceId);
    const reviews = await reviewService.getReviewsByPlace(placeId);

    res.status(200).json({
      placeId,
      totalCount: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. 리뷰 수정 컨트롤러: PATCH /api/reviews/:id
 * (본인이 작성한 리뷰만 수정 가능)
 */
export async function updateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParam(req.params.id);
    const review = await reviewService.updateReview(req.user!.id, id, req.body);

    res.status(200).json({
      message: '리뷰가 수정되었습니다.',
      review,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. 리뷰 삭제 컨트롤러: DELETE /api/reviews/:id
 * (본인이 작성한 리뷰만 삭제 가능, 삭제 완료 시 204 No Content)
 */
export async function deleteReview(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParam(req.params.id);
    await reviewService.deleteReview(req.user!.id, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * 5. 내가 작성한 리뷰 목록 조회 컨트롤러: GET /api/users/me/reviews
 */
export async function getMyReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const reviews = await reviewService.getMyReviews(req.user!.id);
    res.status(200).json({
      totalCount: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
}
