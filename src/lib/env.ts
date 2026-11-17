/** 로컬 폴백과 실제 배포 환경을 구분한다. 값은 오류 메시지에 포함하지 않는다. */
export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview';
}

export function validateRuntimeEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionEnvironment(env)) return;
  const required = ['DATABASE_URL', 'SESSION_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error(`운영 환경 필수 설정 누락: ${missing.join(', ')}`);

  // 약한 세션 키와 잘못된 SMTP 포트로 운영 서버가 시작되는 것을 방지한다.
  if (env.SESSION_SECRET!.trim().length < 32 || env.SESSION_SECRET === 'solo-map-super-secret-mju-session-2026') {
    throw new Error('SESSION_SECRET은 개발용 기본값이 아닌 32자 이상의 임의 값이어야 합니다.');
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT는 1~65535 정수여야 합니다.');
  let validDatabaseUrl = false;
  try { validDatabaseUrl = ['postgres:', 'postgresql:'].includes(new URL(env.DATABASE_URL!).protocol); } catch { /* 아래 공통 오류 */ }
  if (!validDatabaseUrl) throw new Error('DATABASE_URL에 PostgreSQL 접속 URL을 설정해주세요.');
}
