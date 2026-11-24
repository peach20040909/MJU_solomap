/**
 * [이 파일이 하는 일]
 * 회원가입, 로그인, 로그아웃, 학교 메일 인증 코드 발송 및 확인,
 * 내 정보 조회 요청을 받아 서비스 계층에 전달하고 HTTP 상태 코드를 응답하는 컨트롤러입니다.
 */

import type { Request, Response, NextFunction } from 'express';
import passport from '../lib/passport.js';
import * as authService from '../services/auth.service.js';

/**
 * 1. 회원가입 컨트롤러: POST /api/auth/signup
 */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
      message: '회원가입이 완료되었습니다. 학교 이메일로 발송된 6자리 인증 코드를 확인해주세요.',
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. 로그인 컨트롤러: POST /api/auth/login
 */
export function login(req: Request, res: Response, next: NextFunction) {
  // 빈 입력은 Passport의 영어 'Missing credentials'(401) 대신 400으로 안내한다
  if (!req.body?.email || !req.body?.password) {
    return res.status(400).json({ message: '이메일과 비밀번호를 모두 입력해주세요.' });
  }
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        message: info?.message || '이메일 또는 비밀번호가 일치하지 않습니다.',
      });
    }

    req.login(user, (loginErr) => {
      if (loginErr) {
        return next(loginErr);
      }

      return res.status(200).json({
        message: '로그인되었습니다.',
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          isVerified: user.isVerified,
        },
      });
    });
  })(req, res, next);
}

/**
 * 3. 로그아웃 컨트롤러: POST /api/auth/logout
 */
export function logout(req: Request, res: Response, next: NextFunction) {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        return next(sessionErr);
      }

      // 세션 쿠키 삭제 (connect.sid)
      res.clearCookie('connect.sid');
      return res.status(204).send(); // 삭제 완료 시 204 No Content
    });
  });
}

/**
 * 4. 내 정보 및 혼밥 레벨 조회: GET /api/auth/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await authService.getUserProfile(req.user!.id);
    res.status(200).json({
      user: profile,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. 인증 코드 재발송 컨트롤러: POST /api/auth/verify/send
 */
export async function sendVerifyCode(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.sendVerificationCode(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * 6. 6자리 인증 코드 확인 컨트롤러: POST /api/auth/verify
 */
export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.verifyEmailCode(req.user!.id, req.body?.code);
    // 세션 정보의 isVerified도 즉시 true로 동기화
    if (req.user) {
      req.user.isVerified = true;
    }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
