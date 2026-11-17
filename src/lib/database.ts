/** Prisma 6 접속 URL도 pg/Prisma 7에서 같은 CA·호스트 검증으로 사용한다. */
export function pgConnectionString(value: string): string {
  const url = new URL(value);
  if (url.searchParams.has('sslcert')) {
    url.searchParams.set('sslrootcert', url.searchParams.get('sslcert')!);
    url.searchParams.delete('sslcert');
    url.searchParams.set('sslmode', 'verify-full');
  }
  for (const key of ['sslaccept', 'pgbouncer', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);
  return url.toString();
}
