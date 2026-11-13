import './style.css';
import { adjustOrbit, createScene, initialOrbit } from './scene.js';
import { createAudio } from './audio.js';
import { introSections, introSectionAt, lastIntroSection } from './intro.js';

const $ = id => document.getElementById(id);
const show = (id, on) => { $(id).hidden = !on; };
const copy = (id, value) => { $(id).textContent = value; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const audio = createAudio();
const key = 'fictional-planet-expedition:v1';
const first = { screen: 'intro', progress: 0, elapsed: 0, paused: false, covered: false, look: null };

let saved;
let corrupt = false;
let state = { ...first, screen: 'start', sound: false, orbit: initialOrbit() };
let scene;
let booting = true;
let failure = false;
let contextLost = false;
let scrollHeight = 0;
let lastTime = 0;
let lastSave = 0;
let previousNodes = '';
let rosePoint;
let pointer;
let confirmAction;
let activeDialog;
let dialogTrigger;

function readSaved() {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    const data = JSON.parse(raw);
    const orbit = data.orbit;
    if (data.version !== 1 || !['intro', 'flight', 'orbit', 'rose', 'log'].includes(data.screen)
      || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1
      || !Number.isFinite(data.elapsed) || data.elapsed < 0 || data.elapsed > 8000
      || !orbit || ![orbit.theta, orbit.phi, orbit.radius].every(Number.isFinite)
      || typeof data.sound !== 'boolean' || typeof data.paused !== 'boolean' || typeof data.covered !== 'boolean'
      || ![null, 'moon', 'solar', 'voyager', 'nav', 'stellar'].includes(data.look)
      || (data.look === 'stellar' && data.screen !== 'log')
      || (data.screen === 'log' && !data.covered)) {
      corrupt = true;
      return;
    }
    saved = data;
  } catch (error) {
    if (error instanceof SyntaxError) corrupt = true;
    else show('save-warning', true);
  }
}

function save() {
  if (state.screen === 'start') return;
  saved = { ...state, orbit: { ...state.orbit }, version: 1 };
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

function renderScene() {
  scene?.render({ ...state, reduceMotion: reduced.matches });
  rosePoint = state.screen === 'orbit' && !activeDialog ? scene?.visibleRose() : null;
  const button = $('observe');
  if (!rosePoint && button === document.activeElement) $('stage-title').focus({ preventScroll: true });
  show('observe', Boolean(rosePoint));
}

function renderScreen() {
  const screen = state.screen;
  const phase = stageIndex();
  const welcome = screen === 'start';
  const logged = screen === 'log';
  const flying = screen === 'flight';
  const inspecting = screen === 'rose';
  const orbiting = screen === 'orbit';
  const scaling = screen === 'intro';
  document.body.dataset.screen = screen;
  document.body.toggleAttribute('data-looking', Boolean(state.look));
  show('welcome', welcome);
  show('journey', !welcome && !logged);
  show('log', logged);
  show('start-actions', !saved && !corrupt);
  show('resume-actions', Boolean(saved) || corrupt);
  show('resume', Boolean(saved));
  show('welcome-status', booting || corrupt);
  copy('welcome-status', booting ? '관측 장면을 불러오는 중' : '이전 탐사를 열 수 없습니다.');
  for (const id of ['start-sound', 'start-muted', 'resume', 'new-journey']) $(id).disabled = booting;
  show('sound', !welcome);
  $('sound').setAttribute('aria-pressed', String(state.sound));
  copy('sound-label', state.sound ? '소리 끄기' : '소리 켜기');
  show('route-nodes', !welcome && !logged);
  const frame = document.querySelector('.cockpit');
  frame.hidden = welcome || logged || Boolean(state.look);
  frame.classList.toggle('warm', flying || orbiting || inspecting || (scaling && phase >= 2));
  if (scene) {
    scene.canvas.classList.toggle('orbit', orbiting);
    scene.canvas.classList.toggle('target', false);
    scene.canvas.tabIndex = orbiting ? 0 : -1;
  }

  show('intro-actions', scaling);
  show('prev-section', scaling && phase > 0);
  show('next-section', scaling && phase < lastIntroSection);
  show('launch', scaling && phase === lastIntroSection);
  show('flight-actions', flying);
  show('step-flight', flying && reduced.matches);
  show('pause-flight', flying && !reduced.matches);
  show('orbit-actions', orbiting);
  show('rose-actions', inspecting);
  show('cover', inspecting && !state.covered);
  show('keep-looking', inspecting && !state.covered);
  show('record', inspecting && state.covered);
  show('abort', flying || orbiting || inspecting);
  show('look-back', flying || (scaling && phase >= 1));

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
  } else if (flying || orbiting || inspecting) {
    const approaching = state.elapsed >= 5000;
    renderNodes(['B612 순항', 'B612 접근', '근접 관측'], flying ? Number(approaching) : 2);
    copy('stage-context', '지구 → B612');
    copy('stage-title', flying ? (approaching ? 'B612 접근' : 'B612 순항') : 'B612 근접 관측');
    copy('stage-description', flying ? '' : '《어린 왕자》의 소행성');
    copy('metric-label', '목적지 거리');
    copy('metric', '거리 미상');
    copy('metric-note', '가상 항로 · B612');
    const message = flying
      ? (reduced.matches ? '정지 화면으로 비행 구간을 살펴보세요.' : state.paused ? '현재 위치에서 비행을 멈췄습니다.' : '관측창 너머로 B612가 가까워집니다.')
      : orbiting ? '드래그로 회전 · 휠 또는 + / −로 확대와 축소'
        : state.covered ? '장미를 유리 덮개로 보호했습니다.' : '장미 위에 유리 덮개를 씌우세요.';
    copy('instruction', message);
    copy('pause-flight', state.paused ? '계속 비행' : '일시정지');
  }
  renderScene();
  if (welcome || logged || failure) window.scrollTo(0, 0);
}

function updateScrollArea() {
  document.body.style.setProperty('--scroll-height',
    state.screen === 'intro' ? (scrollHeight + window.innerHeight) + 'px' : '100dvh');
}

function focusScreen() {
  if (state.screen === 'start') $('title').focus({ preventScroll: true });
  else if (state.screen === 'log') $('log-title').focus({ preventScroll: true });
  else if (state.screen === 'orbit') scene?.canvas.focus({ preventScroll: true });
  else if (state.screen === 'rose') $(state.covered ? 'record' : 'cover').focus({ preventScroll: true });
  else $('stage-title').focus({ preventScroll: true });
}

function announce(value) {
  copy('status', value);
}

function sound() {
  audio.mix(state.sound && state.screen !== 'start' && !document.hidden && !failure, state.screen, Boolean(state.look));
}

function transition(screen, changes = {}) {
  state = { ...state, ...changes, screen };
  lastTime = 0;
  updateScrollArea();
  if (screen === 'intro') setScroll(state.progress);
  renderScreen();
  sound();
  save();
  focusScreen();
}

function start(withSound) {
  if (!scene || booting) return;
  scrollHeight = window.innerHeight * 3;
  transition('intro', { ...first, sound: withSound, orbit: initialOrbit() });
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

function observe() {
  if (state.screen !== 'orbit' || !rosePoint) return;
  transition('rose');
  announce('장미를 찾았습니다.');
}

const directions = {
  left: [10, 0], right: [-10, 0], up: [0, 10], down: [0, -10],
  in: [0, 0, .9], out: [0, 0, 1 / .9]
};

function moveOrbit(x, y, scale) {
  if (state.screen !== 'orbit' || activeDialog || failure) return;
  adjustOrbit(state.orbit, x, y, scale);
  renderScene();
  throttledSave();
}

function bindCanvas(canvas) {
  function onRose(x, y) {
    return rosePoint && Math.abs(x - rosePoint.x) <= 22 && Math.abs(y - rosePoint.y) <= 22;
  }
  canvas.addEventListener('pointerdown', event => {
    if (state.screen !== 'orbit' || event.button !== 0 || pointer) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) {
      canvas.classList.toggle('target', state.screen === 'orbit' && Boolean(onRose(event.clientX, event.clientY)));
      return;
    }
    if (Math.hypot(pointer.startX - event.clientX, pointer.startY - event.clientY) >= 6) pointer.dragging = true;
    if (!pointer.dragging) return;
    canvas.classList.remove('target');
    moveOrbit((pointer.x - event.clientX) * .45, (pointer.y - event.clientY) * .45);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const click = !pointer.dragging && Math.hypot(pointer.startX - event.clientX, pointer.startY - event.clientY) < 6;
    pointer = undefined;
    if (click && onRose(event.clientX, event.clientY)) observe();
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
  if (state.look) {
    const notes = {
      moon: '달 가까이에서 바라본 지구의 대륙과 구름.',
      solar: '태양계 외곽에서 지구는 작은 점으로 보입니다.',
      voyager: '보이저 1호 사진을 참고한 연출.',
      nav: '지구 방향 · 항법 연출'
    };
    const stellar = state.look === 'stellar';
    $('earth-dialog').dataset.view = state.look;
    copy('earth-context', stellar ? 'B612 탐사 이후' : '지구 돌아보기');
    copy('earth-title', stellar ? '가까운 항성계' : '우리가 떠나온 곳');
    copy('earth-note', stellar ? '지구–태양 사이를 1cm로 줄이면, 알파 센타우리 A까지는 약 2.8km입니다.' : notes[state.look]);
    show('stellar-distance', stellar);
    copy('earth-return', state.screen === 'log' ? '기록으로 돌아가기' : '항로로 돌아가기');
    openDialog('earth-dialog', $(stellar ? 'log-stellar' : state.screen === 'log' ? 'log-earth' : 'look-back'));
    renderScreen();
    sound();
    save();
  }
}

function lookBack() {
  if (activeDialog) return;
  const phase = stageIndex();
  if (state.screen === 'intro' && phase === 0) return;
  state.look = state.screen === 'log' ? 'nav' : state.screen === 'flight' ? 'voyager' : phase === 1 ? 'moon' : 'solar';
  restoreDialog();
}

function confirm(title, description, label, trigger, action) {
  copy('confirm-title', title);
  copy('confirm-copy', description);
  copy('confirm-action', label);
  confirmAction = action;
  openDialog('confirm-dialog', trigger);
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    const trigger = dialogTrigger;
    activeDialog = dialogTrigger = undefined;
    lastTime = 0;
    document.body.style.overflowY = '';
    if (dialog.id === 'earth-dialog') {
      state.look = null;
      renderScreen();
      sound();
      save();
    }
    if (dialog.id === 'confirm-dialog') {
      const action = confirmAction;
      confirmAction = undefined;
      if (dialog.returnValue === 'confirm') {
        dialog.returnValue = '';
        action?.();
        return;
      }
    }
    trigger?.focus({ preventScroll: true });
  });
}

function showError(message) {
  failure = true;
  booting = false;
  lastTime = 0;
  save();
  sound();
  document.body.dataset.error = 'true';
  show('error', true);
  show('error-back', state.screen !== 'start' && state.screen !== 'log');
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
  transition(snapshot.screen, snapshot);
  restoreDialog();
});
$('new-journey').addEventListener('click', event => {
  confirm('새 여정을 시작할까요?', '저장한 탐사 위치와 기록을 지우고 소리 선택 화면으로 돌아갑니다.', '새 여정', event.currentTarget, () => {
    saved = undefined;
    corrupt = false;
    try { localStorage.removeItem(key); } catch { show('save-warning', true); }
    transition('start', { ...first, sound: false, orbit: initialOrbit() });
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
  if (state.screen !== 'flight') return;
  if (state.elapsed < 5000) {
    state.elapsed = 5000;
    renderScreen();
    save();
    announce('B612 접근');
  } else transition('orbit');
});
$('observe').addEventListener('click', observe);
$('keep-looking').addEventListener('click', () => transition('orbit'));
$('cover').addEventListener('click', () => {
  if (state.screen !== 'rose' || state.covered) return;
  state.covered = true;
  renderScreen();
  save();
  if (state.sound) audio.coverChime();
  announce('장미를 유리 덮개로 보호했습니다.');
  $('record').focus({ preventScroll: true });
});
$('record').addEventListener('click', () => {
  if (state.screen === 'rose' && state.covered) transition('log');
});
$('home').addEventListener('click', () => transition('start'));
$('look-back').addEventListener('click', lookBack);
$('log-earth').addEventListener('click', lookBack);
$('log-stellar').addEventListener('click', () => {
  if (state.screen !== 'log' || activeDialog) return;
  state.look = 'stellar';
  restoreDialog();
});
$('abort').addEventListener('click', event => {
  confirm('탐사를 중단할까요?', 'B612 출항 직전 위치로 돌아갑니다.', '탐사 중단', event.currentTarget, () => {
    transition('intro', { ...first, progress: introSections[lastIntroSection].at, orbit: initialOrbit() });
  });
});
$('confirm-action').addEventListener('click', () => $('confirm-dialog').close('confirm'));
$('retry').addEventListener('click', restoreScene);
$('error-back').addEventListener('click', () => {
  transition('intro', { ...first, progress: introSections[lastIntroSection].at, orbit: initialOrbit() });
  restoreScene();
});
for (const button of document.querySelectorAll('[data-orbit]')) {
  button.addEventListener('click', () => {
    moveOrbit(...directions[button.dataset.orbit]);
    save();
  });
}
window.addEventListener('scroll', () => {
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

function tick(now) {
  requestAnimationFrame(tick);
  if (state.screen !== 'flight' || !scene || booting || failure || state.paused || activeDialog || reduced.matches || document.hidden || !document.hasFocus()) {
    lastTime = 0;
    return;
  }
  const before = state.elapsed;
  if (lastTime) state.elapsed = Math.min(8000, state.elapsed + now - lastTime);
  lastTime = now;
  if (state.elapsed >= 8000) {
    transition('orbit');
    announce('B612에 도착했습니다.');
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
