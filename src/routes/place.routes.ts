/**
 * [이 파일이 하는 일]
 * 식당(장소) 검색, 목록 조회, 상세 조회 및 식당별 리뷰 조회에 관한 URL 라우트를 정의하는 라우터입니다.
 */

import { Router } from 'express';
import {
  searchPlaces,
  getPlaces,
  getPlaceDetail,
} from '../controllers/place.controller.js';
import { getPlaceReviews } from '../controllers/review.controller.js';
import { createCheckIn } from '../controllers/checkin.controller.js';
import { requireAuth, requireVerified } from '../middlewares/auth.middleware.js';

export const placeRouter = Router();

// 1. 식당 키워드 검색: GET /api/places/search?query=검색어
placeRouter.get('/search', searchPlaces);

// 2. 식당 목록 조회: GET /api/places?area=명지대&soloLevel=2
placeRouter.get('/', getPlaces);

// 3. 특정 식당의 리뷰 목록 조회: GET /api/places/:id/reviews (누구나 조회 가능)
placeRouter.get('/:id/reviews', getPlaceReviews);

// 4. 식당 상세 정보 조회: GET /api/places/:id
placeRouter.get('/:id', getPlaceDetail);

// 5. 식당 방문 체크인('다녀왔어요'): POST /api/places/:id/checkins (학교 인증 학우 필수)
placeRouter.post('/:id/checkins', requireAuth, requireVerified, createCheckIn);

