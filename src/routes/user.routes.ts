/**
 * [이 파일이 하는 일]
 * 로그인된 사용자의 마이페이지 관련 데이터(내가 쓴 리뷰, 혼밥 레벨, 정복한 식당, 맞춤 추천 등) 라우터입니다.
 */

import { Router } from 'express';
import { getMyReviews } from '../controllers/review.controller.js';
import { getMe } from '../controllers/auth.controller.js';
import {
  getMyLevel,
  getMyCheckIns,
  getMyRecommendations,
} from '../controllers/checkin.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const userRouter = Router();

// 1. 내 기본 정보 및 프로필 조회: GET /api/users/me
userRouter.get('/me', requireAuth, getMe);

// 2. 내가 작성한 혼밥 리뷰 목록: GET /api/users/me/reviews
userRouter.get('/me/reviews', requireAuth, getMyReviews);

// 3. 내 혼밥 레벨, 경험치, 칭호, 진행도: GET /api/users/me/level
userRouter.get('/me/level', requireAuth, getMyLevel);

// 4. 내가 정복(체크인)한 식당 목록 및 방문 횟수: GET /api/users/me/checkins
userRouter.get('/me/checkins', requireAuth, getMyCheckIns);

// 5. 다음 레벨 도전을 위한 맞춤 식당 3곳 추천: GET /api/users/me/recommendations
userRouter.get('/me/recommendations', requireAuth, getMyRecommendations);
