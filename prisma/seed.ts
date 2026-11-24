import 'dotenv/config';
/**
 * [이 파일이 하는 일]
 * 대동명지도 2026 검증 맛집 데이터(daedongPlaces.json)를 데이터베이스의 Place 테이블에 삽입(시드)합니다.
 * - baseSoloLevel: aiCurations.json의 soloLevel 우선 적용, 없으면 식당명/카테고리 기반 혼밥 난이도 평가
 * - area: 식당의 위/경도 좌표를 기준으로 3대 거점(명지대, 명지전문대, 백련시장) 중 가장 가까운 권역 자동 계산
 * - upsert를 사용하여 여러 번 실행해도 중복 데이터가 쌓이지 않고 최신 정보로 갱신됩니다.
 */

import prisma from '../src/lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// 카카오 장소 데이터 타입 인터페이스
interface KakaoPlaceItem {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도 (lng)
  y: string; // 위도 (lat)
}

// AI 큐레이션 캐시 데이터 타입 인터페이스
interface AiCurationItem {
  soloLevel: number;
}

// 1. 위/경도 좌표 간 유클리드 거리 기반 가장 가까운 거점(area) 계산 함수
function resolveClosestArea(lat: number, lng: number): string {
  const hubs = [
    { name: '명지대', lat: 37.5802, lng: 126.9234 },
    { name: '명지전문대', lat: 37.5845, lng: 126.9240 },
    { name: '백련시장', lat: 37.5768, lng: 126.9231 },
  ];

  let closest = hubs[0].name;
  let minDistance = Infinity;

  for (const hub of hubs) {
    const dLat = lat - hub.lat;
    const dLng = lng - hub.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = hub.name;
    }
  }

  return closest;
}

// 2. 카테고리 및 상호명 기반 기본 혼밥 난이도(1~5단계) 평가 함수 (main.js 동일 로직)
function evaluateSoloIndex(category: string = '', name: string = ''): number {
  const text = `${category} ${name}`.toLowerCase();

  // 생선구이, 돈까스는 Lv.2 혼밥 성지
  if (text.includes('생선') || text.includes('생선구이') || (text.includes('돈까스') && text.includes('구이'))) {
    return 2;
  }

  // Lv.5 혼밥 끝판왕 (불판 구이, 술자리 회식, 2인 이상 주문 필수)
  if (
    text.includes('삼겹살') || text.includes('갈비') || text.includes('고깃집') ||
    (text.includes('구이') && !text.includes('생선')) || text.includes('곱창') || text.includes('막창') ||
    text.includes('대창') || text.includes('닭갈비') || text.includes('조개구이') ||
    text.includes('횟집') || text.includes('회센터') || text.includes('참치') ||
    text.includes('주점') || text.includes('술집') || text.includes('호프') ||
    text.includes('포차') || text.includes('이자카야') || text.includes('족발') ||
    text.includes('보쌈') || text.includes('정육식당')
  ) {
    return 5;
  }

  // Lv.4 다인석 식당 (떡볶이 냄비, 샤브샤브, 전골 등 2인 이상 권장)
  if (
    text.includes('떡볶이') || text.includes('엽기떡볶이') || text.includes('엽떡') ||
    text.includes('청년다방') || text.includes('두끼') || text.includes('신전') ||
    text.includes('샤브') || text.includes('뷔페') || text.includes('패밀리레스토랑') ||
    text.includes('피자') || text.includes('파스타') || text.includes('감자탕') ||
    text.includes('찜닭') || text.includes('닭볶음탕') || text.includes('부대찌개') ||
    text.includes('전골') || text.includes('아시안') || text.includes('스테이크')
  ) {
    return 4;
  }

  // Lv.1 입문 혼밥 (키오스크 선불, 1인석 대다수, 패스트푸드/분식/도시락)
  if (
    text.includes('패스트푸드') || text.includes('햄버거') || text.includes('버거') ||
    text.includes('맥도날드') || text.includes('롯데리아') || text.includes('버거킹') ||
    text.includes('맘스터치') || text.includes('서브웨이') || text.includes('샌드위치') ||
    text.includes('토스트') || text.includes('이삭') || text.includes('김밥') ||
    text.includes('김밥천국') || text.includes('도시락') || text.includes('한솥') ||
    text.includes('컵밥') || text.includes('편의점') || text.includes('학식') ||
    text.includes('만두') || text.includes('바비든든')
  ) {
    return 1;
  }

  // Lv.2 혼밥 성지 (국밥, 라멘, 일식 등 1인 바 테이블 완비)
  if (
    text.includes('국밥') || text.includes('순대국') || text.includes('순댓국') ||
    text.includes('돼지국밥') || text.includes('설렁탕') || text.includes('곰탕') ||
    text.includes('해장국') || text.includes('추어탕') || text.includes('도가니') ||
    text.includes('라멘') || text.includes('일식') || text.includes('우동') ||
    text.includes('소바') || text.includes('1인샤브') || text.includes('카레') ||
    text.includes('회전초밥') || text.includes('초밥') || text.includes('샐러드') ||
    text.includes('포케')
  ) {
    return 2;
  }

  // Lv.3 일반 밥집 (기본값)
  return 3;
}

async function main() {
  console.log('🌱 [Prisma Seed] 명지대 맛집 데이터 시드 작업을 시작합니다...');

  // JSON 파일 경로 탐색
  const daedongPath = path.resolve(__dirname, '../src/data/daedongPlaces.json');
  const curationPath = path.resolve(__dirname, '../src/data/aiCurations.json');

  if (!fs.existsSync(daedongPath)) {
    throw new Error(`daedongPlaces.json 파일을 찾을 수 없습니다: ${daedongPath}`);
  }

  const daedongPlaces: KakaoPlaceItem[] = JSON.parse(fs.readFileSync(daedongPath, 'utf-8'));
  let aiCurations: Record<string, AiCurationItem> = {};

  if (fs.existsSync(curationPath)) {
    aiCurations = JSON.parse(fs.readFileSync(curationPath, 'utf-8'));
  }

  console.log(`총 ${daedongPlaces.length}곳의 식당 데이터를 데이터베이스에 동기화합니다.`);

  let count = 0;
  for (const place of daedongPlaces) {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    const area = resolveClosestArea(lat, lng);

    // AI 큐레이션 캐시에 등록된 soloLevel 우선, 없으면 룰 기반 산출
    let baseSoloLevel = 3;
    if (aiCurations[place.id]?.soloLevel) {
      baseSoloLevel = Number(aiCurations[place.id].soloLevel);
    } else {
      baseSoloLevel = evaluateSoloIndex(place.category_name, place.place_name);
    }

    const roadAddress = place.road_address_name || place.address_name || '주소 정보 없음';

    await prisma.place.upsert({
      where: { id: place.id },
      update: {
        name: place.place_name,
        category: place.category_name,
        roadAddress,
        lat,
        lng,
        area,
        baseSoloLevel,
      },
      create: {
        id: place.id,
        name: place.place_name,
        category: place.category_name,
        roadAddress,
        lat,
        lng,
        area,
        baseSoloLevel,
        reviewCount: 0,
      },
    });

    count++;
  }

  console.log(`✅ [Prisma Seed] 총 ${count}곳의 식당 데이터 upsert 동기화 완료!`);

  // 평가용 테스트 사용자 2명 (실제 계정 아님). 비밀번호는 평문이 아니라 미리 만든 bcrypt(10) 해시를 그대로 넣고,
  // 리뷰·체크인을 바로 시험할 수 있도록 학교 메일 인증 완료(isVerified) 상태로 넣는다.
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { nickname: user.nickname, passwordHash: SEED_PASSWORD_HASH, isVerified: true },
      create: { ...user, passwordHash: SEED_PASSWORD_HASH, isVerified: true },
    });
  }
  console.log(`✅ [Prisma Seed] 테스트 사용자 ${SEED_USERS.length}명 등록 (${SEED_USERS.map(u => u.email).join(', ')})`);
}

// requests.http와 설명 문서에 적는 시드 계정(테스트 전용). 로그인 비밀번호는 설명 문서의 시드 계정 표에 있고,
// 여기와 DB에는 그 비밀번호를 bcrypt.hash(비밀번호, 10)으로 만든 해시(60자)만 둔다
const SEED_PASSWORD_HASH = '$2b$10$kprkhxaADeC8bbBgPoGWPevUO5GxUFY8E557cR8uRaLsZ5ycD0zxK';
const SEED_USERS = [
  { email: 'seed-a@mju.ac.kr', nickname: '시드학우A' },
  { email: 'seed-b@mju.ac.kr', nickname: '시드학우B' },
];

main()
  .catch((e) => {
    console.error('❌ 시드 작업 중 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

