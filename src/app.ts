/**
 * [이 파일이 하는 일]
 * Express 5 서버의 메인 진입점(Entry Point) 파일입니다.
 * 세션 및 Passport 인증 미들웨어, 라우터 연결, 에러 처리기 및 서버 포트 리스닝을 담당합니다.
 */

import 'dotenv/config'; // .env 파일의 환경변수를 process.env로 불러옵니다.
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from './lib/passport.js';
import { isProductionEnvironment, validateRuntimeEnv } from './lib/env.js';
import { pgConnectionString } from './lib/database.js';

import { authRouter } from './routes/auth.routes.js';
import { placeRouter } from './routes/place.routes.js';
import { reviewRouter } from './routes/review.routes.js';
import { userRouter } from './routes/user.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

// 라우터/세션을 사용하기 전에 운영 필수 설정을 검사한다. 로컬 탐색은 기존대로 허용한다.
validateRuntimeEnv();
const app = express();
const PORT = process.env.PORT || 3000;

// Vercel 및 리버스 프록시 환경에서 HTTPS 및 클라이언트 IP를 올바르게 신뢰
app.set('trust proxy', 1);

// 1. 공통 전역 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 2. 세션 스토어 및 express-session 설정
const PgSession = connectPgSimple(session);
// Prisma의 sslcert는 서버 CA이지만 node-postgres에서는 클라이언트 인증서다.
// 세션 연결은 같은 CA를 sslrootcert로 전달하고 인증서·호스트 검증을 유지한다.
const sessionUrl = process.env.DATABASE_URL ? pgConnectionString(process.env.DATABASE_URL) : null;
// DATABASE_URL이 설정된 경우 PostgreSQL Session 테이블 사용, 미설정 시 개발용 메모리 스토어 폴백
const sessionStore = process.env.DATABASE_URL
  ? new PgSession({
      conString: sessionUrl!,
      tableName: 'Session',
      createTableIfMissing: false,
    })
  : undefined;

const isProduction = isProductionEnvironment();

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'solo-map-super-secret-mju-session-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // XSS 방지
      sameSite: 'lax', // CSRF 방지 및 크로스 사이트 탐색 호환
      secure: isProduction, // HTTPS 배포 환경에서만 쿠키 전송
      maxAge: 7 * 24 * 60 * 60 * 1000, // 쿠키 유효 기간 7일
    },
  })
);

// 3. Passport 미들웨어 초기화 및 세션 연결
app.use(passport.initialize());
app.use(passport.session());

// 4. 헬스체크 및 공개 설정 엔드포인트
app.get(['/api/health', '/health'], (req, res) => {
  res.send('solo-map API running');
});

app.get(['/api/config', '/config'], (req, res) => {
  res.json({
    naverClientId: process.env.NAVER_CLIENT_ID || '',
    // 비밀값 없이 설정 여부만 공개한다. DB 연결 성공을 보장하는 건강 검사는 아니다.
    accountConfigured: Boolean(process.env.DATABASE_URL?.trim() && process.env.SESSION_SECRET?.trim()),
  });
});

// 5. 기능별 라우터 등록 (로컬 및 Vercel 서버리스 라우팅 호환)
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/places', placeRouter);
app.use('/places', placeRouter);

app.use('/api/reviews', reviewRouter);
app.use('/reviews', reviewRouter);

app.use('/api/users', userRouter);
app.use('/users', userRouter);

// 6. 전역 에러 핸들러 미들웨어 등록 (라우터 하단에 위치)
app.use(errorHandler);

// 7. 서버 포트 리스닝 (로컬 개발 환경)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` 혼밥 난이도 지도 (solo-map) 서버 실행 중!`);
    console.log(` 포트: http://localhost:${PORT}`);
    console.log(`=========================================`);
  });
}

export default app;
