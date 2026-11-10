/**
 * 데블스 플랜 정적 에셋 — 대표 배너 + 출연진 16명 프로필 사진.
 * 원본은 /devil/(한글 파일명)이지만 macOS 유니코드 정규화(NFD) 때문에 metro가 한글 파일명을
 * 리졸브하지 못한다 → assets/devil/ 아래 ASCII 이름(c01~c16, banner)으로 복사해 require한다.
 * 데이터(이름/픽/탈락/시청)는 서버(devil_* 테이블)에서 온다. 여기서는 '사진'만 id로 매핑한다.
 *   서버 devil_contestants.id ↔ 아래 CONTESTANTS.id 가 일치해야 한다(1..16).
 *
 * 주의: 요청서/시안의 #12 이름은 "정현규"지만 제공된 파일(원본 장현규.jpeg → c12)을 그대로 사용한다.
 *       표시 이름은 "정현규"로 둠(필요 시 displayName만 변경).
 */
import type { ImageSourcePropType } from 'react-native';

export const DEVIL_BANNER: ImageSourcePropType = require('../../../assets/devil/banner.jpeg');

export type Contestant = {
  id: number;
  name: string;
  image: ImageSourcePropType;
};

export const CONTESTANTS: Contestant[] = [
  { id: 1, name: '김동재', image: require('../../../assets/devil/c01.jpeg') },
  { id: 2, name: '넉살', image: require('../../../assets/devil/c02.jpeg') },
  { id: 3, name: '서출구', image: require('../../../assets/devil/c03.jpeg') },
  { id: 4, name: '스텔라장', image: require('../../../assets/devil/c04.jpeg') },
  { id: 5, name: '신동', image: require('../../../assets/devil/c05.jpeg') },
  { id: 6, name: '오현민', image: require('../../../assets/devil/c06.png') },
  { id: 7, name: '유리사', image: require('../../../assets/devil/c07.png') },
  { id: 8, name: '이도', image: require('../../../assets/devil/c08.jpeg') },
  { id: 9, name: '장동민', image: require('../../../assets/devil/c09.png') },
  { id: 10, name: '재재', image: require('../../../assets/devil/c10.png') },
  { id: 11, name: '정원영', image: require('../../../assets/devil/c11.jpeg') },
  { id: 12, name: '정현규', image: require('../../../assets/devil/c12.jpeg') },
  { id: 13, name: '존박', image: require('../../../assets/devil/c13.jpeg') },
  { id: 14, name: '하석진', image: require('../../../assets/devil/c14.jpeg') },
  { id: 15, name: '현경렬', image: require('../../../assets/devil/c15.jpeg') },
  { id: 16, name: '홍진호', image: require('../../../assets/devil/c16.png') },
];

// id → 프로필 이미지 맵. 서버는 이름/데이터만, 사진은 클라 에셋을 id로 매핑한다.
export const CONTESTANT_IMAGE: Record<number, ImageSourcePropType> = Object.fromEntries(
  CONTESTANTS.map((c) => [c.id, c.image]),
);

// 데블스 플랜 회차: 1~14화
export const EPISODE_COUNT = 14;
export const EPISODES = Array.from({ length: EPISODE_COUNT }, (_, i) => i + 1);

// 회차 개봉일('회차' 위에 표시). 1~5화 11/10, 6~10화 11/17, 11~14화 11/24.
export const EPISODE_RELEASE: Record<number, string> = {
  1: '11/10', 2: '11/10', 3: '11/10', 4: '11/10', 5: '11/10',
  6: '11/17', 7: '11/17', 8: '11/17', 9: '11/17', 10: '11/17',
  11: '11/24', 12: '11/24', 13: '11/24', 14: '11/24',
};

// 이벤트 메타(프론트 전용 상수 — 추후 events 테이블로 이동)
export const DEVIL_META = {
  title: '데블스 플랜',
  tagline: '최고의 두뇌 서바이벌,\n과연 최후의 승자는?',
  period: '11.10 (화) ~ 11.27 (금)',
  status: '진행중',
} as const;
