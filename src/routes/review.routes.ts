/**
 * [이 파일이 하는 일]
 * 식당별 혼밥 난이도 및 리뷰 생성/조회/수정/삭제(CRUD) 엔드포인트를 정의하는 라우터입니다.
 */

import { Router } from 'express';
import {
  createReview,
  getPlaceReviews,
  updateReview,
  deleteReview,
  getMyReviews,
} from '../controllers/review.controller.js';
import { requireAuth, requireVerified } from '../middlewares/auth.middleware.js';

export const reviewRouter = Router();

// 1. 리뷰 작성: POST /api/reviews (학교 메일 인증된 학우만 가능)
reviewRouter.post('/', requireAuth, requireVerified, createReview);

// 2. 내가 작성한 리뷰 목록 조회: GET /api/reviews/me
reviewRouter.get('/me', requireAuth, getMyReviews);

// 3. 특정 식당의 리뷰 목록 조회: GET /api/reviews/place/:placeId (누구나 가능)
reviewRouter.get('/place/:placeId', getPlaceReviews);

// 4. 리뷰 수정: PATCH /api/reviews/:id (본인 작성 리뷰만 가능)
reviewRouter.patch('/:id', requireAuth, requireVerified, updateReview);

// 5. 리뷰 삭제: DELETE /api/reviews/:id (본인 작성 리뷰만 가능)
reviewRouter.delete('/:id', requireAuth, requireVerified, deleteReview);
