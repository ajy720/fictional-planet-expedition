const lightYearKm = 9.461e12;
const astronomicalUnitKm = 149597870.7;

function reference(name, lightYears, landmark, source) {
  return {
    reference: { name, lightYears, landmark, source },
    distance: `지구 기준 · ${name}까지 약 ${lightYears}광년`
  };
}

function scaledDistance(lightYears) {
  const km = lightYears * (lightYearKm / astronomicalUnitKm) / 100000;
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km) + 'km';
}

export function distanceAnalogy(reference, { compact = false } = {}) {
  if (!reference) return '';
  const { lightYears, landmark } = reference;
  const distance = scaledDistance(lightYears);
  const localDistance = `서강대에서 ${landmark}까지의 직선거리`;
  return compact ? `약 ${distance} · ${localDistance}`
    : `지구–태양 사이를 1cm로 줄이면 약 ${distance}. ${localDistance}와 비슷합니다.`;
}

export function earthAngularDiameter(lightYears) {
  const radians = 2 * Math.atan(6371 / (lightYears * lightYearKm));
  return Number((radians * 180 / Math.PI * 3600 * 1e6).toPrecision(2));
}

// Use the real Neptune–Triton system as the scale model for the fictional pair.
export const pandoraScale = {
  primaryDiameter: 49528,
  pandoraDiameter: Math.round(12756 * .75),
  tritonDiameter: 2700,
  centerDistance: 354760,
  earthMoonDistance: 384400
};

export const destinations = {
  b612: {
    name: 'B612', work: '어린 왕자', distance: '거리 미상 · 가상 항로', color: 0xa98a72,
    result: '장미를 찾고 유리 덮개를 씌웠다.',
    recordContext: [
      {
        heading: '왜 싹을 뽑고 장미는 덮었을까?',
        text: '《어린 왕자》에서 바오밥은 작은 별에 뿌리를 뻗어 별을 쪼갤 만큼 자란다. 어린 왕자는 그래서 싹일 때 뽑는다. 장미에는 물을 주고, 밤의 추위를 막으려고 유리 덮개를 씌운다. 별을 지키는 일과 장미를 돌보는 일은 모두 어린 왕자의 일상이다.'
      }
    ],
    question: '작은 소행성에서 장미를 기를 수 있을까?',
    comparison: '비슷한 밀도의 암석 천체라면 크기가 작을수록 표면 탈출 속도가 낮아 기체 분자가 우주로 빠져나가기 쉽다. 지름 약 500m인 소행성 베누도 대기를 유지하지 못한다. 실제 우주에서 장미를 키우려면 밀폐된 재배 공간에 적절한 기압과 온도, 빛과 물을 유지해야 한다.',
    science: ['실제 소행성 베누 · NASA', 'https://science.nasa.gov/solar-system/asteroids/101955-bennu/facts/'],
    source: ['생텍쥐페리 《어린 왕자》 · 5장·8–9장', 'https://lepetitprince.eu/numerique/le-petit-prince/']
  },
  pandora: {
    name: '판도라', work: '아바타', color: 0x62bdae,
    ...reference('알파 센타우리 A', 4.37, '여의나루역', ['알파 센타우리 A 거리 · NASA APOD', 'https://apod.nasa.gov/rjn/apod/ap190413.html']),
    observation: '빛나는 숲과 폴리페무스', result: '같은 숲에서 낮과 밤을 비교했다. 밤에는 생물발광으로 잎과 줄기의 윤곽이 나타났다.',
    recordContext: [
      {
        heading: '밤이 되면 숲은 왜 빛날까?',
        text: '《아바타》 설정에서 판도라의 식물과 동물은 스스로 빛을 낸다. 밤이 되거나 폴리페무스가 별빛을 가리면 주변광이 줄어들어 생물의 발광이 두드러진다.'
      },
      {
        heading: '숲 위의 거대한 천체는 무엇일까?',
        text: '판도라는 가스 행성 폴리페무스를 도는 위성이다. 숲에서는 위성 표면에서 폴리페무스를 올려다보고, 궤도 화면에서는 두 천체의 위치 관계를 확인할 수 있다. 탐사 모형은 폴리페무스의 크기를 해왕성에 맞추고 두 천체의 중심 간 거리에 트리톤의 궤도 반경을 사용했다.'
      }
    ],
    question: '지구에서 생물발광은 어떤 역할을 할까?',
    comparison: '지구의 반딧불이와 일부 해양 생물도 화학 반응으로 빛을 낸다. 생물에 따라 빛은 짝이나 먹이를 유인하거나 포식자를 피하는 데 쓰인다. 판도라의 숲은 여러 종이 빛을 내는 방식을 육상 생태계 전체로 확장한 상상이다.',
    science: ['생물발광 · NOAA', 'https://origin.oceanexplorer.noaa.gov/ocean-fact/living-light/'],
    source: ['판도라 · Avatar', 'https://www.avatar.com/pandorapedia/pandora']
  },
  adrian: {
    name: '아드리안', work: '프로젝트 헤일메리', color: 0xc1ac7b,
    ...reference('타우 세티', 11.9, '고속터미널역', ['타우 세티 거리 · NASA', 'https://science.nasa.gov/exoplanets/target-star-catalog/']),
    observation: '페트로바 선과 대기 샘플', result: '대기 샘플을 채취하고 확대해 미생물 형상을 관찰했다.',
    recordContext: [
      {
        heading: '왜 페트로바 선을 따라갔을까?',
        text: '작품에서 아스트로파지는 별의 에너지를 흡수하고 번식할 행성으로 이동한다. 그 이동 경로를 따라 감지되는 적외선 띠가 페트로바 선이다. 아스트로파지의 흔적이 있는 타우 세티는 밝기를 유지한다. 띠가 이어지는 아드리안은 그 이유를 조사할 출발점이 된다.'
      },
      {
        heading: '샘플에서 어떤 단서를 얻었을까?',
        text: '그레이스와 로키는 아드리안의 시료에서 아스트로파지의 포식자를 찾아낸다. 포식자가 개체 수를 억제한다는 설명은 아스트로파지가 있는데도 타우 세티가 밝기를 유지한 이유와 맞아떨어진다. 탐사에서는 띠를 찾고 시료를 확대하는 과정을 체험한다.'
      }
    ],
    question: '가시광선에서 놓친 단서를 어떻게 찾을까?',
    comparison: '적외선은 가시광선보다 파장이 길어 눈으로 볼 수 없다. 제임스 웹 우주망원경은 적외선으로 먼지에 가려진 별의 탄생 영역을 관측한다. 탐사에서 적외선 신호에 입힌 색은 밝기 차이를 읽기 위한 표시이며 시료의 배율은 화면 확대에 쓰인다.',
    science: ['적외선 천문학 · NASA 웹 망원경', 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/infrared-astronomy/'],
    source: ['프로젝트 헤일메리의 과학 · NASA', 'https://science.nasa.gov/the-science-behind-project-hail-mary/']
  },
  erid: {
    name: '에리드', work: '프로젝트 헤일메리', color: 0x96746b,
    ...reference('에리다누스자리 40 항성계', 16, '성수역', ['에리다누스자리 40 거리 · NASA', 'https://science.nasa.gov/universe/exoplanets/discovery-alert-spocks-home-planet-goes-poof/']),
    observation: '반향과 세 음의 교신', result: '음파를 보내 바위, 아치, 기둥의 윤곽을 확인했다.',
    recordContext: [
      {
        heading: '로키는 눈 없이 어떻게 주변을 파악할까?',
        text: '《프로젝트 헤일메리》에서 에리드인은 음파가 물체에 부딪혀 돌아오는 반향으로 주변을 감지한다. 돌아오는 시간과 방향은 물체의 위치를 짐작할 단서다. 탐사에서는 바위, 아치, 기둥에 음파가 닿는 지점과 송신기로 돌아오는 반사파를 볼 수 있다.'
      },
      {
        heading: '반향을 듣는 것과 교신은 어떻게 다를까?',
        text: '반향은 내가 보낸 소리가 물체에 반사되어 돌아온 것이다. 교신에서는 상대가 의미를 담은 소리를 보낸다. 로키의 언어는 음높이의 조합으로 뜻을 전한다. 탐사에서 세 음을 같은 순서로 돌려보내는 것은 이 소통 방식에 착안한 첫 응답이다.'
      }
    ],
    question: '반향으로 물체까지의 거리를 잴 수 있을까?',
    comparison: '같은 자리에서 음파를 보내고 받으면 물체까지의 거리는 음속에 왕복 시간을 곱한 뒤 2로 나눈 값이다. 지구에서도 반향을 숙련한 사람은 혀를 차서 낸 소리로 거리 차이를 구별할 수 있다. 화면에서는 장면 안의 거리와 체험용 음속으로 반향의 왕복 시간을 정한다.',
    science: ['사람의 반향 거리 지각 · Thaler 외 (2019)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6797687/'],
    source: ['에리드와 에리다누스자리 40 · NASA', 'https://science.nasa.gov/the-science-behind-project-hail-mary/']
  },
  arrakis: {
    name: '아라키스', work: '듄', color: 0xd9a566,
    ...reference('카노푸스', 300, '전주역', ['카노푸스 거리 · NASA', 'https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?frame=28068&mission=ISS006&roll=E']),
    observation: '사막의 흔적과 스틸수트', result: '사막에서 발견한 흔적과 경로의 물 수지를 기록했다.',
    recordContext: [
      {
        heading: '아라키스는 왜 사막이 되었을까?',
        text: '《듄》 부록에서 행성학자 파도트 카인스는 소금 평원과 마른 우물에서 옛 지표수의 흔적을 찾는다. 모래벌레의 어린 단계인 샌드트라우트는 물을 지하 암석층에 가둬 지표에서 이용할 수 있는 물을 줄였다. 지하에 갇힌 물은 스파이스 형성에 관여하고, 건조한 지표는 물에 취약한 성체 모래벌레가 살아갈 환경을 제공한다.'
      },
      {
        heading: '프레멘은 왜 물을 회수할까?',
        text: '물을 보충할 곳이 드문 사막에서는 몸에서 빠져나가는 물이 이동 범위를 제한한다. 스틸수트는 열을 방출하면서 땀과 날숨 속 수분을 회수한다. 정화한 물은 주머니에 모아 관으로 다시 마실 수 있다. 프레멘은 개인의 물 손실을 줄이는 한편, 공동 저수조에 물을 비축해 사막 일부를 녹화할 계획을 세웠다.'
      }
    ],
    question: '그늘에서는 왜 물을 덜 잃을 수 있을까?',
    comparison: '직사광선은 몸이 받는 열을 늘린다. 땀이 증발하면 체온을 낮출 수 있지만 그만큼 몸의 수분이 줄어든다. 그늘은 직사광선을 줄이고, 실제 이동 중 손실량은 기온·습도·활동 강도와 이동 시간에도 영향을 받는다.',
    science: ['일사와 인체의 열 부담 · Foster 외 (2021)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8727397/'],
    source: ['프랭크 허버트 《듄》 · 본문과 부록 I', 'https://tip.dhappy.org/old/text/Frank%20Herbert%20-%20Dune.html']
  },
  miller: {
    name: '밀러', work: '인터스텔라', distance: '작품 속 웜홀 경로', color: 0x8faeb8,
    observation: '다가오는 파도와 두 시계', result: '현지 시계와 지구 시계를 비교하고 밀러에서 출발했다.',
    recordContext: [
      {
        heading: '밀러의 1시간은 왜 지구의 7년일까?',
        text: '《인터스텔라》의 밀러는 빠르게 회전하는 초대질량 블랙홀 가르강튀아 가까이에서 공전한다. 밀러에 있는 사람이 자기 시계로 재는 시간은 평소처럼 흐른다. 멀리 떨어진 지구에 쌓인 시간과 비교하면 현지 1시간에 지구에서 약 7년이 흐른다는 것이 영화의 설정이다.'
      },
      {
        heading: '거대한 파도는 어디서 왔을까?',
        text: '가르강튀아는 밀러의 가까운 쪽과 먼 쪽을 서로 다른 세기로 당긴다. 이 차이를 조석력이라고 한다. 영화의 과학 자문 킵 손은 조석력으로 행성이 흔들리며 바닷물이 크게 출렁였을 가능성을 설명한다. 탐사에서 파도를 더 지켜보면 두 시계의 차이도 더 벌어진다.'
      }
    ],
    question: '지구에서도 중력에 따른 시계 차이를 잴 수 있을까?',
    comparison: '중력과 움직임이 다른 경로를 지나는 시계에는 서로 다른 시간이 쌓일 수 있다. 지구에서 광격자 원자시계로 높이가 약 1mm 다른 원자들을 비교했을 때, 위쪽 원자에서 시간이 아주 조금 더 빠르게 흘렀다. 탐사 시계는 영화가 정한 시간 비율로 계산한다.',
    science: ['원자시계로 측정한 중력 시간 지연 · NIST', 'https://www.nist.gov/news-events/news/2022/02/jila-atomic-clocks-measure-einsteins-general-relativity-millimeter-scale'],
    source: ['킵 손의 밀러 행성 해설', 'https://www.its.caltech.edu/~kip/index.html/PubScans/VI-59.pdf']
  },
  tatooine: {
    name: '타투인', work: '스타워즈', distance: '거리 미상 · 가상 항로', color: 0xdfae78,
    observation: '두 해의 일몰과 쌍성 궤도', result: '두 해가 차례로 지며 그림자가 두 개에서 하나로, 이어 모두 사라졌다.',
    recordContext: [
      {
        heading: '타투인에서는 왜 해가 두 번 질까?',
        text: '《스타워즈》의 타투인은 두 별을 함께 도는 사막 행성이다. 두 별은 서로의 중력으로 공통 질량 중심을 돌고, 행성은 그 바깥 궤도를 돈다. 행성의 자전으로 해가 지평선 아래로 내려간다. 같은 관측 시각이라도 공전 위치가 바뀌면 두 해 사이 각거리와 먼저 지는 해가 달라질 수 있다.'
      },
      {
        heading: '기둥 하나가 왜 그림자 두 개를 만들까?',
        text: '기둥은 각각의 해에서 오는 빛을 다른 방향으로 가린다. 해가 낮아지면 그림자가 길어지고, 해 하나가 지면 그 해의 직사광이 만든 그림자가 사라진다. 지상에서 본 각도는 케플러-16의 공전 궤도와 체험용 관측 위도를 바탕으로 계산했다.'
      }
    ],
    question: '두 별을 도는 행성은 어떻게 발견할까?',
    comparison: '케플러 우주망원경은 케플러-16b가 두 별의 앞을 각각 지나며 별빛을 조금씩 가리는 현상을 포착했다. 별끼리 서로 가리는 식과 행성이 별을 가리는 통과를 함께 분석하면 세 천체의 궤도를 알아낼 수 있다. 궤도 모형은 케플러-16에서 측정한 두 별의 크기와 질량, 공전 궤도를 사용한다. 타투인은 지름 12,742 km의 사막 행성으로 가정했다. 실제 케플러-16b는 토성과 비슷한 크기의 가스 행성이다.',
    science: ['케플러-16b · NASA', 'https://science.nasa.gov/exoplanets/other-stars-other-worlds/kepler-16-b-almost-a-real-life-tatooine/'],
    source: ['타투인 · Star Wars', 'https://www.starwars.com/databank/Tatooine']
  }
};

export const destinationIds = Object.keys(destinations);
export const routeLayout = {
  earth: [-27, -2.7, -1],
  b612: [-20, 1.9, 2],
  pandora: [-12.7, 4.7, -4],
  adrian: [-5.8, 1.1, -8.3],
  erid: [1.6, -4.4, -3.4],
  arrakis: [8.9, -1.6, 3.3],
  miller: [15.6, 4.2, -7.6],
  tatooine: [23.1, .65, -.4]
};

function mapDistance(from, to) {
  return Math.hypot(...routeLayout[from].map((coordinate, i) => coordinate - routeLayout[to][i]));
}

const routeDistances = destinationIds.flatMap(from =>
  destinationIds.filter(to => from !== to).map(to => mapDistance(from, to)));
const minRoute = Math.min(...routeDistances);
const maxRoute = Math.max(...routeDistances);

const profiles = Object.fromEntries(destinationIds.map(from => [from, Object.fromEntries(
  destinationIds.filter(to => from !== to).map(to => {
    const distance = (mapDistance(from, to) - minRoute) / (maxRoute - minRoute);
    return [to, {
      duration: 1000 * Math.round(10 + 16 * distance ** .78),
      scale: 23 + 31 * distance,
      coast: 2.15 + .55 * distance,
      length: distance < .25 ? '짧은 항로' : distance < .59 ? '중간 항로' : '긴 항로'
    }];
  })
)]));

export const routeFlight = (from, to) => profiles[from][to];
export const flightDuration = (from, to) => from ? routeFlight(from, to).duration : 8000;
export const arrivalNodes = [0, .25, .7, 1];
export const petrovaCheckpoint = from => Math.round(flightDuration(from, 'adrian') * .7);
export const echoNames = ['바위', '아치', '기둥'];
export const desertRoutes = {
  sun: {
    name: '햇볕 드는 지름길', duration: 6000, lookout: 2900, loss: 40, recovery: 14,
    forecast: '빠름 · 물 소모 큼',
    prompt: '능선 너머 소금 평원에서 모래가 움직입니다.',
    tool: '쌍안경 들기', title: '소금 평원의 모래 물결',
    description: '소금 평원 끝에서 모래가 길게 솟아올라 능선을 가로질렀다.'
  },
  shade: {
    name: '암벽 그늘길', duration: 10000, lookout: 5100, loss: 20, recovery: 10,
    forecast: '느림 · 물 소모 적음',
    prompt: '암벽 아래 집수조가 있습니다. 안쪽은 어둡습니다.',
    tool: '램프 켜기', title: '집수조의 물 자국',
    description: '마른 집수조 벽에서 물이 차 있던 높이를 따라 밝은 띠를 찾았다.'
  }
};

export function millerTimes(elapsed) {
  const seconds = Math.floor(elapsed / 1000);
  const hoursOnEarth = Math.floor(seconds * 7 * 365.25 * 24 / 3600);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const pad = value => String(value).padStart(2, '0');
  return {
    local: [...(hours ? [hours] : []), minutes, seconds % 60].map(pad).join(':'),
    earth: `${Math.floor(hoursOnEarth / 24)}일 ${hoursOnEarth % 24}시간`
  };
}
