/**
 * [이 파일이 하는 일]
 * 회원가입, 로그인, 로그아웃, 학교 메일 인증 코드 발송 및 확인,
 * 내 정보 조회 요청을 받아 서비스 계층에 전달하고 HTTP 상태 코드를 응답하는 컨트롤러입니다.
 */

import type { RequestHandler } from 'express';
import passport from '../lib/passport.js';
import * as authService from '../services/auth.service.js';

// 09강 방식: Controller는 RequestHandler<경로 매개변수, 응답 본문, 요청 본문, 쿼리>로 타입을 지정한다
type NoParams = Record<string, never>;
type SignupBody = { email?: string; password?: string; nickname?: string };
type LoginBody = { email?: string; password?: string };
type VerifyBody = { code?: string };

/**
 * 1. 회원가입 컨트롤러: POST /api/auth/signup
 */
export const signup: RequestHandler<NoParams, unknown, SignupBody> = async (req, res, next) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
      message: '회원가입이 완료되었습니다. 학교 이메일로 발송된 6자리 인증 코드를 확인해주세요.',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. 로그인 컨트롤러: POST /api/auth/login
 */
export const login: RequestHandler<NoParams, unknown, LoginBody> = (req, res, next) => {
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
};

/**
 * 3. 로그아웃 컨트롤러: POST /api/auth/logout
 */
export const logout: RequestHandler<NoParams> = (req, res, next) => {
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
};

/**
 * 4. 내 정보 및 혼밥 레벨 조회: GET /api/auth/me
 */
export const getMe: RequestHandler<NoParams> = async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.user!.id);
    res.status(200).json({
      user: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. 인증 코드 재발송 컨트롤러: POST /api/auth/verify/send
 */
export const sendVerifyCode: RequestHandler<NoParams> = async (req, res, next) => {
  try {
    const result = await authService.sendVerificationCode(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * 6. 6자리 인증 코드 확인 컨트롤러: POST /api/auth/verify
 */
export const verifyEmail: RequestHandler<NoParams, unknown, VerifyBody> = async (req, res, next) => {
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
};
