# SoloMap 전용 Supabase 연결 계획

**Goal:** 기존 Express/Passport API가 실제 전용 PostgreSQL에 계정·세션·리뷰·체크인을 저장한다.

**Architecture:** 현재 Prisma 스키마와 인증 방식을 유지한다. 브라우저는 Express API만 사용하고 서버 전용 DB 역할이 RLS 테이블을 소유한다. SMTP는 Gmail 앱 비밀번호를 사용한다.

**Tech Stack:** Express 5, Prisma 6, PostgreSQL 17, connect-pg-simple, Nodemailer.

**Spec:** 사용자 요청: SoloMap 전용 Supabase 연결 및 회원가입·로그인·리뷰·체크인 실제 저장.

## 제약과 검토 사항

- 다른 작업용 프로젝트 변경 금지. 비밀값은 로컬 `.env`만 저장한다.
- 공식 CA로 TLS를 검증하고 Prisma와 node-postgres의 인증서 옵션 차이를 처리한다.
- 원격 테스트는 임의 이메일로 만든 데이터만 정리한다.
- 미인증 리뷰 403, 중복 리뷰/체크인 409, 비밀번호 해시, 프로세스 재시작 후 세션 유지 검증.
- 학교 인증의 우회 경로를 추가하지 않는다. Gmail 실제 발송은 사용자 SMTP 자격 증명이 필요하다.

## 작업

- [x] Free 월 $0 확인 후 서울 리전에 전용 프로젝트 생성.
- [x] 서버 전용 역할·임의 비밀번호·세션 키 설정. 공식 CA 다운로드.
- [x] Prisma 초기 마이그레이션 및 식당 125곳 시드.
- [x] 실제 HTTP 통합 테스트 작성. 세션 TLS 실패를 재현하고 옵션 변환으로 수정.
- [x] 가입·인증·리뷰 CRUD·체크인·재시작 후 세션/기록 유지 검증, 테스트 데이터 정리.
- [x] Gmail SMTP 자격 증명 입력 후 TLS 연결·계정 인증 확인.
- [ ] 소유한 학교 이메일로 실제 수신 확인.
- [x] 최종 회귀 검증 및 연결 문서 갱신. 실제 DB 통합 검증·API 16/16·운영 설정/메일 실패 복구 11/11·UI/DS 회귀·typecheck·build 통과. 독립 리뷰에서 지적한 로그아웃 기존 쿠키 재사용 검증도 보완.
