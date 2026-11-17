/**
 * [이 파일이 하는 일]
 * Express 애플리케이션 전역에서 발생하는 에러를 한곳에서 잡아 처리하는 에러 핸들러 미들웨어입니다.
 * - 커스텀 에러(HttpError)의 상태 코드(400, 401, 403, 404, 409, 429 등)를 반영
 * - 모든 에러 응답은 { message: string } 규격 JSON 형식으로 통일
 */

import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  // 에러 상태 코드 결정 (기본값: 500)
  const knownDbError = err instanceof Prisma.PrismaClientKnownRequestError;
  const explicitStatus = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode <= 599;
  const statusCode = knownDbError
    ? err.code === 'P2002' ? 409 : err.code === 'P2025' ? 404 : 500
    : explicitStatus ? err.statusCode : 500;
  const message = knownDbError
    ? statusCode === 409 ? '이미 등록된 기록입니다.' : statusCode === 404 ? '대상을 찾을 수 없습니다.' : '데이터베이스 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    : explicitStatus ? err.message : '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

  if (statusCode >= 500) {
    console.error(`[ServerError 500] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[ClientError ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  // 모든 오류 응답은 { message } JSON 형식으로 반환
  res.status(statusCode).json({
    message,
  });
}
