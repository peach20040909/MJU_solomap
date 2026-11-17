/** 외부 메일/DB를 변경하지 않고 SMTP 경계·운영 설정·실패 복구를 검증한다. */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

await test('운영 전 검증', async t => {
  const savedEnv = { ...process.env };
  const logs: string[] = [];
  const realLog = console.log, realWarn = console.warn, realError = console.error;
  let rejectMail = false;
  const delivered: string[] = [];
  const server = createServer(socket => {
    let buffer = '', dataMode = false, data = '';
    socket.write('220 localhost SMTP fixture\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (dataMode) {
          if (line === '.') {
            dataMode = false; delivered.push(data); data = '';
            socket.write(rejectMail ? '550 fixture rejects mail\r\n' : '250 accepted\r\n');
          } else data += line + '\r\n';
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n');
        else if (/^DATA/.test(line)) { dataMode = true; socket.write('354 send data\r\n'); }
        else if (/^QUIT/.test(line)) { socket.end('221 bye\r\n'); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  try {
    await t.test('운영 설정이 없으면 앱 시작을 거부한다', () => {
      const env = { ...process.env, NODE_ENV: 'production', VERCEL: '1', DATABASE_URL: '', DIRECT_URL: '', SESSION_SECRET: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '' };
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./src/app.ts')"], { env, encoding: 'utf8', timeout: 15000 });
      assert.notEqual(child.status, 0, 'DB 없는 운영 앱이 메모리 세션으로 시작하면 안 됨');
      assert.match(child.stderr, /DATABASE_URL/);
      assert.match(child.stderr, /SESSION_SECRET/);
    });
    await t.test('Vercel Preview도 개발 폴백을 허용하지 않는다', () => {
      const env = { ...process.env, NODE_ENV: 'development', VERCEL_ENV: 'preview', VERCEL: '1', DATABASE_URL: '', SESSION_SECRET: '', SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '' };
      const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./src/app.ts')"], { env, encoding: 'utf8', timeout: 15000 });
      assert.notEqual(child.status, 0);
      assert.match(child.stderr, /DATABASE_URL/);
    });
    await t.test('운영 설정 검사: 올바른 값 허용, 약한 세션 키와 잘못된 포트 거부', async () => {
      const { validateRuntimeEnv } = await import('../src/lib/env.js');
      const valid = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://fixture:fixture@localhost:5432/fixture', SESSION_SECRET: 'a-unique-fixture-key-with-at-least-32-characters', SMTP_HOST: '127.0.0.1', SMTP_PORT: '587', SMTP_USER: 'fixture', SMTP_PASS: 'fixture-password', MAIL_FROM: 'fixture@localhost' };
      assert.doesNotThrow(() => validateRuntimeEnv(valid));
      assert.throws(() => validateRuntimeEnv({ ...valid, SESSION_SECRET: 'short' }), /SESSION_SECRET/);
      assert.throws(() => validateRuntimeEnv({ ...valid, SMTP_PORT: '0' }), /SMTP_PORT/);
      assert.throws(() => validateRuntimeEnv({ ...valid, SMTP_PORT: 'not-a-port' }), /SMTP_PORT/);
      assert.throws(() => validateRuntimeEnv({ ...valid, DATABASE_URL: 'https://example.com' }), /DATABASE_URL/);
    });

    const { sendVerificationEmail } = await import('../src/lib/mailer.js');
    console.log = console.warn = console.error = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    await t.test('운영 SMTP 누락은 성공 대신 503', async () => {
      await assert.rejects(sendVerificationEmail('fixture@mju.ac.kr', '654321'), (e: any) => e.statusCode === 503);
      assert(!logs.join('\n').includes('654321'), '운영 코드 로그 금지');
    });
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(address.port), SMTP_USER: 'fixture', SMTP_PASS: 'fixture-password', MAIL_FROM: 'fixture@localhost' });
    await t.test('SMTP 성공 시 전송하고 운영 코드 로그를 남기지 않는다', async () => {
      logs.length = 0;
      assert.equal(await sendVerificationEmail('fixture@mju.ac.kr', '654321'), true);
      assert(delivered.at(-1)?.includes('654321'));
      assert(!logs.join('\n').includes('654321'), '운영 코드 로그 금지');
    });
    rejectMail = true;
    await t.test('SMTP 거절은 내부 오류를 노출하지 않는 503', async () => {
      await assert.rejects(sendVerificationEmail('fixture@mju.ac.kr', '654321'), (e: any) => e.statusCode === 503 && !e.message.includes('fixture rejects') && !e.message.includes('fixture-password'));
    });

    // 실제 DB가 없어 Prisma 입출력 경계만 메모리 저장소로 대체한다. 서비스·해싱·SMTP는 실제 코드.
    const { default: prisma } = await import('../src/lib/prisma.js');
    const auth = await import('../src/services/auth.service.js');
    let createdUser: any = null;
    const codes = new Map<string, any>();
    const original = {
      userFindFirst: prisma.user.findFirst, userCreate: prisma.user.create, userDelete: prisma.user.delete,
      userFindUnique: prisma.user.findUnique, codeCreate: prisma.emailVerification.create,
      codeDelete: prisma.emailVerification.delete, codeFindFirst: prisma.emailVerification.findFirst,
    };
    Object.assign(prisma.user, {
      findFirst: async () => createdUser,
      create: async ({ data }: any) => (createdUser = { id: 'new-user', ...data }),
      delete: async () => { const previous = createdUser; createdUser = null; codes.clear(); return previous; },
      findUnique: async () => ({ id: 'existing-user', email: 'fixture@mju.ac.kr', isVerified: false }),
    });
    Object.assign(prisma.emailVerification, {
      create: async ({ data }: any) => { const code = { id: 'new-code', ...data, createdAt: new Date() }; codes.set(code.id, code); return code; },
      delete: async ({ where }: any) => { const code = codes.get(where.id); codes.delete(where.id); return code; },
      findFirst: async () => Array.from(codes.values()).at(-1) || null,
    });
    try {
      await t.test('가입 메일 실패 후 이번 계정과 코드 정리', async () => {
        await assert.rejects(auth.registerUser({ email: 'fixture@mju.ac.kr', password: 'Password1234!', nickname: '메일테스트' }), (e: any) => e.statusCode === 503);
        assert.equal(createdUser, null, '메일 실패 계정이 남아 재가입을 막으면 안 됨');
        assert.equal(codes.size, 0);
      });
      await t.test('재발송 실패 후 이전 코드는 보존하고 실패 코드만 정리', async () => {
        codes.clear();
        codes.set('old-code', { id: 'old-code', codeHash: 'old-hash', createdAt: new Date(Date.now() - 61000) });
        await assert.rejects(auth.sendVerificationCode('existing-user'), (e: any) => e.statusCode === 503);
        assert.deepEqual([...codes.keys()], ['old-code']);
        rejectMail = false;
        await auth.sendVerificationCode('existing-user');
        assert(codes.has('new-code'), '실패 직후 새 요청은 429 없이 재시도 가능');
      });
      await t.test('실제 가입 HTTP 경로에서 메일 거절은 안전한 503 JSON', async () => {
        createdUser = null; codes.clear(); rejectMail = true;
        Object.assign(process.env, { VERCEL: '1', DATABASE_URL: 'postgresql://fixture:fixture@localhost:5432/fixture', SESSION_SECRET: 'a-unique-fixture-key-with-at-least-32-characters' });
        const { default: app } = await import('../src/app.js');
        const http = app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => http.once('listening', resolve));
        try {
          const port = http.address(); assert(port && typeof port !== 'string');
          const response = await fetch(`http://127.0.0.1:${port.port}/api/auth/signup`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'fixture@mju.ac.kr', password: 'Password1234!', nickname: '메일테스트' }),
          });
          assert.equal(response.status, 503);
          const body = await response.json();
          assert.deepEqual(Object.keys(body), ['message']);
          assert(!body.message.includes('fixture rejects'));
          assert.equal(createdUser, null);
          assert.equal(codes.size, 0);
        } finally { await new Promise<void>(resolve => http.close(() => resolve())); }
      });
    } finally {
      Object.assign(prisma.user, { findFirst: original.userFindFirst, create: original.userCreate, delete: original.userDelete, findUnique: original.userFindUnique });
      Object.assign(prisma.emailVerification, { create: original.codeCreate, delete: original.codeDelete, findFirst: original.codeFindFirst });
      await prisma.$disconnect();
    }
    await t.test('로컬 SMTP 미설정에서만 콘솔 코드를 허용한다', async () => {
      process.env.NODE_ENV = 'development'; delete process.env.VERCEL_ENV;
      delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
      logs.length = 0;
      assert.equal(await sendVerificationEmail('fixture@mju.ac.kr', '123456'), true);
      assert(logs.join('\n').includes('123456'), '로컬 대체 모드의 코드가 표시되어야 함');
      process.env.SMTP_HOST = '127.0.0.1';
      await assert.rejects(sendVerificationEmail('fixture@mju.ac.kr', '123456'), (e: any) => e.statusCode === 503, '부분 SMTP 설정 오류를 대체 성공 처리하면 안 됨');
    });
  } finally {
    console.log = realLog; console.warn = realWarn; console.error = realError;
    process.env = savedEnv;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
