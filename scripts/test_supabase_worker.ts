/** 실제 앱을 별도 프로세스로 실행한다. 개발 인증 코드는 테스트 IPC로만 전달한다. */
process.env.VERCEL = '1';
const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.join(' ');
  if (line.startsWith('[DEV EMAIL]')) {
    process.send?.({ code: line.match(/인증 코드: (\d{6})/)?.[1] });
    return;
  }
  originalLog(...args);
};
const { default: app } = await import('../src/app.js');
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') process.send?.({ port: address.port });
});
