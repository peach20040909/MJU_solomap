# 로그인 기능 계획서

> 상태: **계획 단계** (DB 수업 이후 구현 시작 예정)
> 대상 기능: ① 명지대생 인증 리뷰 ② 혼밥 레벨 키우기

---

## 1. 고민: 지금 구조에서는 로그인할 이유가 없다

현재 혼밥지도는 로그인 없이 모든 기능을 쓸 수 있습니다.

| 기능 | 현재 저장 방식 | 한계 |
|---|---|---|
| 찜한 식당 | 브라우저 `localStorage` (`solo_map_favorites_v1`) | 다른 기기에서 안 보임, 캐시 삭제 시 사라짐 |
| 혼밥 리뷰 | 브라우저 `localStorage` (`solo_map_reviews_v1`) | **작성자 본인만 볼 수 있음**, 다른 학우와 공유 안 됨 |
| 리뷰 기반 평균 난이도 | 각자 브라우저에서 계산 | 실제 학우들의 평가가 모이지 않음 |

서버의 `/api/auth/*`, `/api/reviews/*`는 라우트만 있고 `501`을 반환하는 상태입니다.

이 상태에서 로그인만 붙이면 "로그인해도 달라지는 게 없는" 기능이 됩니다. 단순히 찜 목록을 기기 간에 동기화하는 정도로는 사용자가 굳이 가입할 이유가 약합니다.

**결론:** 로그인이 의미를 가지려면 다음 두 가지가 필요하다.

1. **로그인할 이유**: 누가 썼는지가 중요한 기능 → **명지대생 인증 리뷰**
2. **다시 들어올 이유**: 내 기록이 쌓이는 기능 → **혼밥 레벨 키우기**

---

## 2. 해결 방법 ① 명지대생 인증 리뷰

### 목표

네이버·카카오 리뷰와 차별화되는 **"같은 학교 학생이 실제로 혼밥해 보고 남긴 후기"**를 서비스의 핵심 가치로 만든다.

### 기능

- `@mju.ac.kr` 학교 이메일로만 가입 가능
- 가입 시 학교 메일로 **6자리 인증 코드** 발송 → 입력하면 인증 완료
- 인증된 사용자만 리뷰 작성 가능, 리뷰에 **🎓 명지대생 인증** 배지 표시
- 리뷰 조회는 로그인 없이 누구나 가능 (탐색 경험은 그대로 유지)
- **내 리뷰만 수정·삭제** 가능
- 도배 방지: **식당 1곳당 1인 1리뷰** (다시 쓰면 기존 리뷰 수정)
- 리뷰는 닉네임으로 표시 (학번·이메일 등 개인정보 노출 없음)

### 가입·로그인 흐름

```
[회원가입] 학교 이메일 + 닉네임 + 비밀번호 입력
    ↓ 서버: @mju.ac.kr 도메인 검사 → 비밀번호 bcrypt 해싱 → 미인증 사용자 생성
    ↓ 서버: 6자리 코드 생성 → 해시로 저장(유효시간 10분) → 학교 메일로 발송
[인증] 메일로 받은 코드 입력
    ↓ 서버: 코드·만료 확인 → emailVerified = true
[로그인] 이메일 + 비밀번호
    ↓ 서버: bcrypt 비교 → JWT 발급 → httpOnly 쿠키로 전달
[리뷰 작성] 쿠키의 JWT를 requireAuth 미들웨어가 검증 → 인증된 사용자만 통과
```

### 고려사항

- **이메일 발송 서비스**: Resend 등 외부 메일 API 필요 (API 키는 Vercel 환경변수로 관리)
- **인증 코드 재발송 제한**: 1분에 1회, 하루 최대 5회
- **코드 무차별 대입 방지**: 5회 틀리면 코드 폐기 후 재발송 필요
- **JWT는 `localStorage`가 아닌 httpOnly 쿠키**에 저장 (XSS로 토큰 탈취 방지)

---

## 3. 해결 방법 ② 혼밥 레벨 키우기

### 목표

이미 있는 **식당 혼밥 난이도 Lv.1~5**를 **사용자 개인의 성장 기록**으로 연결한다.
"쉬운 식당부터 혼밥에 성공해서 끝판왕 고깃집까지 도전한다"는 게임 같은 경험을 만든다.

### 기능

- 식당 카드에 **"✅ 다녀왔어요"** 버튼 추가 → 방문 기록(체크인)
- 방문한 식당의 난이도에 따라 **내 혼밥 레벨**이 올라감
- 레벨업 시 **칭호 획득** 및 축하 토스트 표시
- **마이페이지**: 내 레벨, 다음 레벨까지 진행도, 방문한 식당 목록, 획득 칭호
- 지도에서 **내가 다녀온 식당 표시** (마커에 체크 표시)
- 다음 레벨 도전용 **추천 식당** 제안 (예: "Lv.3 해금까지 1곳! 이 식당은 어때요?")

### 레벨 규칙 (초안)

내 레벨보다 한 단계 높은 식당까지만 도전할 수 있습니다. 같은 난이도의 식당을 일정 수 클리어하면 다음 단계가 해금됩니다.

| 내 레벨 | 칭호 | 다음 레벨 조건 |
|---|---|---|
| Lv.1 | 🐣 혼밥 입문자 | Lv.1 식당 3곳 방문 |
| Lv.2 | 🍜 혼밥 성지 순례자 | Lv.2 식당 3곳 방문 |
| Lv.3 | 🍚 일반 밥집 마스터 | Lv.3 식당 3곳 방문 |
| Lv.4 | 🔥 다인석 정복자 | Lv.4 식당 2곳 방문 |
| Lv.5 | 👑 혼밥 끝판왕 | 최종 단계 |

- 칭호 이름은 기존 난이도 라벨(입문 혼밥, 혼밥 성지, 일반 밥집, 다인석 식당, 혼밥 끝판왕)과 맞춤
- 자기보다 높은 레벨의 식당도 방문 기록은 가능하지만, 레벨업은 순서대로 진행
- 리뷰를 함께 남기면 보너스 (예: 리뷰 포함 방문은 1.5곳으로 인정) → 기능 ①과 연결

### 부정 방지

- 같은 식당은 **하루 1회**만 체크인
- (선택) 체크인 시 브라우저 위치 정보로 **식당 반경 200m 이내**인지 확인
  - 위치 권한을 거부해도 체크인은 가능하되, 레벨 계산에는 위치 확인된 방문만 반영하는 방식 검토

---

## 4. 데이터베이스 설계 (Prisma 스키마 초안)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique   // @mju.ac.kr 만 허용
  passwordHash  String
  nickname      String    @unique
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  reviews       Review[]
  visits        Visit[]
  verifications EmailVerification[]
}

model EmailVerification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  codeHash  String
  attempts  Int      @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Review {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  placeId    String   // 카카오 장소 ID
  placeName  String
  difficulty Int      // 1~5, 작성자가 느낀 혼밥 난이도
  content    String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, placeId])  // 식당당 1인 1리뷰
}

model Visit {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  placeId        String
  placeLevel     Int      // 방문 당시 식당 난이도 (레벨 계산용)
  locationVerified Boolean @default(false)
  visitedAt      DateTime @default(now())
  visitDate      String   // 'YYYY-MM-DD', 하루 1회 제한용

  @@unique([userId, placeId, visitDate])
}
```

- 사용자 레벨은 별도 컬럼으로 저장하지 않고 `Visit` 기록으로 계산 (규칙이 바뀌어도 데이터 수정 불필요)
- DB는 계획대로 **Supabase(PostgreSQL) + Prisma** 사용

---

## 5. API 설계

이미 만들어 둔 라우트(`src/routes/auth.routes.ts`, `src/routes/review.routes.ts`)를 그대로 구현하고, 인증·방문 API를 추가합니다.

| 메서드 | 경로 | 인증 | 설명 | 상태 |
|---|---|---|---|---|
| POST | `/api/auth/signup` | - | 학교 이메일 가입 + 인증 코드 발송 | 라우트 있음 (501) |
| POST | `/api/auth/verify` | - | 인증 코드 확인 | **신규** |
| POST | `/api/auth/resend` | - | 인증 코드 재발송 | **신규** |
| POST | `/api/auth/login` | - | 로그인, JWT 쿠키 발급 | 라우트 있음 (501) |
| POST | `/api/auth/logout` | ✅ | 쿠키 삭제 | 라우트 있음 (501) |
| GET | `/api/auth/me` | ✅ | 내 정보 + 레벨 + 칭호 | **신규** |
| POST | `/api/reviews` | ✅ | 리뷰 작성 (식당당 1개) | 라우트 있음 (501) |
| GET | `/api/reviews/place/:placeId` | - | 식당 리뷰 목록 + 평균 난이도 | 라우트 있음 (501) |
| PATCH | `/api/reviews/:id` | ✅ | 내 리뷰 수정 | 라우트 있음 (501) |
| DELETE | `/api/reviews/:id` | ✅ | 내 리뷰 삭제 | 라우트 있음 (501) |
| POST | `/api/visits` | ✅ | 다녀왔어요 체크인 | **신규** |
| GET | `/api/visits/me` | ✅ | 내 방문 기록 + 레벨 진행도 | **신규** |

---

## 6. 구현 순서

| 단계 | 내용 | 결과물 |
|---|---|---|
| 0 | DB 수업 수강, Supabase 프로젝트 생성, Prisma 연결 | `prisma/schema.prisma`, `DATABASE_URL` |
| 1 | 회원가입·로그인 (bcrypt + JWT 쿠키), `requireAuth` 구현 | 이메일·비밀번호 로그인 |
| 2 | 학교 이메일 인증 (코드 발송·확인) | 🎓 인증 배지 |
| 3 | 리뷰 CRUD를 `localStorage` → 서버 API로 전환 | 모든 학우가 리뷰 공유 |
| 4 | 체크인 + 레벨 계산 + 칭호 | 혼밥 레벨 키우기 |
| 5 | 마이페이지, 지도 방문 표시, 다음 레벨 추천 | 성장 기록 화면 |
| 6 | (선택) 위치 확인 체크인, 찜 목록 서버 동기화 | 부정 방지·편의 기능 |

- 1~3단계만 끝나도 "리뷰 공유"라는 핵심 문제는 해결됩니다.
- 로그인하지 않은 사용자도 지금처럼 검색·지도·랜덤 추천·리뷰 읽기를 그대로 쓸 수 있게 유지합니다.

---

## 7. 기대 효과 (발표 포인트)

- **차별화**: 일반 지도 앱에 없는 "명지대생이 직접 검증한 혼밥 정보"
- **재방문 동기**: 혼밥 레벨과 칭호로 "다음엔 Lv.3 식당 도전" 같은 목표가 생김
- **서비스 콘셉트와 일치**: 식당 난이도(Lv.1~5)가 그대로 사용자 성장 단계가 됨
- **기술적 학습 범위**: 비밀번호 해싱(bcrypt), JWT 인증, 이메일 인증, 관계형 DB 설계, Prisma ORM, 인증 미들웨어
