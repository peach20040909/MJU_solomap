# SoloMap 운영 전 보완

사용자가 6단계 다음 작업을 요청하여 검증에서 확인한 메일·세션 문제를 수정한다. 사용자는 SoloMap용 Supabase 프로젝트를 별도로 사용할 예정이므로 연결된 다른 프로젝트는 변경하지 않는다.

- [x] 실제 로컬 SMTP 서버로 운영 메일 코드 로그·발송 실패 성공 처리를 재현한다.
- [x] production/Preview에서 DB·세션 키·SMTP 필수 설정을 시작 시 검사한다. 개발용 폴백은 로컬에서만 허용한다.
- [x] 운영 로그에 코드를 출력하지 않고 SMTP 실패는 안전한 503으로 전달한다. SMTP 설정이 없는 로컬에서는 기존 콘솔 코드 사용을 유지한다.
- [x] 가입 중 메일 실패는 이번에 만든 계정/코드를 정리하고, 재발송 실패는 새 코드만 정리하여 재시도할 수 있게 한다.
- [x] 테스트 서버의 SMTP 성공/거절, 환경설정 누락, 가입/재발송 복구, 실제 Express·화면 회귀·typecheck·build를 검증한다.
- [x] README·검증 문서를 실제 결과로 갱신한다. 실제 DB·메일 전달·배포 완료로 기록하지 않는다.
- [x] 새 프로젝트용 초기 마이그레이션 SQL·lock 준비. 6개 public 테이블 RLS 포함, 실제 DB에는 미적용.

필수 런타임 변수: DATABASE_URL, SESSION_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM. DIRECT_URL은 Prisma 마이그레이션용으로 별도 설정한다. 외부 SMTP에 테스트 메일을 보내지 않고 로컬 서버만 사용한다.

독립 리뷰: Important/Critical 없음. 운영 테스트 11/11, 실제 Express 16/16, 브라우저 회귀, typecheck/build 확인. 실제 DB/외부 메일 검증은 별도 SoloMap 프로젝트 설정 후 진행한다.
