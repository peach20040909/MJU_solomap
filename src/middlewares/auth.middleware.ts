/**
 * [이 파일이 하는 일]
 * 특정 API 요청에 대해 로그인 여부 및 학교 웹메일(@mju.ac.kr) 인증 여부를 검증하는 미들웨어입니다.
 * - requireAuth: 로그인 여부 확인 (미로그인 시 401 반환)
 * - requireVerified: 학교 이메일 인증 여부 확인 (미인증 시 403 반환)
 */

import type { Request, Response, NextFunction } from 'express';

// Express Request의 user 인터페이스 확장 (TypeScript 호환)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      nickname: string;
      isVerified: boolean;
    }
  }
}

/**
 * 1. 로그인 필수 검증 미들웨어
 * 비로그인 시 401 Unauthorized 반환
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({
      message: '로그인이 필요한 서비스입니다.',
    });
    return;
  }

  next();
}

/**
 * 2. 명지대학교 웹메일(@mju.ac.kr) 재학생 인증 필수 검증 미들웨어
 * - 비로그인 시: 401 Unauthorized 반환
 * - 로그인했지만 학교 인증이 안 된 경우: 403 Forbidden 반환
 */
export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({
      message: '로그인이 필요한 서비스입니다.',
    });
    return;
  }

  const user = req.user;
  if (!user || !user.isVerified) {
    res.status(403).json({
      message: '학교 메일(@mju.ac.kr) 인증 후 이용 가능합니다.',
    });
    return;
  }

  next();
}
