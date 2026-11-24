import { desertRoutes, destinationIds, flightDuration, petrovaCheckpoint } from './destinations.js';
import { echoDuration } from './erid-sonar.js';
import { desertSurveyDuration, newObservation, restoreRecordEntries, validRecordEntry } from './observations.js';
import { defaultOrbitRate, orbitRates, outerOrbit } from './tatooine-orbit.js';

const experienceSaveVersion = 4;
export const saveVersion = 5;

export const newExpedition = () => ({
  records: {}, order: [], current: null, destination: 'b612', from: null,
  recordView: 'b612', recordBack: null, directoryBack: 'log', mapSelection: null, communication: null,
  communicationOpen: false, launchProgress: 0, endingProgress: 0, observation: newObservation()
});

const isDestination = id => destinationIds.includes(id);
const between = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const validPhoto = photo => photo == null || (typeof photo === 'string' && photo.length < 120_000
  && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo));
const previousSeconds = [
  [0, 10, 12, 14, 13, 15, 11],
  [9, 0, 10, 12, 13, 15, 12],
  [12, 10, 0, 9, 12, 14, 13],
  [13, 12, 9, 0, 13, 15, 14],
  [12, 13, 11, 13, 0, 14, 8],
  [14, 15, 14, 15, 14, 0, 15],
  [10, 12, 13, 14, 8, 15, 0]
];
const originalScreens = ['intro', 'flight', 'orbit', 'rose', 'log'];
const routedScreens = ['launchpad', 'route-flight', 'surface'];

export function restoreExpedition(data) {
  if (!data || !['intro', 'flight', 'orbit', 'rose', 'log', 'directory', 'archive', 'ending', ...routedScreens].includes(data.screen)
    || !between(data.progress, 0, 1) || !Number.isFinite(data.elapsed) || data.elapsed < 0
    || !data.orbit || ![data.orbit.theta, data.orbit.phi, data.orbit.radius].every(Number.isFinite)
    || data.orbit.radius <= 0
    || ![data.sound, data.paused, data.covered].every(value => typeof value === 'boolean')
    || ![null, 'moon', 'solar', 'voyager', 'nav', 'stellar'].includes(data.look)) return null;
  if (data.version === 1) {
    if (!originalScreens.includes(data.screen) || data.elapsed > 8000 || (data.screen === 'log' && !data.covered)
      || (data.look === 'stellar' && data.screen !== 'log')) return null;
    const voyage = newExpedition();
    if (data.screen === 'log') {
      voyage.records.b612 = { entries: [], view: {} };
      voyage.order.push('b612');
      voyage.current = 'b612';
    }
    return { ...data, ...voyage, version: saveVersion };
  }
  if (![2, 3, experienceSaveVersion, saveVersion].includes(data.version) || !isDestination(data.destination) || !isDestination(data.recordView)
    || ![null, 'directory', 'archive'].includes(data.recordBack) || !['log', 'archive'].includes(data.directoryBack)
    || ![null, ...destinationIds].includes(data.from) || ![null, ...destinationIds].includes(data.current)
    || !between(data.launchProgress, 0, 1) || !between(data.endingProgress, 0, 1)
    || ![true, false].includes(data.communicationOpen)
    || (data.communication !== null && !between(data.communication, 0, 8000))
    || (data.communicationOpen && (data.destination !== 'pandora' || !['launchpad', 'route-flight'].includes(data.screen)))) return null;
  if (data.look === 'stellar' && (data.screen !== 'log' || data.recordView !== 'b612')) return null;
  if (!data.records || typeof data.records !== 'object' || Array.isArray(data.records)
    || !Array.isArray(data.order) || new Set(data.order).size !== data.order.length
    || data.order.length !== Object.keys(data.records).length
    || (data.order.length ? !data.order.includes(data.current) : data.current !== null)
    || (data.order.length && data.order[0] !== 'b612')) return null;
  if (!data.order.every(id => {
    if (!isDestination(id)) return false;
    const record = data.records[id];
    if (data.version === saveVersion) {
      if (!Array.isArray(record?.entries) || !record.entries.every(entry => validRecordEntry(id, entry))) return false;
    } else if (!Array.isArray(record?.lines) || !record.lines.every(line => typeof line === 'string')) return false;
    if (id === 'arrakis' && (!record.paths || !Object.keys(record.paths).every(path => Object.hasOwn(desertRoutes, path))
      || !Object.hasOwn(record.paths, record.latestPath)
      || !Object.values(record.paths).every(value => value && between(value.spent, 0, 100)
        && between(value.left, 0, 100)
        && (value.observed === undefined || value.observed === true) && validPhoto(value.photo)
        && (value.recovered === undefined || between(value.recovered, 0, 100))))) return false;
    return id === 'b612' || validObservation(record.view, data.version);
  })) return null;
  if (data.screen === 'log' && !data.records[data.recordView]) return null;
  if (data.screen === 'directory' && !data.current) return null;
  if (['archive', 'ending'].includes(data.screen) && data.order.length !== 7) return null;
  let elapsed = data.elapsed;
  if (routedScreens.includes(data.screen)) {
    if (!data.from || data.from !== data.current || data.from === data.destination) return null;
    const duration = flightDuration(data.from, data.destination);
    if (data.version === 2) {
      const previousDuration = previousSeconds[destinationIds.indexOf(data.from)][destinationIds.indexOf(data.destination)] * 1000;
      if (elapsed > previousDuration) return null;
      elapsed = elapsed / previousDuration * duration;
    }
    if (elapsed > duration) return null;
  } else if (data.screen === 'flight' && elapsed > 8000) return null;
  if (!validObservation(data.observation, data.version)) return null;
  const legacy = data.version < experienceSaveVersion;
  let observation = legacy ? upgradeObservation(data.destination, data.observation) : data.observation;
  if (data.destination === 'erid' && observation.phase === 'echo' && observation.echoElapsed == null) {
    // Older saves only track the outgoing ring. Restart that in-flight scan with the new round trip.
    observation = { ...observation, echoElapsed: 0 };
  }
  if (data.destination === 'arrakis' && data.screen === 'surface' && data.observation.desertSurvey === undefined) {
    // Earlier saves let the camera cross the whole route without an observation stop.
    const route = desertRoutes[observation.path];
    observation = { ...observation, desertSurvey: null, desertPhoto: null, complete: false,
      elapsed: route ? Math.min(observation.elapsed, route.lookout) : 0 };
  }
  if (data.destination === 'tatooine') {
    const orbitDays = Math.min(observation.orbitDays ?? 0, outerOrbit.period);
    observation = { ...observation, orbitDays, orbitRate: observation.orbitRate ?? defaultOrbitRate,
      orbitPlaying: data.screen === 'surface' && observation.view === 'orbit'
        && orbitDays < outerOrbit.period && observation.orbitPlaying === true };
  }
  if (data.destination === 'pandora' && observation.view === 'sky') {
    observation = { ...observation, lookPitch: Math.min(1, observation.viewProgress), view: 'ground', viewProgress: 0 };
  }
  if (data.screen === 'surface' && data.destination === 'miller' && observation.waveChoice === 'observe') {
    // Old saves marked the six-second sequence complete before the visitor departed.
    observation = { ...observation, complete: false };
  }
  if (data.screen === 'route-flight' && data.destination === 'adrian' && observation.optics !== 'tracked') {
    elapsed = Math.min(elapsed, petrovaCheckpoint(data.from));
  }
  const records = data.version === saveVersion ? data.records : Object.fromEntries(
    Object.entries(data.records).map(([id, { lines, ...record }]) => {
      const view = legacy ? upgradeObservation(id, record.view ?? {}) : record.view ?? {};
      return [id, { ...record, view, entries: restoreRecordEntries(id, view, lines) }];
    })
  );
  return { ...data, version: saveVersion, records, observation, elapsed,
    mapSelection: isDestination(data.mapSelection) ? data.mapSelection : null };
}

function upgradeObservation(id, data) {
  const observation = { ...newObservation(), ...data };
  if (id === 'pandora') observation.nightSeen = data.complete || data.light === 1;
  return observation;
}

function validObservation(data, version) {
  return Boolean(data && typeof data.complete === 'boolean'
    && ['ready', 'sampling', 'sample', 'magnify', 'echo', 'reply', 'contact'].includes(data.phase)
    && Number.isFinite(data.elapsed) && data.elapsed >= 0
    && between(data.light, 0, 1) && [0, 1].includes(data.target)
    && between(data.magnification, 1, 4)
    && (data.firstMagnification === null || between(data.firstMagnification, 3, 4))
    && (data.path === null || Object.hasOwn(desertRoutes, data.path))
    && (data.desertSurvey == null || between(data.desertSurvey, 0, desertSurveyDuration))
    && (data.echoElapsed == null || between(data.echoElapsed, 0, echoDuration))
    && validPhoto(data.desertPhoto)
    && between(data.sky, 0, 100) && [0, 1, 2, 3].includes(data.visited)
    && (version < experienceSaveVersion || validExperience(data)));
}

function validExperience(data) {
  return [data.sproutRemoved, data.nightSeen, data.orbitSeen, data.suitChecked].every(value => typeof value === 'boolean')
    && ['ground', 'sky', 'orbit'].includes(data.view) && between(data.viewProgress, 0, 2)
    && (data.lookPitch === undefined || between(data.lookPitch, 0, 1))
    && (data.scaleComparison === undefined || typeof data.scaleComparison === 'boolean')
    && (data.orbitZoom === undefined || between(data.orbitZoom, 1, 8))
    && (data.orbitDays === undefined || between(data.orbitDays, 0, Number(outerOrbit.period.toFixed(2))))
    && (data.orbitRate === undefined || orbitRates.includes(data.orbitRate))
    && ['visible', 'infrared', 'tracked'].includes(data.optics)
    && typeof data.reply === 'string' && /^[012]{0,3}$/.test(data.reply);
}
