/**
 * [이 파일이 하는 일]
 * 식당 방문 체크인('다녀왔어요') 및 혼밥 레벨/칭호/추천 조회 요청을 처리하는 컨트롤러입니다.
 */

import type { Request, Response, NextFunction } from 'express';
import * as levelService from '../services/level.service.js';

function getParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

/**
 * 1. 식당 방문 체크인: POST /api/places/:id/checkins
 * (학교 메일 인증된 학우만 가능, 당일 동일 식당 중복 체크인 방지 409)
 */
export async function createCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const placeId = getParam(req.params.id);
    const result = await levelService.checkInPlace(req.user!.id, placeId);

    res.status(201).json({
      message: '체크인이 완료되었습니다! 혼밥 경험치를 획득했습니다.',
      checkIn: result.checkIn,
      levelInfo: result.levelInfo,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. 내 혼밥 레벨 정보 조회: GET /api/users/me/level
 */
export async function getMyLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const levelInfo = await levelService.getUserLevelInfo(req.user!.id);
    res.status(200).json({
      levelInfo,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. 내가 정복(체크인)한 식당 목록 조회: GET /api/users/me/checkins
 */
export async function getMyCheckIns(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await levelService.getUserConqueredPlaces(req.user!.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

/**
 * 4. 내 레벨에 맞춘 다음 도전 추천 식당 3곳 조회: GET /api/users/me/recommendations
 */
export async function getMyRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await levelService.getRecommendedPlaces(req.user!.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

