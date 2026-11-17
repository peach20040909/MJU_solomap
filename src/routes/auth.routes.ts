/**
 * [이 파일이 하는 일]
 * 사용자 회원가입, 로그인, 로그아웃, 재학생 이메일 인증, 내 정보 조회 라우팅을 정의합니다.
 */

import { Router } from 'express';
import {
  signup,
  login,
  logout,
  getMe,
  sendVerifyCode,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

// 1. 회원가입: POST /api/auth/signup
authRouter.post('/signup', signup);

// 2. 로그인: POST /api/auth/login
authRouter.post('/login', login);

// 3. 로그아웃: POST /api/auth/logout
authRouter.post('/logout', logout);

// 4. 내 정보 및 레벨 조회: GET /api/auth/me (로그인 필수)
authRouter.get('/me', requireAuth, getMe);

// 5. 학교 메일 인증 코드 재발송: POST /api/auth/verify/send (로그인 필수)
authRouter.post('/verify/send', requireAuth, sendVerifyCode);

// 6. 6자리 인증 코드 확인: POST /api/auth/verify (로그인 필수)
authRouter.post('/verify', requireAuth, verifyEmail);
