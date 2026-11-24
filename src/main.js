import './style.css';
import { adjustOrbit, createScene, initialOrbit } from './scene.js';
import { createAudio } from './audio.js';
import { introSections, introSectionAt, lastIntroSection } from './intro.js';

import { arrivalNodes, desertRoutes, destinations, distanceAnalogy, earthAngularDiameter, flightDuration, millerTimes, petrovaCheckpoint, routeFlight } from './destinations.js';
import { echoInProgress } from './erid-sonar.js';
import { newExpedition, restoreExpedition, saveVersion } from './expedition-state.js';
import { createExpeditionUI } from './expedition-ui.js';
import { departureStage, departureStops } from './routes-scene.js';
import { advanceObservation, desertStep, desertSurveyDuration, eridSignal, markTatooineSunset, newObservation, recordDetails, tatooineShadowStatus, waterReport } from './observations.js';
import { positionCallout } from './spatial-ui.js';
import { binaryOrbit, groundSkyAt, orbitRates, outerOrbit } from './tatooine-orbit.js';

const $ = id => document.getElementById(id);
const show = (id, on) => { $(id).hidden = !on; };
const copy = (id, value) => { $(id).textContent = value; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createAudio();
const key = 'fictional-planet-expedition:v1';
const first = { screen: 'intro', progress: 0, elapsed: 0, paused: false, covered: false, look: null };

let saved;
let corrupt = false;
let state = { ...first, ...newExpedition(), screen: 'start', sound: false, orbit: initialOrbit() };
let scene;
let booting = true;
let failure = false;
let contextLost = false;
let scrollHeight = 0;
let lastTime = 0;
let lastSave = 0;
let previousNodes = '';
let rosePoint;
let sproutPoint;
let roseMove;
let coverDrop;
let mapMotion;
let arrival;
const arrivalLayer = $('arrival-layer');
const viewFade = $('view-fade');
const arrivalDuration = 1450;
const approachDuration = 520;
const endingDuration = 6000;
const parallax = { x: 0, y: 0 };
const pointerAim = { x: 0, y: 0 };
let pointer;
let confirmAction;
let activeDialog;
let dialogTrigger;
let routeLoad;
let departureHeight = 0;
let launchInput = false;
let motionTime = 0;
const ui = createExpeditionUI({
  action: observeDestination, choose: chooseDestination, inspect: inspectDestination,
  read: openRecord, readSelected: () => openRecord(state.mapSelection, 'directory')
});

function readSaved() {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    saved = restoreExpedition(JSON.parse(raw)) ?? undefined;
    corrupt = !saved;
  } catch (error) {
    if (error instanceof SyntaxError) corrupt = true;
    else show('save-warning', true);
  }
}

function save() {
  if (state.screen === 'start') return;
  saved = { ...state, orbit: { ...state.orbit }, version: saveVersion };
  try {
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    show('save-warning', true);
  }
  lastSave = performance.now();
}

function throttledSave() {
  if (performance.now() - lastSave >= 250) save();
}

function setScroll(progress) {
  window.scrollTo(0, Math.round(progress * scrollHeight));
}

function stageIndex() {
  return introSectionAt(state.progress);
}

function renderNodes(names, current) {
  const signature = names.join('|') + current;
  if (signature === previousNodes) return;
  previousNodes = signature;
  const nodes = names.map((name, index) => {
    const item = document.createElement('li');
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.textContent = name;
    if (index === current) item.setAttribute('aria-current', 'step');
    if (index < current) {
      item.dataset.state = 'done';
      title.textContent += ' · 지나온 구간';
    }
    item.append(dot, title);
    return item;
  });
  $('route-nodes').replaceChildren(...nodes);
}

function earthObserver() {
  if (state.screen === 'log') return destinations[state.recordView];
  if (state.screen === 'launchpad') return destinations[state.from];
  if (['surface', 'orbit', 'rose'].includes(state.screen)) return destinations[state.destination];
  return null;
}

function renderScene() {
  const roseProgress = roseMove && (roseMove.destination === 'rose' ? roseMove.progress : 1 - roseMove.progress);
  const approach = arrival ? Math.min(1, arrival.elapsed / approachDuration) : 0;
  const arrivalPush = approach * approach * (3 - 2 * approach);
  scene?.render({
    ...state, ...(arrival?.captured && arrival.incoming), roseProgress, arrivalPush,
    earthReference: state.look === 'nav' ? earthObserver()?.reference : null,
    coverOffset: coverDrop?.offset, motionTime, parallax, mapMotion, reduceMotion: reduced.matches
  });
  const map = state.screen === 'directory';
  if (scene && (map || state.screen === 'launchpad')) {
    ui.positionRouteMarkers(scene.routePoints(), map, state.launchProgress, state.from, map ? state.mapSelection : state.destination);
  }
  const welcomeEarth = state.screen === 'start' ? scene?.welcomeEarth() : null;
  show('welcome-earth', Boolean(welcomeEarth));
  if (welcomeEarth) {
    $('welcome-earth').style.left = welcomeEarth.x + 'px';
    $('welcome-earth').style.top = welcomeEarth.y + 'px';
  }
  scene?.canvas.classList.toggle('sky-look', canLookAroundPandora());
  const signals = state.screen === 'surface' && !state.look ? scene?.surfaceSignals() : null;
  if (state.screen === 'surface') ui.positionSurface(signals);
  const fade = reduced.matches ? 0 : signals?.transitionFade ?? 0;
  if (viewFade.style.opacity !== String(fade)) viewFade.style.opacity = String(fade);
  const routed = state.screen === 'route-flight';
  const firstFlight = state.screen === 'flight';
  const target = state.look ? null : firstFlight ? scene?.firstFlightTarget()
    : routed || state.screen === 'launchpad' ? scene?.routeTarget() : null;
  const surveying = atPetrovaCheckpoint();
  const trackingOpacity = !surveying && target?.visible && target.radius < 28 && (!firstFlight || state.elapsed >= 1400)
    ? (target.trackingOpacity ?? 1) * (1 - Math.max(0, (target.radius - 9) / 19)) : 0;
  const marker = $('flight-target');
  marker.hidden = trackingOpacity <= 0;
  if (trackingOpacity > 0) {
    marker.style.left = target.x + '%';
    marker.style.top = target.y + '%';
    marker.style.opacity = String(trackingOpacity);
  }
  if (surveying && state.observation.optics === 'infrared') {
    positionCallout($('petrova-callout'), scene?.petrovaSignal(), { vertical: true });
  }
  if (routed) {
    const profile = routeFlight(state.from, state.destination);
    const progress = Math.floor(state.elapsed / profile.duration * 100);
    const reference = destinations[state.destination].reference;
    const comparison = reference ? ` · 지구에서 빛으로 약 ${reference.lightYears}년` : '';
    const note = `${profile.length} · 연출 ${profile.duration / 1000}초 · 진행 ${progress}%${comparison}`;
    if ($('metric-note').textContent !== note) copy('metric-note', note);
  }
  const inspectingRose = state.screen === 'rose' && !roseMove && !coverDrop;
  const orbiting = state.screen === 'orbit' && !roseMove;
  const sproutRemoved = state.observation.sproutRemoved;
  const roseAnchor = !activeDialog && ((orbiting && sproutRemoved) || inspectingRose) ? scene?.visibleRose() : null;
  rosePoint = orbiting ? roseAnchor : null;
  sproutPoint = !activeDialog && orbiting && !sproutRemoved ? scene?.visibleSprout() : null;
  if (!sproutPoint && document.activeElement === $('pull-sprout')) scene?.canvas.focus({ preventScroll: true });
  show('sprout-callout', Boolean(sproutPoint));
  if (sproutPoint) positionCallout($('sprout-callout'), sproutPoint, { radius: sproutPoint.radius });
  const button = $('observe');
  if (!rosePoint && button === document.activeElement) $('stage-title').focus({ preventScroll: true });
  show('observe', Boolean(rosePoint));
  show('rose-callout', Boolean(rosePoint || inspectingRose));
  if (rosePoint || inspectingRose) {
    positionCallout($('rose-callout'), roseAnchor, { radius: Math.max(9, (roseAnchor?.radius ?? 0) * (state.covered ? 1.65 : 1)) });
  }
}

function renderScreen() {
  const screen = state.screen;
  const phase = stageIndex();
  const welcome = screen === 'start';
  const logged = screen === 'log';
  const departure = screen === 'launchpad';
  const routed = screen === 'route-flight';
  const surface = screen === 'surface';
  const ending = screen === 'ending';
  const map = screen === 'directory';
  const archive = screen === 'archive';
  const journey = !welcome && !logged && !map && !archive && !ending;
  const flying = screen === 'flight' || routed;
  const inspecting = screen === 'rose';
  const orbiting = screen === 'orbit';
  const scaling = screen === 'intro';
  document.body.dataset.screen = screen;
  document.body.toggleAttribute('data-looking', Boolean(state.look));
  show('welcome', welcome);
  show('journey', journey);
  show('route-map', map);
  show('directory', archive);
  show('ending', ending);
  if (logged) ui.renderRecord(state);
  if (map) ui.renderMap(state);
  if (archive) ui.renderArchive(state);
  if (ending) {
    show('ending-question', state.endingProgress === 1);
    show('ending-step', reduced.matches && state.endingProgress < 1);
  }
  show('log', logged);
  show('start-actions', !saved && !corrupt);
  show('resume-actions', Boolean(saved) || corrupt);
  show('resume', Boolean(saved));
  show('welcome-status', booting || corrupt);
  copy('welcome-status', booting ? '관측 장면을 불러오는 중' : '이전 탐사를 열 수 없습니다.');
  for (const id of ['start-sound', 'start-muted', 'resume', 'new-journey']) $(id).disabled = booting;
  show('sound', !welcome && !ending);
  $('sound').setAttribute('aria-pressed', String(state.sound));
  copy('sound-label', state.sound ? '소리 끄기' : '소리 켜기');
  show('route-nodes', journey);
  if (scene) {
    scene.canvas.classList.toggle('orbit', orbiting);
    scene.canvas.classList.toggle('target', false);
    const onPandora = surface && state.destination === 'pandora';
    scene.canvas.tabIndex = orbiting || onPandora ? 0 : -1;
    scene.canvas.setAttribute('aria-label', onPandora ? '판도라 관측창. 위아래 방향키로 시선을 움직입니다.'
      : orbiting ? 'B612 관측창. 방향키로 회전하고 + 또는 −로 확대하거나 축소합니다.' : '3D 관측창');
  }

  const reference = departure || routed || surface ? destinations[state.destination].reference : null;
  copy('metric-distance-analogy', distanceAnalogy(reference));
  show('metric-distance-analogy', Boolean(reference));
  show('departure-actions', departure);
  show('departure-markers', departure);
  show('surface-actions', surface);
  show('observation-readout', surface);
  if (!surface) {
    show('surface-record', false);
    $('stage-title').classList.remove('in-scene');
  }
  show('transmit', (departure || routed) && state.destination === 'pandora');
  copy('transmit', state.communication === null ? '지구에서 인사 보내기' : '통신 기록 보기');
  show('intro-actions', scaling);
  show('prev-section', scaling && phase > 0);
  show('next-section', scaling && phase < lastIntroSection);
  show('launch', scaling && phase === lastIntroSection);
  const surveying = atPetrovaCheckpoint();
  const infrared = state.observation.optics === 'infrared';
  show('optics-actions', surveying);
  show('optics-frame', surveying && !activeDialog);
  show('petrova-callout', surveying && infrared);
  if (surveying) {
    $('optics-visible').setAttribute('aria-pressed', String(!infrared));
    $('optics-infrared').setAttribute('aria-pressed', String(infrared));
    $('optics-frame').classList.toggle('infrared', infrared);
    copy('optics-mode', infrared ? '적외선 · 의사색 영상' : '가시광선');
  }
  show('flight-actions', flying && !surveying);
  show('step-flight', flying && reduced.matches && (!routed || routePhase() < 3));
  show('pause-flight', flying && !arrival && !reduced.matches && (!routed || routePhase() < 3));
  show('orbit-actions', orbiting && !roseMove);
  show('rose-actions', inspecting && !roseMove && !coverDrop);
  show('cover', inspecting && state.observation.sproutRemoved && !state.covered && !roseMove);
  show('keep-looking', inspecting && !state.covered);
  show('record', inspecting && state.covered && !coverDrop);
  show('abort', flying || orbiting || inspecting || surface);
  show('look-back', !arrival && (flying || departure || surface || orbiting || inspecting || (scaling && phase >= 1)));

  if (scaling) {
    const data = introSections[phase];
    renderNodes(introSections.map(section => section.title), phase);
    copy('stage-context', '첫 목적지 · B612');
    copy('stage-title', data.title);
    copy('stage-description', data.subtitle);
    copy('metric-label', data.label);
    copy('metric', data.value);
    copy('metric-note', data.note);
    copy('instruction', phase === lastIntroSection ? '계속 스크롤하면 B612 자동 비행이 시작됩니다.' : '스크롤하여 지구에서 멀어지세요.');
  } else if (departure || routed || surface) {
    const destination = destinations[state.destination];
    const origin = destinations[state.from];
    const nodes = departure
      ? [origin.name + ' 근접', '주변 천체', '항로 조망']
      : [origin.name + ' 이탈', '항로 순항', destination.name + ' 접근', '도착'];
    const phase = departure ? departureStage(state.launchProgress) : surface ? 3 : routePhase();
    renderNodes(nodes, phase);
    copy('stage-context', origin.name + ' → ' + destination.name);
    copy('stage-title', surface ? destination.name : surveying ? '페트로바 선 관측' : nodes[phase]);
    copy('stage-description', surface ? destination.observation : `《${departure ? origin.work : destination.work}》`);
    copy('metric-label', '목적지 거리 기준');
    copy('metric', destination.distance);
    copy('metric-note', departure ? '스크롤로 시점 이동' : '');
    copy('flight-target-name', destination.name);
    show('departure-prev', departure && phase > 0);
    if (departure) copy('departure-next', phase === 2 ? '자동 항해로 이어가기 →' : '다음 시점 →');
    if (surface) ui.renderSurface(state);
    else copy('instruction', departure ? (phase === 2 ? '계속 멀어지면 목적지를 향해 자동 항해를 시작합니다.'
      : `스크롤로 ${origin.name}에서 멀어지며 주변 천체를 살펴보세요.`)
      : surveying ? infrared ? '띠가 닿는 행성을 찾았습니다. 페트로바 선을 따라가세요.' : '가시광선에서는 타우 세티와 행성 사이에 띠가 보이지 않습니다. 적외선으로 바꿔 보세요.'
        : arrival ? '관측 시점으로 이동하는 중…'
        : state.elapsed === flightDuration(state.from, state.destination) ? '관측 장면을 불러오는 중'
        : reduced.matches ? '정지 화면으로 비행 구간을 살펴보세요.'
          : state.paused ? '현재 위치에서 비행을 멈췄습니다.' : '관측창 너머로 목적지가 가까워집니다.');
    copy('pause-flight', state.paused ? '계속 비행' : '일시정지');
  } else if (flying || orbiting || inspecting) {
    const approaching = state.elapsed >= 5000;
    renderNodes(['B612 순항', 'B612 접근', '근접 관측'], flying ? Number(approaching) : 2);
    copy('stage-context', inspecting ? 'B612 · 장미 관측' : (destinations[state.from]?.name ?? '지구') + ' → B612');
    copy('stage-title', flying ? (approaching ? 'B612 접근' : 'B612 순항') : inspecting ? 'B612 장미 관측' : 'B612 근접 관측');
    copy('stage-description', orbiting ? '《어린 왕자》의 소행성' : '');
    copy('metric-label', '목적지 거리');
    copy('metric', '거리 미상');
    copy('metric-note', '가상 항로 · B612');
    copy('flight-target-name', 'B612');
    const message = flying
      ? (reduced.matches ? '정지 화면으로 비행 구간을 살펴보세요.' : state.paused ? '현재 위치에서 비행을 멈췄습니다.' : '관측창 너머로 B612가 가까워집니다.')
      : orbiting ? (state.observation.sproutRemoved ? '바오밥 싹을 뽑았습니다. 소행성을 돌며 장미를 찾아보세요.' : '소행성을 돌며 바오밥 싹을 찾으세요. 그 뒤 장미를 돌보러 갑니다.')
        : state.covered ? '장미를 유리 덮개로 보호했습니다.' : state.observation.sproutRemoved ? '' : '궤도로 돌아가 바오밥 싹을 먼저 뽑으세요.';
    copy('instruction', arrival ? 'B612 관측 시점으로 이동하는 중…'
      : coverDrop ? '유리 덮개를 내리는 중…'
      : roseMove ? (orbiting ? '장미에 접근하는 중…' : '이전 관측 위치로 돌아가는 중…') : message);
    copy('pause-flight', state.paused ? '계속 비행' : '일시정지');
  }
  renderScene();
  if (!journey || failure) window.scrollTo(0, 0);
}

function updateScrollArea() {
  document.body.style.setProperty('--scroll-height',
    state.screen === 'intro' ? (scrollHeight + window.innerHeight) + 'px'
      : state.screen === 'launchpad' ? (departureHeight + window.innerHeight) + 'px' : '100dvh');
}

function focusScreen() {
  if (state.screen === 'start') $('title').focus({ preventScroll: true });
  else if (state.screen === 'log') $('log-title').focus({ preventScroll: true });
  else if (state.screen === 'directory') $('map-title').focus({ preventScroll: true });
  else if (state.screen === 'archive') $('directory-title').focus({ preventScroll: true });
  else if (state.screen === 'ending') {
    if (state.endingProgress === 1) $('ending-title').focus({ preventScroll: true });
    else if (reduced.matches) $('ending-step').focus({ preventScroll: true });
  }
  else if (state.screen === 'orbit') scene?.canvas.focus({ preventScroll: true });
  else if (state.screen === 'rose') $(state.covered ? 'record' : state.observation.sproutRemoved ? 'cover' : 'keep-looking').focus({ preventScroll: true });
  else if (atPetrovaCheckpoint()) $('optics-infrared').focus({ preventScroll: true });
  else $('stage-title').focus({ preventScroll: true });
}

function announce(value) {
  copy('status', value);
}

function sound() {
  audio.mix(state.sound && state.screen !== 'start' && !document.hidden && !failure, state.screen, Boolean(state.look || state.communicationOpen));
}

function transition(screen, changes = {}) {
  arrival = roseMove = coverDrop = mapMotion = undefined;
  arrivalLayer.hidden = true;
  pointerAim.x = pointerAim.y = parallax.x = parallax.y = 0;
  state = { ...state, ...changes, screen };
  lastTime = 0;
  updateScrollArea();
  if (screen === 'intro') setScroll(state.progress);
  if (screen === 'launchpad') {
    launchInput = false;
    window.scrollTo(0, state.launchProgress * departureHeight);
  }
  renderScreen();
  if (screen === 'log') $('log-title').closest('.log-panel').scrollTop = 0;
  sound();
  save();
  focusScreen();
}

function start(withSound) {
  if (!scene || booting) return;
  scrollHeight = window.innerHeight * 3;
  transition('intro', { ...first, ...newExpedition(), sound: withSound, orbit: initialOrbit() });
}

function launch() {
  if (state.screen !== 'intro' || activeDialog || failure) return;
  scene.render({ ...state, progress: 1, reduceMotion: reduced.matches });
  transition('flight', { progress: 1, elapsed: 0, paused: false });
  announce('B612 자동 비행을 시작합니다.');
}

function scrollToProgress(progress) {
  window.scrollTo({
    top: Math.ceil(progress * scrollHeight),
    behavior: reduced.matches ? 'instant' : 'smooth'
  });
  focusScreen();
}

function goToSection(index) {
  const section = introSections[index];
  if (state.screen !== 'intro' || !section || activeDialog || failure) return;
  scrollToProgress(section.at);
}

function finishRoseMove(destination) {
  transition(destination);
  if (destination === 'rose') announce('장미를 찾았습니다.');
}

function finishCover() {
  coverDrop = undefined;
  renderScreen();
  save();
  if (state.sound) audio.coverChime();
  announce('장미를 유리 덮개로 보호했습니다.');
  $('record').focus({ preventScroll: true });
}

function moveRoseCamera(destination) {
  if (roseMove || activeDialog || failure) return;
  if (reduced.matches) {
    finishRoseMove(destination);
    return;
  }
  roseMove = { destination, progress: 0, elapsed: 0 };
  lastTime = 0;
  renderScreen();
  $('stage-title').focus({ preventScroll: true });
}

function pullSprout() {
  if (state.screen !== 'orbit' || !sproutPoint || activeDialog || failure) return;
  state.observation.sproutRemoved = true;
  renderScreen();
  save();
  announce('바오밥 싹을 뽑았습니다. 소행성을 돌며 장미를 찾아보세요.');
}

function observe() {
  if (state.screen !== 'orbit' || !rosePoint) return;
  moveRoseCamera('rose');
}

const directions = {
  left: [10, 0], right: [-10, 0], up: [0, 10], down: [0, -10],
  in: [0, 0, .9], out: [0, 0, 1 / .9]
};

function moveOrbit(x, y, scale) {
  if (state.screen !== 'orbit' || roseMove || activeDialog || failure) return;
  adjustOrbit(state.orbit, x, y, scale);
  renderScene();
  throttledSave();
}

function canLookAroundPandora() {
  return state.screen === 'surface' && state.destination === 'pandora'
    && state.observation.view === 'ground' && state.observation.viewProgress === 0
    && !activeDialog && !failure;
}

function movePandoraView(delta) {
  const data = state.observation;
  const pitch = data.lookPitch ?? 0;
  data.lookPitch = Math.max(0, Math.min(1, pitch + delta));
  if (data.lookPitch === pitch) return;
  renderScene();
  throttledSave();
}

function bindCanvas(canvas) {
  function atPoint(point, x, y) {
    return point && Math.hypot(x - point.x, y - point.y) <= Math.max(22, point.radius);
  }
  canvas.addEventListener('pointerdown', event => {
    const sky = canLookAroundPandora();
    if ((!sky && (state.screen !== 'orbit' || roseMove)) || event.button !== 0 || pointer) return;
    if (sky) canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) {
      canvas.classList.toggle('target', state.screen === 'orbit' && Boolean(atPoint(rosePoint ?? sproutPoint, event.clientX, event.clientY)));
      return;
    }
    if (Math.hypot(pointer.startX - event.clientX, pointer.startY - event.clientY) >= 6) pointer.dragging = true;
    if (!pointer.dragging) return;
    canvas.classList.remove('target');
    if (canLookAroundPandora()) movePandoraView((event.clientY - pointer.y) / Math.min(370, innerHeight * .52));
    else moveOrbit((pointer.x - event.clientX) * .45, (pointer.y - event.clientY) * .45);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const click = !pointer.dragging && Math.hypot(pointer.startX - event.clientX, pointer.startY - event.clientY) < 6;
    pointer = undefined;
    if (click && atPoint(sproutPoint, event.clientX, event.clientY)) pullSprout();
    else if (click && atPoint(rosePoint, event.clientX, event.clientY)) observe();
    else save();
  });
  canvas.addEventListener('lostpointercapture', () => { pointer = undefined; });
  canvas.addEventListener('wheel', event => {
    if (state.screen !== 'orbit' || activeDialog) return;
    event.preventDefault();
    const scale = Math.exp(Math.max(-.2, Math.min(.2, event.deltaY * .0011)));
    moveOrbit(0, 0, scale);
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (canLookAroundPandora() && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      movePandoraView(event.key === 'ArrowUp' ? .12 : -.12);
      save();
      return;
    }
    const aliases = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out' };
    const command = directions[aliases[event.key]];
    if (!command || state.screen !== 'orbit') return;
    event.preventDefault();
    moveOrbit(...command);
    save();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    showError('그래픽 연결이 끊겼습니다. 관측 장면을 다시 불러오세요.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (contextLost) restoreScene();
  });
}

function openDialog(id, trigger) {
  if (activeDialog) return;
  activeDialog = $(id);
  dialogTrigger = trigger;
  lastTime = 0;
  document.body.style.overflowY = 'hidden';
  activeDialog.showModal();
}

function restoreDialog() {
  if (state.communicationOpen) {
    openDialog('communication-dialog', $('transmit'));
    ui.renderCommunication(state.communication);
    sound();
    save();
    return;
  }
  if (state.look) {
    const notes = {
      moon: '달 가까이에서 바라본 지구의 대륙과 구름.',
      solar: '태양계 외곽에서 지구는 작은 점으로 보입니다.',
      voyager: '보이저 1호 사진을 참고한 연출.'
    };
    const stellar = state.look === 'stellar';
    const navigation = state.look === 'nav';
    const observer = navigation ? earthObserver() : null;
    const reference = observer?.reference;
    $('earth-dialog').dataset.view = state.look;
    $('earth-dialog').toggleAttribute('data-known-distance', Boolean(reference));
    copy('earth-context', stellar ? 'B612 탐사 이후' : observer ? `${observer.name}에서 지구 돌아보기` : '지구 돌아보기');
    copy('earth-title', stellar ? '가까운 항성계' : '우리가 떠나온 곳');
    copy('earth-note', stellar ? '태양계와 가장 가까운 항성계입니다.'
      : reference ? `${reference.name} 기준 약 ${reference.lightYears}광년. 지구에서 출발한 빛도 여기까지 약 ${reference.lightYears}년이 걸립니다.`
        : navigation ? '이 관측 위치에서는 지구까지의 직선거리를 정할 수 없습니다. 표식은 지구 방향을 보여줍니다.'
          : notes[state.look]);
    const comparisonReference = stellar ? destinations.pandora.reference : reference;
    copy('earth-distance-analogy', distanceAnalogy(comparisonReference));
    show('earth-distance-analogy', Boolean(comparisonReference));
    show('earth-angle', Boolean(reference));
    show('earth-reference', Boolean(reference));
    if (reference) {
      copy('earth-angle', `지구의 겉보기 지름 약 ${earthAngularDiameter(reference.lightYears)}마이크로각초 · 화면의 점은 비교를 위해 확대했습니다.`);
      const [label, url] = reference.source;
      copy('earth-reference', label + ' ↗');
      $('earth-reference').href = url;
    }
    show('stellar-distance', stellar);
    copy('earth-return', state.screen === 'log' ? '기록으로 돌아가기'
      : ['surface', 'orbit', 'rose'].includes(state.screen) ? '관측으로 돌아가기' : '항로로 돌아가기');
    openDialog('earth-dialog', $(stellar ? 'log-stellar' : state.screen === 'log' ? 'log-earth' : 'look-back'));
    renderScreen();
    sound();
    save();
  }
}

function lookBack() {
  if (activeDialog || arrival) return;
  const phase = stageIndex();
  if (state.screen === 'intro' && phase === 0) return;
  state.look = state.screen === 'intro' ? (phase === 1 ? 'moon' : 'solar')
    : state.screen === 'flight' ? 'voyager' : 'nav';
  restoreDialog();
}

function confirm(title, description, label, trigger, action) {
  copy('confirm-title', title);
  copy('confirm-copy', description);
  copy('confirm-action', label);
  confirmAction = action;
  openDialog('confirm-dialog', trigger);
}

function finishDialog(dialog) {
  if (activeDialog !== dialog || dialog.open) return;
  const trigger = dialogTrigger;
  activeDialog = dialogTrigger = undefined;
  lastTime = 0;
  document.body.style.overflowY = '';
  if (state.screen === 'launchpad') {
    launchInput = false;
    window.scrollTo(0, state.launchProgress * departureHeight);
  }
  if (dialog.id === 'communication-dialog' || dialog.id === 'earth-dialog') {
    state.communicationOpen = false;
    state.look = null;
    renderScreen();
    sound();
    save();
  }
  if (dialog.id === 'confirm-dialog') {
    const action = confirmAction;
    confirmAction = undefined;
    if (dialog.returnValue === 'confirm') {
      action?.();
      return;
    }
  }
  trigger?.focus({ preventScroll: true });
}

function closeDialog(dialog, value = '') {
  dialog.close(value);
  finishDialog(dialog);
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('close', () => finishDialog(dialog));
}

function showError(message) {
  failure = true;
  booting = false;
  lastTime = 0;
  save();
  sound();
  document.body.dataset.error = 'true';
  show('error', true);
  show('error-back', ['intro', 'flight', 'orbit', 'rose', 'launchpad', 'route-flight', 'surface'].includes(state.screen));
  copy('error-copy', message);
  $('retry').focus({ preventScroll: true });
}

async function restoreScene() {
  if (booting && scene) return;
  booting = true;
  contextLost = false;
  delete document.body.dataset.error;
  show('error', false);
  renderScreen();
  try {
    if (!scene) {
      scene = await createScene($('scene'), $('scene-labels'), $('look-labels'));
      bindCanvas(scene.canvas);
    }
    scene.resize();
    failure = false;
    booting = false;
    lastTime = 0;
    renderScreen();
    sound();
  } catch (error) {
    console.error(error);
    showError('WebGL 또는 장면 파일을 불러오지 못했습니다. 출처와 축척은 상단에서 읽을 수 있습니다.');
  }
}

$('start-sound').addEventListener('click', () => start(true));
$('start-muted').addEventListener('click', () => start(false));
$('resume').addEventListener('click', () => {
  if (!saved || !scene || booting) return;
  scrollHeight = window.innerHeight * 3;
  const { version, ...snapshot } = saved;
  if (reduced.matches && snapshot.destination === 'tatooine' && snapshot.observation.orbitPlaying) {
    snapshot.observation = { ...snapshot.observation, orbitPlaying: false };
  }
  if (snapshot.from && ['launchpad', 'route-flight'].includes(snapshot.screen)) prepareRoute(snapshot.destination);
  departureHeight = Math.round(window.innerHeight * 2);
  transition(snapshot.screen, snapshot);
  restoreDialog();
});
$('new-journey').addEventListener('click', event => {
  confirm('새 여정을 시작할까요?', '저장한 탐사 위치와 기록을 지우고 소리 선택 화면으로 돌아갑니다.', '새 여정', event.currentTarget, () => {
    saved = undefined;
    corrupt = false;
    try { localStorage.removeItem(key); } catch { show('save-warning', true); }
    transition('start', { ...first, ...newExpedition(), sound: false, orbit: initialOrbit() });
  });
});
$('sound').addEventListener('click', () => {
  state.sound = !state.sound;
  sound();
  save();
  renderScreen();
});
$('sources').addEventListener('click', event => openDialog('source-dialog', event.currentTarget));
$('prev-section').addEventListener('click', () => goToSection(stageIndex() - 1));
$('next-section').addEventListener('click', () => goToSection(stageIndex() + 1));
$('launch').addEventListener('click', () => scrollToProgress(1));
$('pause-flight').addEventListener('click', () => {
  state.paused = !state.paused;
  lastTime = 0;
  renderScreen();
  save();
});
$('step-flight').addEventListener('click', () => {
  if (state.screen === 'route-flight') {
    if (atPetrovaCheckpoint()) return;
    const phase = Math.min(3, routePhase() + 1);
    state.elapsed = Math.round(arrivalNodes[phase] * flightDuration(state.from, state.destination));
    renderScreen();
    save();
    if (atPetrovaCheckpoint()) $('optics-infrared').focus({ preventScroll: true });
    if (phase < 3) announce($('stage-title').textContent);
    return;
  }
  if (state.screen !== 'flight') return;
  if (state.elapsed < 5000) {
    state.elapsed = 5000;
    renderScreen();
    save();
    announce('B612 접근');
  } else transition('orbit');
});
$('pull-sprout').addEventListener('click', pullSprout);
$('observe').addEventListener('click', observe);
$('optics-visible').addEventListener('click', () => setOptics('visible'));
$('optics-infrared').addEventListener('click', () => setOptics('infrared'));
$('track-petrova').addEventListener('click', () => setOptics('tracked'));
$('keep-looking').addEventListener('click', () => {
  if (state.screen === 'rose' && !state.covered) moveRoseCamera('orbit');
});
$('cover').addEventListener('click', () => {
  if (state.screen !== 'rose' || !state.observation.sproutRemoved || state.covered || roseMove) return;
  state.covered = true;
  if (reduced.matches) finishCover();
  else {
    coverDrop = { elapsed: 0, offset: .38 };
    lastTime = 0;
    renderScreen();
    $('stage-title').focus({ preventScroll: true });
    save();
  }
});
$('record').addEventListener('click', () => {
  if (state.screen === 'rose' && state.covered) saveObservation('b612');
});
$('home').addEventListener('click', () => transition('start'));
$('look-back').addEventListener('click', lookBack);
$('log-earth').addEventListener('click', lookBack);
$('log-stellar').addEventListener('click', () => {
  if (state.screen !== 'log' || state.recordView !== 'b612' || activeDialog) return;
  state.look = 'stellar';
  restoreDialog();
});
$('abort').addEventListener('click', event => {
  confirm('탐사를 중단할까요?', state.from ? '지금 항로의 출항 대기로 돌아갑니다.' : 'B612 출항 직전 위치로 돌아갑니다.',
    '탐사 중단', event.currentTarget, returnToLaunch);
});
$('confirm-action').addEventListener('click', () => closeDialog($('confirm-dialog'), 'confirm'));
$('retry').addEventListener('click', () => {
  if (!routeLoad?.failed) {
    restoreScene();
    return;
  }
  failure = false;
  delete document.body.dataset.error;
  show('error', false);
  prepareRoute(state.destination);
});
$('error-back').addEventListener('click', () => {
  const routeError = routeLoad?.failed;
  returnToLaunch();
  if (routeError) {
    failure = false;
    delete document.body.dataset.error;
    show('error', false);
    routeLoad = undefined;
    renderScreen();
    sound();
    focusScreen();
  } else restoreScene();
});
for (const button of document.querySelectorAll('[data-orbit]')) {
  button.addEventListener('click', () => {
    moveOrbit(...directions[button.dataset.orbit]);
    save();
  });
}
window.addEventListener('wheel', event => {
  if (state.screen === 'launchpad' && !activeDialog && !event.ctrlKey) {
    launchInput = true;
  }
}, { passive: true });
window.addEventListener('keydown', event => {
  if (state.screen === 'launchpad' && !activeDialog && ['ArrowDown', 'PageDown', 'End', 'ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
    launchInput = true;
  }
});
window.addEventListener('pointerdown', () => {
  if (state.screen === 'launchpad' && !activeDialog) launchInput = true;
}, { passive: true });
window.addEventListener('scroll', () => {
  if (state.screen === 'launchpad' && !activeDialog && !failure) {
    if (!launchInput) {
      window.scrollTo(0, state.launchProgress * departureHeight);
      return;
    }
    const previous = departureStage(state.launchProgress);
    // Map integer scroll pixels back to the same stops used by the keyboard controls.
    const position = window.scrollY;
    const stop = departureStops.find(progress => Math.round(progress * departureHeight) === position);
    state.launchProgress = stop ?? Math.min(1, Math.max(0, position / departureHeight));
    if (state.launchProgress >= 1 - .5 / departureHeight) {
      state.launchProgress = 1;
      renderScene();
      depart();
    } else {
      if (previous === departureStage(state.launchProgress)) renderScene();
      else {
        renderScreen();
        announce($('stage-title').textContent);
        if (document.activeElement === document.body) $('departure-next').focus({ preventScroll: true });
      }
      throttledSave();
    }
    return;
  }
  if (state.screen !== 'intro' || activeDialog || failure || !scrollHeight) return;
  const previousSection = stageIndex();
  state.progress = Math.min(1, Math.max(0, window.scrollY / scrollHeight));
  if (state.progress >= 1 - .5 / scrollHeight) {
    launch();
    return;
  }
  renderScreen();
  if (previousSection !== stageIndex()) announce(introSections[stageIndex()].title);
  throttledSave();
}, { passive: true });
window.addEventListener('resize', () => {
  scene?.resize();
  if (state.screen === 'intro') {
    scrollHeight = window.innerHeight * 3;
    updateScrollArea();
    setScroll(state.progress);
  }
  if (state.screen === 'launchpad') {
    departureHeight = Math.round(window.innerHeight * 2);
    updateScrollArea();
    window.scrollTo(0, state.launchProgress * departureHeight);
  }
  renderScreen();
});
reduced.addEventListener('change', () => {
  lastTime = 0;
  renderScreen();
});
window.addEventListener('pagehide', save);
window.addEventListener('blur', () => { lastTime = 0; save(); });
window.addEventListener('focus', () => { lastTime = 0; });
document.addEventListener('visibilitychange', () => {
  lastTime = 0;
  if (document.hidden) save();
  sound();
});

function routePhase() {
  const duration = flightDuration(state.from, state.destination);
  return state.elapsed >= duration ? 3 : state.elapsed >= Math.round(duration * .7) ? 2
    : state.elapsed >= Math.round(duration * .25) ? 1 : 0;
}

function atPetrovaCheckpoint() {
  return state.screen === 'route-flight' && state.destination === 'adrian'
    && state.observation.optics !== 'tracked' && state.elapsed >= petrovaCheckpoint(state.from);
}

function setOptics(mode) {
  if (!atPetrovaCheckpoint() || activeDialog || failure || mode === state.observation.optics
    || (mode === 'tracked' && state.observation.optics !== 'infrared')) return;
  state.observation.optics = mode;
  lastTime = 0;
  renderScreen();
  save();
  if (mode === 'tracked') {
    announce('페트로바 선을 따라 아드리안에 접근합니다.');
    $(reduced.matches ? 'step-flight' : 'stage-title').focus({ preventScroll: true });
  } else announce($('instruction').textContent);
}

function prepareRoute(id) {
  const load = { id, ready: id === 'b612' };
  routeLoad = load;
  if (load.ready) return;
  scene.prepare(id).then(() => {
    if (routeLoad !== load) return;
    load.ready = true;
    if (state.screen === 'route-flight' && routePhase() === 3 && !activeDialog && !state.paused) arrive();
  }).catch(error => {
    if (routeLoad !== load) return;
    load.failed = true;
    console.error(error);
    showError('목적지 관측 장면을 불러올 수 없습니다.');
  });
}

function inspectDestination(id, keyboard) {
  if (state.screen !== 'directory') return;
  if (state.mapSelection !== id && !reduced.matches) {
    mapMotion = { from: state.mapSelection, start: performance.now(), progress: 0 };
  }
  state.mapSelection = id;
  ui.renderMap(state);
  renderScene();
  save();
  if (keyboard) $('map-world-name').focus({ preventScroll: true });
}

function chooseDestination() {
  const id = state.mapSelection;
  if (state.screen !== 'directory' || !id || id === state.current) return;
  departureHeight = Math.round(window.innerHeight * 2);
  prepareRoute(id);
  transition('launchpad', {
    from: state.current, destination: id, launchProgress: 0, elapsed: 0, paused: false, covered: false,
    look: null, communication: null, communicationOpen: false, observation: newObservation()
  });
}

function depart() {
  if (state.screen !== 'launchpad' || activeDialog || failure) return;
  if (!routeLoad) prepareRoute(state.destination);
  transition('route-flight', { elapsed: 0, paused: false });
  announce($('stage-context').textContent + ' · 자동 비행 시작');
}

function finishArrival(incoming) {
  const { screen, ...changes } = incoming;
  motionTime = 0;
  transition(screen, changes);
  announce(destinations[state.destination].name + '에 도착했습니다.');
}

function beginArrival() {
  if (arrival || activeDialog || failure) return;
  const incoming = state.destination === 'b612'
    ? { screen: 'orbit', orbit: initialOrbit() }
    : { screen: 'surface', observation: { ...newObservation(), optics: state.observation.optics } };
  if (reduced.matches) {
    finishArrival(incoming);
    return;
  }
  arrival = { incoming, elapsed: 0, captured: false };
  lastTime = 0;
  renderScreen();
  save();
}

function arrive() {
  if (state.screen !== 'route-flight' || activeDialog || failure) return;
  if (routeLoad?.ready) beginArrival();
  else renderScreen();
}

function tickArrival(now) {
  if (!arrival) return false;
  if (activeDialog || failure || document.hidden || !document.hasFocus()) {
    lastTime = 0;
    return true;
  }
  if (lastTime) arrival.elapsed += now - lastTime;
  lastTime = now;
  if (reduced.matches || arrival.elapsed >= arrivalDuration) {
    finishArrival(arrival.incoming);
    return true;
  }
  if (arrival.elapsed >= approachDuration && !arrival.captured) {
    // Copy the final approach frame while it is still in the WebGL drawing buffer.
    renderScene();
    const context = arrivalLayer.getContext('2d');
    if (!context) {
      finishArrival(arrival.incoming);
      return true;
    }
    arrivalLayer.width = scene.canvas.width;
    arrivalLayer.height = scene.canvas.height;
    context.drawImage(scene.canvas, 0, 0);
    arrival.captured = true;
    arrivalLayer.hidden = false;
  }
  if (arrival.captured) {
    const blend = (arrival.elapsed - approachDuration) / (arrivalDuration - approachDuration);
    arrivalLayer.style.opacity = String(1 - blend * blend * (3 - 2 * blend));
  }
  renderScene();
  return true;
}

function returnToLaunch() {
  if (state.from) {
    transition('launchpad', {
      launchProgress: 0, elapsed: 0, paused: false, covered: false, look: null,
      observation: newObservation(), communicationOpen: false
    });
  } else {
    transition('intro', { ...first, progress: introSections[lastIntroSection].at, orbit: initialOrbit(), observation: newObservation() });
  }
}

function openRecord(id, back) {
  if (state.records[id]) transition('log', { recordView: id, recordBack: back });
}

function saveObservation(id) {
  const data = state.observation;
  if (id === 'tatooine') data.orbitPlaying = false;
  const record = recordDetails(id, data, state.communication, state.records[id]);
  const view = { ...data };
  if (id === 'arrakis') view.desertPhoto = null;
  const records = { ...state.records, [id]: { ...record, view } };
  const order = state.records[id] ? state.order : [...state.order, id];
  transition('log', { records, order, current: id, recordView: id, recordBack: null });
}

function captureDesertPhoto() {
  const source = scene?.canvas;
  if (!source?.width || !source.height) return null;
  const photo = document.createElement('canvas');
  photo.width = 480;
  photo.height = 270;
  const scale = Math.max(photo.width / source.width, photo.height / source.height);
  const width = photo.width / scale, height = photo.height / scale;
  const context = photo.getContext('2d');
  if (!context) return null;
  // Copy the centered scene while the current WebGL frame is still available.
  context.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height,
    0, 0, photo.width, photo.height);
  return photo.toDataURL('image/jpeg', .82);
}

function observeDestination(action, value) {
  if (state.screen !== 'surface' || activeDialog || failure) return;
  const id = state.destination;
  const data = state.observation;
  if (action === 'record' && data.complete) {
    saveObservation(id);
    return;
  }
  let focus;
  switch (id) {
    case 'pandora':
      if ((action === 'day' || action === 'night') && data.view === 'ground') {
        data.target = Number(action === 'night');
        if (action === 'night') scene?.canvas.focus({ preventScroll: true });
      } else if (action === 'polyphemus' && canLookAroundPandora()
        && data.target === 1 && !$('find-polyphemus').closest('[data-anchor]').hidden) {
        data.view = 'orbit';
        data.viewProgress = data.lookPitch ?? 0;
        focus = 'stage-title';
      } else if (action === 'pandora-ground' && data.view === 'orbit') {
        // Keep the starting angle even when the user turns back during the pullback.
        data.viewProgress = Math.max(data.viewProgress, data.lookPitch ?? 0);
        data.view = 'ground';
        data.lookPitch = 0;
        data.scaleComparison = false;
        data.orbitZoom = 1;
      } else if (data.view === 'orbit' && data.viewProgress === 2 && action === 'compare-scale') {
        data.scaleComparison = !data.scaleComparison;
      } else if (data.view === 'orbit' && data.viewProgress === 2 && action === 'pandora-zoom' && value >= 1 && value <= 8) {
        data.orbitZoom = value;
      } else return;
      break;
    case 'adrian':
      if (action === 'lower' && data.phase === 'ready') {
        data.phase = 'sampling';
        data.elapsed = 0;
        announce('채취 고도에 도달하는 중');
        focus = 'stage-title';
      } else if (action === 'sample' && data.phase === 'sample') {
        data.phase = 'magnify';
        focus = 'magnification';
      } else if (action === 'magnification' && data.phase === 'magnify' && value >= 1 && value <= 4) {
        data.magnification = value;
        if (value >= 3 && !data.complete) {
          data.firstMagnification = value;
          data.complete = true;
          announce('미생물 형상 관찰');
        }
      } else return;
      break;
    case 'erid':
      if (action === 'echo' && !echoInProgress(data)) {
        if (data.phase === 'ready') data.phase = 'echo';
        data.echoElapsed = 0;
        announce('음파를 보냈습니다.');
      } else if (action === 'replay-erid' && data.phase === 'reply') {
        announce('수신 신호 · 낮은음, 높은음, 중간음');
      } else if (data.phase === 'reply' && /^tone-[012]$/.test(action)) {
        const tone = Number(action.at(-1));
        if (tone !== eridSignal[data.reply.length]) {
          data.reply = '';
          announce('신호가 다릅니다. 첫 음부터 다시 답하세요.');
        } else {
          data.reply += tone;
          if (data.reply.length === eridSignal.length) {
            data.phase = 'contact';
            data.complete = true;
            announce('교신 성공. 같은 세 음이 다시 돌아왔습니다.');
            focus = 'surface-record';
          } else announce(`응답 ${data.reply.length} / ${eridSignal.length}`);
        }
      } else return;
      break;
    case 'arrakis': {
      const step = desertStep(data);
      if (action === 'suit' && !data.path && !data.suitChecked) {
        data.suitChecked = true;
        announce('스틸수트 점검 완료. 이동할 경로를 고르세요.');
        focus = 'desert-sun';
      } else if (data.suitChecked && Object.hasOwn(desertRoutes, action) && !data.path) {
        data.path = action;
        data.elapsed = 0;
        announce(desertRoutes[action].name + ' · 이동 시작');
        focus = 'stage-title';
      } else if (action === 'desert-survey' && step === 'lookout') {
        data.desertSurvey = 0;
        announce(desertRoutes[data.path].title + ' · 관측 중');
        focus = 'stage-title';
      } else if (action === 'desert-water' && step === 'arrived') {
        data.complete = true;
        const { left } = waterReport(desertRoutes[data.path], 1, data.suitChecked);
        announce(`도착 잔량 ${left}mL`);
        focus = 'surface-record';
      } else return;
      break;
    }
    case 'miller': {
      if (action !== 'depart' || data.complete) return;
      data.complete = true;
      const { local, earth } = millerTimes(data.elapsed);
      saveObservation(id);
      announce(`현지 체류 ${local} · 지구 경과 ${earth}`);
      return;
    }
    case 'tatooine': {
      const onGround = data.view === 'ground' && data.viewProgress === 0;
      const inOrbit = data.view === 'orbit' && data.viewProgress === 1;
      if (action === 'tatooine-orbit' && onGround && data.visited === 3) {
        data.view = 'orbit';
        data.orbitPlaying = !reduced.matches && data.orbitDays < outerOrbit.period;
        focus = 'stage-title';
        break;
      }
      if (action === 'tatooine-ground' && inOrbit) {
        data.view = 'ground';
        data.orbitPlaying = false;
        focus = 'stage-title';
        break;
      }
      if (!onGround && !inOrbit) return;

      const previous = onGround && groundSkyAt(data.orbitDays, data.sky);
      if (action === 'orbit-play') {
        if (data.orbitDays === outerOrbit.period) data.orbitDays = 0;
        data.orbitPlaying = !data.orbitPlaying;
        lastTime = 0;
      } else if (action === 'orbit-first-cycle' || action === 'orbit-reset'
        || (action === 'orbit-time' && value >= 0 && value <= outerOrbit.period)) {
        data.orbitDays = action === 'orbit-first-cycle' ? binaryOrbit.period : action === 'orbit-reset' ? 0 : value;
        data.orbitPlaying = false;
      } else if (action === 'orbit-rate' && orbitRates.includes(value)) {
        data.orbitRate = value;
      } else if (onGround) {
        const presets = { 'tatooine-day': 0, 'tatooine-dusk': previous.betweenSunsets, 'tatooine-night': 100 };
        const sky = action === 'sky-time' ? value : presets[action];
        if (!Number.isFinite(sky) || sky < 0 || sky > 100) return;
        data.sky = sky;
      } else return;

      if (onGround) {
        const sky = groundSkyAt(data.orbitDays, data.sky);
        markTatooineSunset(data, sky.visibleCount);
        if (previous.visibleCount !== sky.visibleCount) announce(tatooineShadowStatus(sky));
      }
      break;
    }
  }
  const message = reduced.matches && (id === 'pandora' || id === 'tatooine') && advanceObservation(id, data, 0, true);
  if (message) announce(message);
  if (message && data.view === 'orbit' && data.complete) focus = id === 'tatooine' ? 'orbit-play' : 'surface-record';
  ui.renderSurface(state);
  renderScene();
  sound();
  save();
  if (focus) $(focus).focus({ preventScroll: true });
  else if (action === 'pandora-ground') scene?.canvas.focus({ preventScroll: true });
}

function startEnding() {
  if (state.order.length === 7) transition('ending', { endingProgress: 0 });
}

$('log-next').addEventListener('click', () => transition('directory', { directoryBack: 'log', mapSelection: null }));
$('log-ending').addEventListener('click', startEnding);
$('log-back').addEventListener('click', () => transition(state.recordBack, { recordBack: null }));
$('directory-back').addEventListener('click', () => transition('ending', { endingProgress: 1 }));
$('map-back').addEventListener('click', () => {
  if (state.directoryBack === 'archive') transition('archive');
  else openRecord(state.current, null);
});
$('archive-next').addEventListener('click', () => transition('directory', { directoryBack: 'archive', mapSelection: null }));
$('archive-earth').addEventListener('click', startEnding);
$('ending-step').addEventListener('click', () => transition('ending', { endingProgress: 1 }));
$('ending-records').addEventListener('click', () => transition('archive'));
function scrollDeparture(direction) {
  if (state.screen !== 'launchpad' || activeDialog || failure) return;
  const stage = departureStage(state.launchProgress);
  const next = Math.min(departureStops.length - 1, Math.max(0, stage + direction));
  launchInput = true;
  if (next === 0 && document.activeElement === $('departure-prev')) $('departure-next').focus({ preventScroll: true });
  window.scrollTo({
    top: Math.round(departureStops[next] * departureHeight),
    behavior: reduced.matches ? 'instant' : 'smooth'
  });
}

$('departure-prev').addEventListener('click', () => scrollDeparture(-1));
$('departure-next').addEventListener('click', () => scrollDeparture(1));
$('cancel-departure').addEventListener('click', () => transition('directory'));
$('transmit').addEventListener('click', () => {
  if (activeDialog || failure) return;
  state.communication ??= 0;
  state.communicationOpen = true;
  restoreDialog();
  copy('transmit', '통신 기록 보기');
});

function tickExpedition(now, viewpointChanged) {
  const screen = state.screen;
  const communicating = activeDialog?.id === 'communication-dialog';
  if (!communicating && !['route-flight', 'surface', 'ending'].includes(screen)) return false;
  if (!scene || booting || failure || (activeDialog && !communicating) || document.hidden || !document.hasFocus()) {
    lastTime = 0;
    return true;
  }
  const delta = lastTime ? now - lastTime : 0;
  lastTime = now;
  if (communicating) {
    if (state.communication < 8000) {
      const step = Math.floor(state.communication / 4000);
      state.communication = Math.min(8000, state.communication + delta);
      ui.renderCommunication(state.communication);
      if (Math.floor(state.communication / 4000) > step) {
        announce(step ? '지구에서 답장 수신 · 발신 후 약 8.7년' : '판도라 방향에 신호 도착 · 약 4.4년');
      }
      throttledSave();
    }
  } else if (screen === 'route-flight') {
    if (atPetrovaCheckpoint() || (state.paused || reduced.matches) && routePhase() !== 3) return true;
    const phase = routePhase();
    const limit = state.destination === 'adrian' && state.observation.optics !== 'tracked'
      ? petrovaCheckpoint(state.from) : flightDuration(state.from, state.destination);
    state.elapsed = Math.min(limit, state.elapsed + delta);
    if (atPetrovaCheckpoint()) {
      renderScreen();
      save();
      announce($('instruction').textContent);
      if (document.activeElement === $('pause-flight') || document.activeElement === document.body) $('optics-infrared').focus({ preventScroll: true });
    } else if (routePhase() === 3) {
      if (phase !== 3) renderScreen();
      if (routeLoad?.ready && phase === 3) arrive();
    } else if (phase !== routePhase()) {
      renderScreen();
      announce($('stage-title').textContent);
    } else renderScene();
    throttledSave();
  } else if (screen === 'surface') {
    const data = state.observation;
    const id = state.destination;
    const before = {
      elapsed: data.elapsed, light: data.light, complete: data.complete, phase: data.phase,
      view: data.viewProgress, orbitDay: data.orbitDays, orbitPlaying: data.orbitPlaying,
      desertSurvey: data.desertSurvey, echoElapsed: data.echoElapsed
    };
    const message = advanceObservation(id, data, delta, reduced.matches);
    const orbitChanged = id === 'tatooine' && (before.orbitDay !== data.orbitDays || before.orbitPlaying !== data.orbitPlaying);
    const changed = before.elapsed !== data.elapsed || before.light !== data.light || before.complete !== data.complete
      || before.phase !== data.phase || before.view !== data.viewProgress || before.desertSurvey !== data.desertSurvey
      || before.echoElapsed !== data.echoElapsed;
    const animating = !reduced.matches && ((id === 'adrian' && data.phase === 'magnify')
      || (id === 'pandora' && data.view === 'orbit' && data.orbitSeen));
    if (changed || orbitChanged || animating) motionTime += delta;
    if (changed) ui.renderSurface(state);
    else if (orbitChanged) ui.renderOrbitTime(data);
    if (changed || orbitChanged) throttledSave();
    if (changed || orbitChanged || animating || viewpointChanged) renderScene();
    if (message) {
      if (id === 'arrakis') {
        if (before.desertSurvey !== data.desertSurvey && data.desertSurvey === desertSurveyDuration) {
          data.desertPhoto = captureDesertPhoto();
        }
        if (document.activeElement === $('stage-title')) {
          const step = desertStep(data);
          if (step === 'lookout') $('desert-survey').focus({ preventScroll: true });
          if (step === 'arrived') $('desert-water').focus({ preventScroll: true });
        }
      }
      announce(message);
      if (id === 'adrian') {
        if (document.activeElement === $('stage-title')) $('open-sample').focus({ preventScroll: true });
      }
    }
    if (document.activeElement === $('stage-title') && data.complete && data.view === 'orbit' && message) {
      $(id === 'tatooine' ? 'orbit-play' : 'surface-record').focus({ preventScroll: true });
    }
    if (before.complete !== data.complete || before.phase !== data.phase || (before.orbitPlaying && !data.orbitPlaying) || message) save();
  } else if (screen === 'ending' && !reduced.matches && state.endingProgress < 1) {
    state.endingProgress = Math.min(1, state.endingProgress + delta / endingDuration);
    if (state.endingProgress === 1) {
      renderScreen();
      focusScreen();
      save();
    } else {
      renderScene();
      throttledSave();
    }
  }
  return true;
}

const parallaxScreens = new Set(['start', 'surface', 'directory']);
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !parallaxScreens.has(state.screen) ||
      reduced.matches || activeDialog || event.target.closest?.('button, a, input')) return;
  pointerAim.x = event.clientX / window.innerWidth * 2 - 1;
  pointerAim.y = event.clientY / window.innerHeight * 2 - 1;
}, { passive: true });
window.addEventListener('pointerout', event => {
  if (!event.relatedTarget) pointerAim.x = pointerAim.y = 0;
});

function updateParallax() {
  if (!scene || !parallaxScreens.has(state.screen) || activeDialog || failure || document.hidden) return false;
  const x = reduced.matches ? 0 : pointerAim.x;
  const y = reduced.matches ? 0 : pointerAim.y;
  const moving = Math.abs(x - parallax.x) + Math.abs(y - parallax.y) > .005;
  if (moving) {
    const damping = reduced.matches ? 1 : .14;
    parallax.x += (x - parallax.x) * damping;
    parallax.y += (y - parallax.y) * damping;
  }
  return moving;
}

function tick(now) {
  requestAnimationFrame(tick);
  const viewpointChanged = updateParallax();
  if (state.screen === 'directory' && mapMotion && !activeDialog && !failure) {
    const phase = reduced.matches ? 1 : Math.min(1, (now - mapMotion.start) / 460);
    mapMotion.progress = phase * phase * (3 - 2 * phase);
    if (phase === 1) mapMotion = undefined;
    renderScene();
  } else if (viewpointChanged && state.screen !== 'surface') renderScene();
  if (tickArrival(now) || tickExpedition(now, viewpointChanged)) return;
  if (coverDrop && scene && !booting && !failure && !activeDialog && !document.hidden && document.hasFocus()) {
    if (lastTime) coverDrop.elapsed += now - lastTime;
    lastTime = now;
    const t = Math.min(1, coverDrop.elapsed / 650);
    if (t === 1 || reduced.matches) finishCover();
    else {
      coverDrop.offset = .38 * ((1 - t) ** 2 * (1 + 2 * t));
      renderScene();
    }
    return;
  }
  if (roseMove && scene && !booting && !failure && !activeDialog && !document.hidden && document.hasFocus()) {
    if (lastTime) roseMove.elapsed += now - lastTime;
    lastTime = now;
    const duration = roseMove.destination === 'rose' ? 950 : 800;
    const t = Math.min(1, roseMove.elapsed / duration);
    if (t === 1 || reduced.matches) finishRoseMove(roseMove.destination);
    else {
      roseMove.progress = t * t * (3 - 2 * t);
      renderScene();
    }
    return;
  }
  if (state.screen !== 'flight' || !scene || booting || failure || state.paused || activeDialog || reduced.matches || document.hidden || !document.hasFocus()) {
    lastTime = 0;
    return;
  }
  const before = state.elapsed;
  if (lastTime) state.elapsed = Math.min(8000, state.elapsed + now - lastTime);
  lastTime = now;
  if (state.elapsed >= 8000) {
    beginArrival();
    return;
  }
  if (before < 5000 && state.elapsed >= 5000) {
    renderScreen();
    announce('B612 접근');
  } else renderScene();
  throttledSave();
}

history.scrollRestoration = 'manual';
readSaved();
restoreScene();
requestAnimationFrame(tick);
