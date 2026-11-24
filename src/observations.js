import { defaultLocale, formatMessage, getLocale, joinLabels, t } from './copy/index.js';
import { communicationProgressMax, desertRoutes, echoName, millerTimes } from './destinations.js';
import { echoCount, echoDuration, echoInProgress, echoTargets } from './erid-sonar.js';
import { defaultOrbitRate, groundSkyAt, outerOrbit } from './tatooine-orbit.js';

export const newObservation = () => ({
  complete: false, elapsed: 0, phase: 'ready', light: 0, target: 0, magnification: 1,
  firstMagnification: null, path: null, sky: 0, visited: 0, sproutRemoved: false,
  nightSeen: false, orbitSeen: false, lookPitch: 0, scaleComparison: false, orbitZoom: 1, view: 'ground', viewProgress: 0, optics: 'visible',
  orbitDays: 0, orbitRate: defaultOrbitRate, orbitPlaying: false, reply: '', suitChecked: false,
  desertSurvey: null, desertPhoto: null, echoElapsed: null
});

export const adrianObservationMagnification = 3;
export const eridSignal = [0, 2, 1];
const eridToneKeys = ['erid.lowTone', 'erid.midTone', 'erid.highTone'];
export const eridTone = index => t(eridToneKeys[index]);
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

export const firstMillerWave = () => t('miller.firstWaveObservation', { earth: millerTimes(millerCrestAt).earth });

export function advanceObservation(id, data, delta, reduced) {
  if (id === 'pandora' || id === 'tatooine') {
    const viewTarget = data.view === 'orbit' ? (id === 'pandora' ? 2 : 1) : 0;
    const step = reduced ? 2 : delta / 950;
    data.viewProgress += Math.sign(viewTarget - data.viewProgress) * Math.min(Math.abs(viewTarget - data.viewProgress), step);
    if (data.view === 'orbit' && data.viewProgress === viewTarget && !data.orbitSeen) {
      data.orbitSeen = true;
      data.complete = true;
      if (id === 'pandora') return t('pandora.orbitObserved');
      return data.orbitPlaying ? t('tatooine.playStarted')
        : t('tatooine.inspectOrbit');
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
      return t('pandora.nightAnnouncement');
    }
  } else if (id === 'adrian' && data.phase === 'sampling') {
    data.elapsed = Math.min(5000, data.elapsed + delta);
    if (data.elapsed === 5000) {
      data.phase = 'sample';
      return t('adrian.sampleCollected');
    }
  } else if (id === 'erid' && echoInProgress(data)) {
    const count = echoCount(data);
    data.echoElapsed = Math.min(echoDuration, data.echoElapsed + delta);
    if (data.echoElapsed === echoDuration && data.phase === 'echo') {
      data.phase = 'reply';
      return t('erid.echoCompleteSignal');
    }
    if (data.echoElapsed === echoDuration) return t('erid.echoComplete');
    const received = echoCount(data);
    if (received > count) return t('erid.echoCount', { count: received, target: echoName(received - 1) });
  } else if (id === 'arrakis' && data.path && !data.complete) {
    const route = desertRoutes[data.path];
    if (data.elapsed < route.lookout) {
      data.elapsed = Math.min(route.lookout, data.elapsed + delta);
      if (data.elapsed === route.lookout) return route.prompt;
    } else if (data.desertSurvey !== null && data.desertSurvey < desertSurveyDuration) {
      data.desertSurvey = Math.min(desertSurveyDuration, data.desertSurvey + delta);
      if (data.desertSurvey === desertSurveyDuration) return t('arrakis.surveySaved', { title: route.title });
    } else if (data.desertSurvey === desertSurveyDuration && data.elapsed < route.duration) {
      data.elapsed = Math.min(route.duration, data.elapsed + delta);
      if (data.elapsed === route.duration) return t('arrakis.arrived');
    }
  } else if (id === 'miller' && !data.complete) {
    const before = data.elapsed;
    data.elapsed += delta;
    if (before < millerCrestAt && data.elapsed >= millerCrestAt) return firstMillerWave();
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
  if (visibleCount === 2 && separation < 1) return t('tatooine.overlappingShadows');
  return [t('tatooine.noShadow'), t('tatooine.oneShadow'), t('tatooine.twoShadows')][visibleCount];
}

export function observationStatus(id, data) {
  switch (id) {
    case 'pandora':
      if (data.view === 'orbit') return data.scaleComparison
        ? t('pandora.realScaleStatus')
        : t('pandora.fictionalScaleStatus');
      if (data.light !== data.target) return data.target ? t('pandora.turningNight') : t('pandora.turningDay');
      return data.light ? t('pandora.lookUp') : t('pandora.switchToNight');
    case 'adrian':
      if (data.phase === 'sampling') return data.elapsed < 3000 ? t('adrian.reachingAltitude') : t('adrian.collecting');
      if (data.phase === 'sample') return t('adrian.sampleCollected');
      if (data.phase === 'magnify') return data.magnification >= adrianObservationMagnification
        ? t('adrian.organisms') : t('adrian.zoomHint', { zoom: adrianObservationMagnification });
      return data.optics === 'tracked' ? t('adrian.lowerTracked') : t('adrian.lowerHint');
    case 'erid': {
      if (echoInProgress(data)) {
        const count = echoCount(data);
        if (count) return t('erid.echoReadout', { count, targets: joinLabels(Array.from({ length: count }, (_, index) => echoName(index))) });
        return data.echoElapsed < echoTargets[0].hitAt
          ? t('erid.echoOutgoing') : t('erid.echoReturning');
      }
      if (data.phase === 'contact') return t('erid.contact');
      if (data.phase === 'reply') return t('erid.replyHint');
      return t('erid.sendHint');
    }
    case 'arrakis': {
      const route = desertRoutes[data.path];
      switch (desertStep(data)) {
        case 'lookout': return route.prompt;
        case 'surveying': return t('arrakis.surveying', { title: route.title });
        case 'arrived': return t('arrakis.arrived');
        case 'complete': return t('arrakis.remainingAtArrival');
        case 'crossing': return data.desertSurvey === desertSurveyDuration
          ? t('arrakis.surveyComplete', { title: route.title })
          : t('arrakis.crossing', { route: route.name });
        default: return data.suitChecked ? t('arrakis.choosePath') : '';
      }
    }
    case 'miller': {
      if (data.complete) return t('miller.departed');
      const wave = Math.floor(data.elapsed / millerWavePeriod);
      const phase = data.elapsed % millerWavePeriod;
      if (phase >= millerWavePassedAt) return t('miller.wavePassed');
      if (phase >= millerCrestAt) return t('miller.waveCrest', { count: wave + 1 });
      return wave ? t('miller.nextWave') : t('miller.firstWave');
    }
    case 'tatooine':
      return data.view === 'orbit' ? (data.viewProgress === 1 ? '' : t('tatooine.enteringOrbit'))
        : tatooineShadowStatus(groundSkyAt(data.orbitDays ?? 0, data.sky));
  }
}

const recordEntryIds = {
  b612: ['sprout'],
  pandora: ['pandoraOrbit', 'sentGreeting'],
  adrian: ['trackedPetrova', 'sampleMagnification', 'sampleModel'],
  erid: ['answeredSignal', 'signalModel'],
  arrakis: ['recoveredWater'],
  miller: ['clocks', 'oneWave', 'waveCount', 'observedCrest', 'observedApproach', 'timeRatio'],
  tatooine: ['binaryOrbit']
};
const numericRecordEntries = new Set(['sampleMagnification', 'recoveredWater', 'clocks', 'waveCount']);

export function validRecordEntry(destination, entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (Object.hasOwn(entry, 'legacyText')) return typeof entry.legacyText === 'string';
  return recordEntryIds[destination].includes(entry.id)
    && (numericRecordEntries.has(entry.id) ? Number.isFinite(entry.value) : entry.value === undefined);
}

export function recordEntryText(entry, locale = getLocale()) {
  // Older saves can contain the retired Adrian note as an entry or as raw text.
  if (entry.id === 'sampleModel' || entry.legacyText === '작품을 바탕으로 재현한 샘플') return '';
  if (Object.hasOwn(entry, 'legacyText')) return entry.legacyText;
  const { id, value } = entry;
  const translate = (key, params) => formatMessage(locale, key, params);
  if (id === 'clocks') return translate('miller.clocks', millerTimes(value, locale));
  return translate('record.detail.' + id, {
    value, volume: id === 'recoveredWater' ? translate('common.milliliters', { amount: value }) : undefined
  });
}

function recordEntries(id, data, communication) {
  switch (id) {
    case 'b612':
      return data.sproutRemoved ? [{ id: 'sprout' }] : [];
    case 'pandora': {
      const entries = data.orbitSeen ? [{ id: 'pandoraOrbit' }] : [];
      if (communication >= communicationProgressMax) entries.push({ id: 'sentGreeting' });
      return entries;
    }
    case 'adrian':
      return [
        ...(data.optics === 'tracked' ? [{ id: 'trackedPetrova' }] : []),
        { id: 'sampleMagnification', value: data.firstMagnification }
      ];
    case 'erid':
      return data.phase === 'contact' ? [{ id: 'answeredSignal' }, { id: 'signalModel' }] : [];
    case 'arrakis':
      return data.suitChecked ? [{ id: 'recoveredWater', value: suitTestVolume }] : [];
    case 'miller': {
      const passed = Math.floor((data.elapsed + millerWavePeriod - millerWavePassedAt) / millerWavePeriod);
      const observed = passed > 1 ? { id: 'waveCount', value: passed }
        : { id: passed === 1 ? 'oneWave' : data.elapsed >= millerCrestAt ? 'observedCrest' : 'observedApproach' };
      return [{ id: 'clocks', value: data.elapsed }, observed, { id: 'timeRatio' }];
    }
    case 'tatooine':
      return data.orbitSeen ? [{ id: 'binaryOrbit' }] : [];
    default:
      return [];
  }
}

export function restoreRecordEntries(id, view, lines) {
  // Match recorded lines rather than the current expedition's communication or observation state.
  const candidates = recordEntries(id, view, communicationProgressMax).filter(entry => validRecordEntry(id, entry));
  const known = new Map(candidates.map(entry => [recordEntryText(entry, defaultLocale), entry]));
  return lines.map(line => known.get(line) ?? { legacyText: line });
}

export function recordDetails(id, data, communication, previous) {
  const entries = recordEntries(id, data, communication);
  if (id !== 'arrakis') return { entries };
  const report = waterReport(desertRoutes[data.path], 1, data.suitChecked);
  const paths = { ...previous?.paths, [data.path]: { ...report, photo: data.desertPhoto, observed: true } };
  return { entries, paths, latestPath: data.path };
}
