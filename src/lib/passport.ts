/**
 * [이 파일이 하는 일]
 * Passport 및 LocalStrategy를 설정하여 세션 기반 사용자 로그인 및 인증을 처리합니다.
 * bcrypt를 사용하여 비밀번호 해시를 검증하고, serialize/deserialize를 통해 세션 상태를 유지합니다.
 */

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import prisma from './prisma.js';

// 세션에 저장될 유저 객체 타입 정의
export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  isVerified: boolean;
}

// Passport LocalStrategy 설정
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const cleanEmail = email.trim().toLowerCase();

        // 1. 사용자 조회
        const user = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });

        if (!user) {
          return done(null, false, { message: '가입되지 않은 이메일입니다.' });
        }

        // 2. 비밀번호 해시 비교
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return done(null, false, { message: '비밀번호가 일치하지 않습니다.' });
        }

        // 3. 인증 성공: 비밀번호 제외한 세션 객체 전달
        const sessionUser: SessionUser = {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          isVerified: user.isVerified,
        };

        return done(null, sessionUser);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// 세션에 저장할 데이터 (식별자 id만 저장하여 세션 용량 최소화)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// 세션의 id를 이용해 매 요청마다 사용자 정보를 복원
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nickname: true,
        isVerified: true,
      },
    });

    if (!user) {
      return done(null, false);
    }

    done(null, user as SessionUser);
  } catch (error) {
    done(error);
  }
});

export default passport;

