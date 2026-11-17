/**
 * [이 파일이 하는 일]
 * 회원가입, 학교 메일 인증 코드 발송 및 검증, 프로필 조회 등
 * 사용자 인증과 관련된 핵심 비즈니스 로직을 처리하는 서비스 계층입니다.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { sendVerificationEmail } from '../lib/mailer.js';
import { calculateLevelFromCheckIns } from './level.service.js';

// HTTP 상태 코드와 메시지를 함께 전달하기 위한 커스텀 에러 클래스
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

// 6자리 난수 코드를 SHA-256으로 해싱하는 유틸리티
function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * 1. 회원가입 비즈니스 로직
 */
export async function registerUser(input: {
  email?: string;
  password?: string;
  nickname?: string;
}) {
  const { email, password, nickname } = input;

  // 1-1. 입력값 필수 검증 및 형식 체크
  if (!email || !password || !nickname) {
    throw new HttpError(400, '이메일, 비밀번호, 닉네임을 모두 입력해주세요.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanNickname = nickname.trim();

  // 명지대학교 웹메일 정규식 검사 (@mju.ac.kr)
  const mjuEmailRegex = /^[^@\s]+@mju\.ac\.kr$/;
  if (!mjuEmailRegex.test(cleanEmail)) {
    throw new HttpError(400, '학교 웹메일(@mju.ac.kr) 주소만 가입 가능합니다.');
  }

  // 비밀번호 길이 체크 (8자 이상)
  if (password.length < 8) {
    throw new HttpError(400, '비밀번호는 최소 8자 이상이어야 합니다.');
  }

  // 닉네임 길이 체크 (2~12자)
  if (cleanNickname.length < 2 || cleanNickname.length > 12) {
    throw new HttpError(400, '닉네임은 2자 이상 12자 이하여야 합니다.');
  }

  // 1-2. 중복 검사 (이메일 및 닉네임)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: cleanEmail }, { nickname: cleanNickname }],
    },
  });

  if (existingUser) {
    if (existingUser.email === cleanEmail) {
      throw new HttpError(409, '이미 가입된 학교 이메일입니다.');
    }
    if (existingUser.nickname === cleanNickname) {
      throw new HttpError(409, '이미 사용 중인 닉네임입니다.');
    }
  }

  // 1-3. 비밀번호 단방향 암호화 (bcrypt saltRounds: 10)
  const passwordHash = await bcrypt.hash(password, 10);

  // 1-4. 사용자 생성 (초기 상태: 미인증 isVerified = false)
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      nickname: cleanNickname,
      passwordHash,
      isVerified: false,
    },
    select: {
      id: true,
      email: true,
      nickname: true,
      isVerified: true,
      createdAt: true,
    },
  });

  // 이후 코드 저장·메일 발송이 실패하면 방금 만든 계정을 정리하여 재가입할 수 있게 한다.
  try {
    // 1-5. 6자리 인증 코드 생성 및 해시 저장
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 유효

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    // 1-6. 학교 웹메일로 코드 발송 (비동기 처리)
    await sendVerificationEmail(cleanEmail, code);
  } catch (error) {
    // User 삭제 시 EmailVerification은 스키마의 onDelete: Cascade로 함께 삭제된다.
    await prisma.user.delete({ where: { id: user.id } });
    throw error;
  }

  // 보안 규칙: 비밀번호 해시는 절대 응답하지 않음
  return user;
}

/**
 * 2. 인증 코드 재발송 비즈니스 로직 (재발송 제한: 60초)
 */
export async function sendVerificationCode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, '사용자를 찾을 수 없습니다.');
  }

  if (user.isVerified) {
    throw new HttpError(400, '이미 학교 이메일 인증이 완료된 계정입니다.');
  }

  // 최근 발송된 코드 확인 (60초 제한)
  const latestVerification = await prisma.emailVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (latestVerification) {
    const elapsedSeconds = (Date.now() - latestVerification.createdAt.getTime()) / 1000;
    if (elapsedSeconds < 60) {
      const waitTime = Math.ceil(60 - elapsedSeconds);
      throw new HttpError(429, `인증 코드는 ${waitTime}초 후에 다시 요청할 수 있습니다.`);
    }
  }

  // 새 6자리 코드 생성 및 해시 저장
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const newVerification = await prisma.emailVerification.create({
    data: {
      userId,
      codeHash,
      expiresAt,
      attempts: 0,
    },
  });

  try {
    await sendVerificationEmail(user.email, code);
  } catch (error) {
    // 발송에 실패한 코드만 지운다. 이전 코드의 유효성과 재발송 대기시간을 보존한다.
    await prisma.emailVerification.delete({ where: { id: newVerification.id } });
    throw error;
  }

  return { message: '인증 코드가 학교 메일로 발송되었습니다.' };
}

/**
 * 3. 6자리 인증 코드 확인 및 재학생 인증 완료 처리
 */
export async function verifyEmailCode(userId: string, code?: string) {
  if (!code || code.trim().length !== 6) {
    throw new HttpError(400, '6자리 인증 코드를 정확히 입력해주세요.');
  }

  const cleanCode = code.trim();

  // 사용자의 가장 최근 인증 레코드 조회
  const verification = await prisma.emailVerification.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    throw new HttpError(400, '발송된 인증 코드가 없습니다. 코드 재발송을 요청해주세요.');
  }

  // 만료 시간(10분) 또는 최대 시도 횟수(5회) 초과 여부 검사
  const now = new Date();
  if (now > verification.expiresAt || verification.attempts >= 5) {
    throw new HttpError(400, '인증 코드가 만료되었거나 시도 횟수를 초과했습니다. 재발송을 요청해주세요.');
  }

  // 코드 해시 일치 확인
  const inputHash = hashVerificationCode(cleanCode);
  if (inputHash !== verification.codeHash) {
    // 불일치 시 시도 횟수 증가
    const updatedAttempts = verification.attempts + 1;
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: updatedAttempts },
    });

    const remaining = Math.max(0, 5 - updatedAttempts);
    throw new HttpError(400, `인증 코드가 일치하지 않습니다. (남은 시도: ${remaining}회)`);
  }

  // 인증 성공 처리: User의 isVerified 플래그를 true로 갱신
  await prisma.user.update({
    where: { id: userId },
    data: { isVerified: true },
  });

  // 해당 사용자의 이전 인증 코드 기록 정리
  await prisma.emailVerification.deleteMany({
    where: { userId },
  });

  return { message: '학교 이메일(@mju.ac.kr) 인증이 성공적으로 완료되었습니다!' };
}

/**
 * 4. 내 정보 및 혼밥 레벨/칭호 조회
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      isVerified: true,
      createdAt: true,
      checkIns: {
        select: { levelAtVisit: true, placeId: true },
      },
      reviews: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, '사용자를 찾을 수 없습니다.');
  }

  // 레벨 서비스의 단일화 함수를 호출하여 정확한 레벨 및 칭호 산정
  const levelData = calculateLevelFromCheckIns(user.checkIns);

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    level: levelData.level,
    title: levelData.title,
    exp: levelData.exp,
    nextLevelExp: levelData.nextLevelExp,
    progressPercent: levelData.progressPercent,
    conqueredPlaceCount: levelData.conqueredPlaceCount,
    visitCount: levelData.visitCount,
    reviewCount: user.reviews.length,
  };
}

