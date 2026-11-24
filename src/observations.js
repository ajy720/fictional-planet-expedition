import { desertRoutes, echoNames, millerTimes } from './destinations.js';
import { echoCount, echoDuration, echoInProgress, echoTargets } from './erid-sonar.js';
import { defaultOrbitRate, groundSkyAt, outerOrbit } from './tatooine-orbit.js';

export const newObservation = () => ({
  complete: false, elapsed: 0, phase: 'ready', light: 0, target: 0, magnification: 1,
  firstMagnification: null, path: null, sky: 0, visited: 0, sproutRemoved: false,
  nightSeen: false, orbitSeen: false, lookPitch: 0, scaleComparison: false, orbitZoom: 1, view: 'ground', viewProgress: 0, optics: 'visible',
  orbitDays: 0, orbitRate: defaultOrbitRate, orbitPlaying: false, reply: '', suitChecked: false,
  desertSurvey: null, desertPhoto: null, echoElapsed: null
});

export const eridSignal = [0, 2, 1];
export const eridNotes = ['낮은음', '중간음', '높은음'];
export const millerCrestAt = 6000;
export const millerWavePassedAt = 9000;
export const millerWavePeriod = 10000;
export const suitTestVolume = 4;
export const desertSurveyDuration = 2100;

export function desertStep(data) {
  if (!data.path) return 'ready';
  if (data.complete) return 'complete';
  const { lookout, duration } = desertRoutes[data.path];
  if (data.elapsed === duration) return 'arrived';
  if (data.elapsed === lookout && data.desertSurvey === null) return 'lookout';
  if (data.desertSurvey !== null && data.desertSurvey < desertSurveyDuration) return 'surveying';
  return 'crossing';
}

export const firstMillerWave = `첫 파도 관측 · 착륙 후 지구에서는 ${millerTimes(millerCrestAt).earth}이 흘렀습니다.`;

export function advanceObservation(id, data, delta, reduced) {
  if (id === 'pandora' || id === 'tatooine') {
    const viewTarget = data.view === 'orbit' ? (id === 'pandora' ? 2 : 1) : 0;
    const step = reduced ? 2 : delta / 950;
    data.viewProgress += Math.sign(viewTarget - data.viewProgress) * Math.min(Math.abs(viewTarget - data.viewProgress), step);
    if (data.view === 'orbit' && data.viewProgress === viewTarget && !data.orbitSeen) {
      data.orbitSeen = true;
      data.complete = true;
      if (id === 'pandora') return '판도라가 폴리페무스를 도는 모습을 확인했습니다.';
      return data.orbitPlaying ? '두 해의 공전 재생을 시작했습니다.'
        : '재생하거나 시간 슬라이더를 움직여 두 해의 공전을 관찰하세요.';
    }
  }

  const onGround = data.view === 'ground' && data.viewProgress === 0;
  const inOrbit = data.view === 'orbit' && data.viewProgress === 1;
  if (id === 'tatooine' && data.orbitPlaying && (onGround || inOrbit)) {
    data.orbitDays = Math.min(outerOrbit.period, data.orbitDays + data.orbitRate * delta / 1000);
    if (data.orbitDays === outerOrbit.period) data.orbitPlaying = false;
    if (onGround && data.visited !== 3) {
      markTatooineSunset(data, groundSkyAt(data.orbitDays, data.sky).visibleCount);
    }
  }

  if (id === 'pandora' && data.light !== data.target) {
    const step = reduced ? 1 : delta / 800;
    data.light = data.target === 1 ? Math.min(1, data.light + step) : Math.max(0, data.light - step);
    if (data.light === 1 && !data.nightSeen) {
      data.nightSeen = true;
      return '잎과 줄기가 빛납니다. 화면을 아래로 끌거나 위쪽 방향키로 밤하늘을 살펴보세요.';
    }
  } else if (id === 'adrian' && data.phase === 'sampling') {
    data.elapsed = Math.min(5000, data.elapsed + delta);
    if (data.elapsed === 5000) {
      data.phase = 'sample';
      return '샘플 채취 완료';
    }
  } else if (id === 'erid' && echoInProgress(data)) {
    const count = echoCount(data);
    data.echoElapsed = Math.min(echoDuration, data.echoElapsed + delta);
    if (data.echoElapsed === echoDuration && data.phase === 'echo') {
      data.phase = 'reply';
      return '반향 관측 완료. 세 음의 교신 신호가 도착했습니다.';
    }
    if (data.echoElapsed === echoDuration) return '반향 관측 완료. 음파를 다시 보낼 수 있습니다.';
    const received = echoCount(data);
    if (received > count) return `반향 ${received}/3 · ${echoNames[received - 1]}`;
  } else if (id === 'arrakis' && data.path && !data.complete) {
    const route = desertRoutes[data.path];
    if (data.elapsed < route.lookout) {
      data.elapsed = Math.min(route.lookout, data.elapsed + delta);
      if (data.elapsed === route.lookout) return route.prompt;
    } else if (data.desertSurvey !== null && data.desertSurvey < desertSurveyDuration) {
      data.desertSurvey = Math.min(desertSurveyDuration, data.desertSurvey + delta);
      if (data.desertSurvey === desertSurveyDuration) return route.title + ' · 관측 기록에 저장했습니다.';
    } else if (data.desertSurvey === desertSurveyDuration && data.elapsed < route.duration) {
      data.elapsed = Math.min(route.duration, data.elapsed + delta);
      if (data.elapsed === route.duration) return '관측 지점에 도착했습니다. 스틸수트 물통을 확인하세요.';
    }
  } else if (id === 'miller' && !data.complete) {
    const before = data.elapsed;
    data.elapsed += delta;
    if (before < millerCrestAt && data.elapsed >= millerCrestAt) return firstMillerWave;
  }
}

export function waterReport(route, progress = 1, suitChecked = true) {
  const recovery = suitChecked ? route.recovery : 0;
  const spent = Math.floor((route.loss - recovery) * progress);
  const recovered = Math.floor(recovery * progress);
  return { spent, recovered, left: 100 - spent };
}

export function markTatooineSunset(data, visibleCount) {
  if (visibleCount < 2) data.visited |= 1 << visibleCount;
}

export function tatooineShadowStatus({ visibleCount, separation }) {
  if (visibleCount === 2 && separation < 1) return '두 그림자가 거의 겹칩니다.';
  return ['직사광 그림자 없음', '그림자 1개', '그림자 2개'][visibleCount];
}

export function observationStatus(id, data) {
  switch (id) {
    case 'pandora':
      if (data.view === 'orbit') return data.scaleComparison
        ? '해왕성–트리톤 · 실제 크기와 중심 간 거리를 같은 축척으로 표시'
        : '판도라–폴리페무스 · 크기와 중심 간 거리를 같은 축척으로 표시';
      if (data.light !== data.target) return data.target ? '밤으로 바뀌는 중' : '낮으로 바뀌는 중';
      return data.light ? '화면을 아래로 끌거나 ↑ 키로 밤하늘을 살펴보세요.' : '밤으로 바꾸어 같은 숲을 관찰하세요.';
    case 'adrian':
      if (data.phase === 'sampling') return data.elapsed < 3000 ? '채취 고도에 도달하는 중' : '대기 샘플 채취 중';
      if (data.phase === 'sample') return '샘플 채취 완료';
      if (data.phase === 'magnify') return data.magnification >= 3 ? '미생물 형상 관찰' : '확대해서 시료를 살펴보세요.';
      return data.optics === 'tracked' ? '페트로바 선이 이어진 지점으로 탐사선을 내리세요.' : '탐사선을 구름 속으로 내리세요.';
    case 'erid': {
      if (echoInProgress(data)) {
        const count = echoCount(data);
        if (count) return `반향 수신 ${count}/3 · ${echoNames.slice(0, count).join(' · ')}`;
        return data.echoElapsed < echoTargets[0].hitAt
          ? '음파가 구조물을 향해 퍼지고 있습니다.' : '구조물에 닿은 음파가 돌아오고 있습니다.';
      }
      if (data.phase === 'contact') return '교신 성공 · 같은 세 음이 다시 돌아왔습니다.';
      if (data.phase === 'reply') return '수신한 세 음을 같은 순서로 보내 교신하세요.';
      return '음파를 보내 공간의 윤곽을 살펴보세요.';
    }
    case 'arrakis': {
      const route = desertRoutes[data.path];
      switch (desertStep(data)) {
        case 'lookout': return route.prompt;
        case 'surveying': return route.title + ' · 관측 중';
        case 'arrived': return '관측 지점에 도착했습니다. 스틸수트 물통을 확인하세요.';
        case 'complete': return '스틸수트 물통 · 도착 잔량';
        case 'crossing': return data.desertSurvey === desertSurveyDuration
          ? route.title + ' · 기록 완료. 관측 지점으로 이동합니다.'
          : route.name + ' · 이동 중';
        default: return data.suitChecked ? '수트 점검 완료. 이동할 경로를 고르세요.' : '사막으로 나가기 전에 스틸수트를 점검하세요.';
      }
    }
    case 'miller': {
      if (data.complete) return '출발 · 두 시계의 값을 기록했습니다.';
      const wave = Math.floor(data.elapsed / millerWavePeriod);
      const phase = data.elapsed % millerWavePeriod;
      if (phase >= millerWavePassedAt) return '파도가 지나갔습니다.';
      if (phase >= millerCrestAt) return `${wave + 1}번째 파도의 마루가 가까워졌습니다.`;
      return wave ? '다음 파도가 수평선에서 다가옵니다.' : '첫 파도가 수평선에서 다가옵니다.';
    }
    case 'tatooine':
      return data.view === 'orbit' ? (data.viewProgress === 1 ? '' : '쌍성계 궤도로 이동 중')
        : tatooineShadowStatus(groundSkyAt(data.orbitDays ?? 0, data.sky));
  }
}

export function recordDetails(id, data, communication, previous) {
  switch (id) {
    case 'b612':
      return { lines: data.sproutRemoved ? ['장미를 살피러 가는 길에 바오밥 싹을 뽑았다.'] : [] };
    case 'pandora': {
      const lines = data.orbitSeen ? ['숲 위의 폴리페무스를 찾아, 판도라가 그 주위를 도는 위성임을 확인했다.'] : [];
      if (communication >= 8000) lines.push('지구 중계국 신호 · 편도 약 4.4년 · 왕복 약 8.7년');
      return { lines };
    }
    case 'adrian':
      return { lines: [
        ...(data.optics === 'tracked' ? ['적외선에서 타우 세티와 아드리안을 잇는 페트로바 선을 발견해, 그 끝에서 대기 시료를 채취했다.'] : []),
        `처음 확인한 배율 · ${data.firstMagnification}×`, '작품을 바탕으로 재현한 샘플'
      ] };
    case 'erid':
      return { lines: data.phase === 'contact' ? ['반향이 멎은 뒤 낮은음 → 높은음 → 중간음으로 응답해 교신했다.', '세 음은 에리드의 음성 언어를 바탕으로 구성한 체험용 신호다.'] : [] };
    case 'arrakis': {
      const report = waterReport(desertRoutes[data.path], 1, data.suitChecked);
      const paths = { ...previous?.paths, [data.path]: { ...report, photo: data.desertPhoto, observed: true } };
      return { paths, latestPath: data.path, lines: data.suitChecked ? [`스틸수트에서 시험용 물 ${suitTestVolume}mL를 회수한 뒤 사막을 건넜다.`] : [] };
    }
    case 'miller': {
      const { local, earth } = millerTimes(data.elapsed);
      const passed = Math.floor((data.elapsed + millerWavePeriod - millerWavePassedAt) / millerWavePeriod);
      const observed = passed === 1 ? '첫 파도가 지나가는 모습을 관측했다.'
        : passed > 1 ? `파도 ${passed}개가 지나가는 모습을 관측했다.`
          : data.elapsed >= millerCrestAt ? '눈앞으로 다가온 첫 파도의 마루를 관측했다.'
            : '수평선에서 다가오는 첫 파도를 관측했다.';
      return { lines: [`현지 체류 ${local} · 지구 경과 ${earth}`, observed, '영화 설정 · 현지 1시간 ≈ 지구 7년'] };
    }
    case 'tatooine':
      return { lines: data.orbitSeen ? ['지상에서 두 해가 지는 모습을 본 뒤, 케플러-16의 관측값을 적용한 궤도에서 두 별의 공통 질량 중심과 타투인의 바깥 궤도를 확인했다.'] : [] };
    default:
      return { lines: [] };
  }
}
