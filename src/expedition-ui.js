import { MathUtils, Vector3 } from 'three';
import { desertRoutes, destinationIds, destinations, distanceAnalogy, millerTimes, pandoraScale, routeFlight } from './destinations.js';
import { echoInProgress } from './erid-sonar.js';
import { desertStep, eridNotes, eridSignal, firstMillerWave, millerCrestAt, observationStatus, suitTestVolume, tatooineShadowStatus, waterReport } from './observations.js';
import { positionCallout } from './spatial-ui.js';
import { auKm, binaryOrbit, groundSkyAt, orbitPosition, orbitRates, outerOrbit } from './tatooine-orbit.js';

const { smoothstep } = MathUtils;
const $ = id => document.getElementById(id);
const show = (id, on) => { $(id).hidden = !on; };
const copy = (id, text) => { if ($(id).textContent !== text) $(id).textContent = text; };
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
};

const unit = (key, content) => `<div class="buttons spatial-callout" data-anchor="${key}">${content}</div>`;
const action = (id, label, key, primary = false) =>
  `<button type="button" id="${id}" class="button${primary ? ' primary' : ''}" data-action="${key}">${label}</button>`;
const tatooineOrbitControls = `<div class="binary-controls" id="tatooine-orbit-panel" hidden>
  <div class="binary-time">
    ${action('orbit-play', '궤도 재생', 'orbit-play')}
    <label class="range-label">
      <span class="sr-only">공전 날짜</span>
      <input type="range" id="orbit-time" min="0" max="${outerOrbit.period}" step=".001" value="0">
    </label>
    <span class="binary-day" id="orbit-time-value"></span>
  </div>
  <div class="binary-time-options">
    ${action('orbit-first-cycle', '두 태양 1주기', 'orbit-first-cycle')}
    ${action('orbit-reset', '처음으로', 'orbit-reset')}
    <select id="orbit-rate" aria-label="궤도 재생 속도">
      ${orbitRates.map(rate => `<option value="${rate}">${rate}일/초</option>`).join('')}
    </select>
    ${action('tatooine-ground', '지상으로 돌아가기', 'tatooine-ground')}
    ${action('tatooine-orbit', '궤도에서 보기', 'tatooine-orbit', true)}
  </div>
</div>`;
const km = value => Math.round(value).toLocaleString('ko-KR') + ' km';
const starSeparation = new Vector3();
const controls = {
  pandora: unit('forest-light', action('forest-day', '낮', 'day') + action('forest-night', '밤', 'night'))
    + unit('polyphemus', action('find-polyphemus', '폴리페무스 살펴보기', 'polyphemus', true))
    + unit('orbit-return', '<label id="pandora-zoom-label" class="range-label"><span id="pandora-zoom-label-text">판도라 근처 확대</span> <input type="range" id="pandora-zoom" min="1" max="8" step=".5" value="1"><output id="pandora-zoom-value" for="pandora-zoom"></output></label>'
      + action('compare-pandora-scale', '해왕성–트리톤과 비교', 'compare-scale')
      + action('pandora-ground', '숲으로 돌아가기', 'pandora-ground')),
  adrian: unit('sampling', action('lower-probe', '탐사선 내리기', 'lower', true) + action('open-sample', '샘플 관찰', 'sample', true)
    + '<label id="magnify-label" class="range-label" hidden>시료 확대 <input id="magnification" type="range" min="1" max="4" step=".5" value="1"><output id="magnification-value" for="magnification"></output></label>'),
  erid: unit('emitter', action('send-echo', '음파 보내기', 'echo', true))
    + unit('reply', action('replay-erid', '신호 다시 듣기', 'replay-erid')
      + eridNotes.map((label, index) => action('send-tone-' + index, label + ' 보내기', 'tone-' + index)).join('')),
  arrakis: unit('suit', action('check-suit', '스틸수트 점검하기', 'suit', true))
    + unit('sun-path', action('desert-sun', '<strong id="sun-name"></strong><span id="sun-forecast"></span>', 'sun'))
    + unit('shade-path', action('desert-shade', '<strong id="shade-name"></strong><span id="shade-forecast"></span>', 'shade'))
    + unit('desert-lookout', action('desert-survey', '', 'desert-survey', true))
    + action('desert-water', '스틸수트 물통 꺼내기', 'desert-water', true),
  miller: unit('departure', action('miller-depart', '밀러에서 출발', 'depart', true)),
  tatooine: unit('sunset', '<label id="tatooine-time" class="range-label">하루 중 시각 <input id="sky-time" type="range" min="0" max="100" step="any" value="0"></label>'
    + action('tatooine-day', '두 해', 'tatooine-day') + action('tatooine-dusk', '첫 해가 진 뒤', 'tatooine-dusk')
    + action('tatooine-night', '두 해가 모두 진 뒤', 'tatooine-night'))
    + tatooineOrbitControls
};

function signalBars(tones) {
  return tones.map(tone => `<i data-tone="${tone}" style="--pitch:${tone}"></i>`).join('');
}

function waterBottle(left) {
  const bottle = element('div', '', 'water-bottle');
  bottle.setAttribute('aria-hidden', 'true');
  const chamber = bottle.appendChild(element('span', '', 'water-bottle-chamber'));
  chamber.append(element('i', '', 'water-bottle-fill'), element('i', '', 'water-bottle-marks'));
  bottle.style.setProperty('--water', left + '%');
  return bottle;
}

function desertRecordCards(paths) {
  const cards = element('div', '', 'desert-record-cards');
  for (const [key, { left, observed, photo }] of paths) {
    const route = desertRoutes[key];
    const card = element('section', '', 'desert-record-card');
    const water = element('div', '', 'desert-record-water');
    water.append(waterBottle(left), element('strong', left + 'mL'));
    card.append(element('h4', route.name), water);
    if (photo) {
      const image = document.createElement('img');
      image.src = photo;
      image.alt = route.title;
      image.width = 480;
      image.height = 270;
      card.append(image);
    }
    if (observed) card.append(element('p', route.description));
    cards.append(card);
  }
  return cards;
}

export function createExpeditionUI(callbacks) {
  let renderedSurface;
  let recordSignature;
  const surface = $('surface-actions');
  const echoLabels = $('echo-labels');
  const orbitLabels = $('orbit-labels');
  const echoes = Array.from({ length: 3 }, () => element('span', '', 'echo-caption'));
  echoLabels.replaceChildren(...echoes);
  const bodyLabels = Array.from({ length: 4 }, () => element('span', '', 'orbit-caption'));
  const bodyNames = bodyLabels.map(label => label.appendChild(element('b', '')));
  orbitLabels.replaceChildren(...bodyLabels);
  const ruler = element('div', '', 'binary-ruler');
  ruler.hidden = true;
  ruler.setAttribute('aria-hidden', 'true');
  const rulerLabel = ruler.appendChild(element('b', ''));
  orbitLabels.after(ruler);
  const stageReadout = element('div', '', 'stage-readout');
  stageReadout.id = 'observation-readout';
  surface.before(stageReadout);
  const binoculars = element('div', '', 'desert-binoculars');
  binoculars.setAttribute('aria-hidden', 'true');
  const waterReading = element('span', '', 'desert-water-reading');
  binoculars.hidden = true;
  waterReading.hidden = true;
  $('journey').prepend(binoculars, waterReading);

  for (const world of Object.values(destinations)) {
    const item = document.createElement('li');
    const sources = [world.source, world.science, world.reference?.source]
      .filter((source, index, all) => source && all.findIndex(other => other?.[1] === source[1]) === index);
    for (const [index, [title, href]] of sources.entries()) {
      if (index) item.append(' · ');
      const link = element('a', title + ' ↗');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
    }
    $('destination-sources').append(item);
  }

  function renderSurface(state) {
    const id = state.destination;
    const data = state.observation;
    if (id !== renderedSurface) {
      renderedSurface = id;
      binoculars.hidden = true;
      surface.innerHTML = controls[id];
      stageReadout.innerHTML = id === 'miller'
        ? '<div class="twin-clock"><span>현지 체류 <strong id="miller-local"></strong></span><span>지구 경과 <strong id="miller-earth"></strong></span></div><div id="wave-observation" hidden></div>'
        : id === 'erid' ? `<div id="erid-signal" class="erid-signal" hidden>
            <span>수신 <span class="signal-bars" aria-hidden="true">${signalBars(eridSignal)}</span> ${eridSignal.map(tone => eridNotes[tone]).join(' · ')}</span>
            <span id="erid-reply"></span>
          </div>` : id === 'tatooine'
          ? '<div id="tatooine-orbit-readout" hidden><strong id="tatooine-orbit-stat"></strong><span id="tatooine-orbit-reference"></span></div>'
          : '<span id="local-readout"></span>';
    }
    show('observation-readout', true);
    show('surface-record', data.complete);
    copy('instruction', observationStatus(id, data));
    switch (id) {
      case 'pandora': {
        const inForest = data.view === 'ground' && data.viewProgress === 0;
        show('forest-day', inForest);
        show('forest-night', inForest);
        const inOrbit = data.view === 'orbit';
        const orbitReady = inOrbit && data.viewProgress === 2;
        const comparing = Boolean(data.scaleComparison);
        const zoom = data.orbitZoom ?? 1;
        show('pandora-ground', inOrbit);
        show('compare-pandora-scale', orbitReady);
        show('pandora-zoom-label', orbitReady);
        $('pandora-zoom').value = zoom;
        copy('pandora-zoom-value', `${zoom}×`);
        $('pandora-zoom').setAttribute('aria-label', comparing ? '트리톤 근처 확대' : '판도라 근처 확대');
        copy('pandora-zoom-label-text', comparing ? '트리톤 근처 확대' : '판도라 근처 확대');
        copy('compare-pandora-scale', comparing ? '판도라–폴리페무스로 돌아가기' : '해왕성–트리톤과 비교');
        $('forest-day').setAttribute('aria-pressed', String(data.target === 0));
        $('forest-night').setAttribute('aria-pressed', String(data.target === 1));
        const km = value => value.toLocaleString('ko-KR') + 'km';
        const earthMoonRatio = Math.round(100 * pandoraScale.centerDistance / pandoraScale.earthMoonDistance);
        const note = comparing ? `해왕성 지름 ${km(pandoraScale.primaryDiameter)} · 트리톤 지름 ${km(pandoraScale.tritonDiameter)}`
          : `폴리페무스는 해왕성 크기, 판도라 지름은 약 ${km(pandoraScale.pandoraDiameter)}로 가정`;
        copy('local-readout', orbitReady ? `${note}\n${comparing ? '중심 간 거리' : '트리톤 궤도 거리 사용'} ${km(pandoraScale.centerDistance)} · 지구–달 거리의 약 ${earthMoonRatio}%\n눈금 간격 10만 km` : '');
        break;
      }
      case 'adrian':
        show('lower-probe', data.phase === 'ready' || data.phase === 'sampling');
        $('lower-probe').disabled = data.phase !== 'ready';
        show('open-sample', data.phase === 'sample');
        show('magnify-label', data.phase === 'magnify');
        $('magnification').value = data.magnification;
        copy('magnification-value', `${data.magnification}×`);
        copy('local-readout', data.phase === 'magnify' ? '작품을 바탕으로 재현한 샘플' : '');
        break;
      case 'erid': {
        const responding = data.phase === 'reply';
        const scanning = echoInProgress(data);
        const disabled = String(scanning);
        if ($('send-echo').getAttribute('aria-disabled') !== disabled) $('send-echo').setAttribute('aria-disabled', disabled);
        copy('send-echo', scanning ? '반향 관측 중' : data.phase === 'ready' ? '음파 보내기' : '음파 다시 보내기');
        show('erid-signal', responding || data.phase === 'contact');
        show('replay-erid', responding && state.sound);
        eridNotes.forEach((_, index) => show('send-tone-' + index, responding));
        copy('erid-reply', data.phase === 'contact' ? '응답 확인 · 교신 성공'
          : `응답 ${data.reply.length}/3${data.reply ? ' · ' + [...data.reply].map(tone => eridNotes[tone]).join(' · ') : ''}`);
        break;
      }
      case 'arrakis': {
        const step = desertStep(data);
        show('check-suit', !data.suitChecked && !data.path);
        for (const [key, route] of Object.entries(desertRoutes)) {
          const id = 'desert-' + key;
          show(id, data.suitChecked && !data.path);
          copy(key + '-name', route.name + (state.records.arrakis?.paths[key] ? ' · 관측 완료' : ''));
          copy(key + '-forecast', route.forecast);
        }
        show('desert-survey', step === 'lookout');
        show('desert-water', step === 'arrived');
        if (data.path) copy('desert-survey', desertRoutes[data.path].tool);
        binoculars.hidden = data.path !== 'sun' || step !== 'surveying';
        if (step === 'complete') {
          const { left } = waterReport(desertRoutes[data.path], 1, data.suitChecked);
          waterReading.textContent = `${left}mL`;
        }
        copy('local-readout', step === 'ready' && data.suitChecked ? `시험용 물 ${suitTestVolume}mL 회수 · 출발 물 100mL` : '');
        break;
      }
      case 'miller': {
        const { local, earth } = millerTimes(data.elapsed);
        copy('miller-local', local);
        copy('miller-earth', earth);
        show('wave-observation', data.elapsed >= millerCrestAt);
        copy('wave-observation', firstMillerWave);
        show('miller-depart', !data.complete);
        break;
      }
      case 'tatooine': {
        const onGround = data.view === 'ground' && data.viewProgress === 0;
        const orbitReady = data.view === 'orbit' && data.viewProgress === 1;
        show('tatooine-time', onGround);
        $('sky-time').value = data.sky;
        for (const id of ['tatooine-day', 'tatooine-dusk', 'tatooine-night']) show(id, onGround);
        show('tatooine-ground', orbitReady);
        show('tatooine-orbit-panel', onGround || orbitReady);
        show('observation-readout', onGround || orbitReady);
        show('tatooine-orbit-readout', onGround || orbitReady);
        copy('stage-description', orbitReady ? '케플러-16 기반 · 거리와 지름을 같은 축척으로 표시' : destinations.tatooine.observation);
        if (!onGround && !orbitReady) break;

        $('orbit-rate').value = data.orbitRate;
        renderOrbitTime(data);
        break;
      }
    }
  }

  function renderOrbitTime(data) {
    const day = Number(data.orbitDays.toFixed(3));
    const slider = $('orbit-time');
    if (slider.valueAsNumber !== day) slider.value = day;
    const elapsedLabel = `${data.orbitDays.toFixed(2)}일 / ${outerOrbit.period.toFixed(2)}일`;
    if (slider.getAttribute('aria-valuetext') !== elapsedLabel) slider.setAttribute('aria-valuetext', elapsedLabel);
    copy('orbit-time-value', elapsedLabel);
    const onGround = data.view === 'ground';
    const playLabel = onGround ? '공전 재생' : '궤도 재생';
    copy('orbit-play', data.orbitPlaying ? '일시정지' : data.orbitDays === outerOrbit.period ? '다시 재생' : playLabel);
    show('tatooine-orbit', onGround && data.visited === 3);
    if (onGround) {
      const sky = groundSkyAt(data.orbitDays, data.sky);
      copy('instruction', tatooineShadowStatus(sky));
      copy('tatooine-orbit-stat', `공전 날짜 · 두 해 사이 각도 ${sky.separation.toFixed(1)}°`);
      copy('tatooine-orbit-reference', `케플러-16 기준 · 두 태양 공전 주기 ${binaryOrbit.period.toFixed(2)}일`);
      const dusk = $('tatooine-dusk');
      dusk.disabled = sky.betweenSunsets === null;
      dusk.title = dusk.disabled ? '두 해가 거의 동시에 집니다.' : '';
      for (const [index, id] of ['tatooine-day', 'tatooine-dusk', 'tatooine-night'].entries()) {
        const button = $(id);
        const pressed = String(sky.visibleCount === 2 - index);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
      return;
    }
    const separation = orbitPosition(binaryOrbit, data.orbitDays, starSeparation).length();
    copy('tatooine-orbit-stat', `두 해 사이 ${separation.toFixed(3)} AU · 약 ${(Math.round(separation * auKm / 100_000) * 10).toLocaleString('ko-KR')}만 km`);
    copy('tatooine-orbit-reference', `두 태양 ${binaryOrbit.period.toFixed(2)}일 · 타투인 ${outerOrbit.period.toFixed(2)}일에 한 바퀴`);
  }

  surface.addEventListener('click', event => {
    const control = event.target.closest('button[data-action]');
    if (control && control.getAttribute('aria-disabled') !== 'true') callbacks.action(control.dataset.action);
  });
  surface.addEventListener('input', event => callbacks.action(event.target.id, Number(event.target.value)));
  surface.addEventListener('keydown', event => {
    if (event.target.id !== 'orbit-time') return;
    const offset = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    callbacks.action('orbit-time', MathUtils.clamp(event.target.valueAsNumber + offset, 0, outerOrbit.period));
  });
  $('surface-record').addEventListener('click', () => callbacks.action('record'));

  function positionSurface(signals) {
    $('stage-title').classList.toggle('in-scene', Boolean(signals?.title));
    const reading = signals?.anchors.find(([key]) => key === 'desert-water-reading')?.[1];
    waterReading.hidden = !reading;
    if (reading) {
      waterReading.style.left = Math.min(reading.x, innerWidth - waterReading.offsetWidth - 12) + 'px';
      waterReading.style.top = reading.y + 'px';
    }
    for (const unit of surface.querySelectorAll('[data-anchor]')) {
      const point = signals?.anchors.find(([key]) => key === unit.dataset.anchor)?.[1];
      if (unit.dataset.anchor === 'polyphemus') {
        const visible = Boolean(point && point.y > Math.max(104, innerHeight * .17) && point.y < innerHeight * .73);
        if (!visible && unit.contains(document.activeElement)) $('scene').querySelector('canvas')?.focus({ preventScroll: true });
        unit.hidden = !visible;
        if (visible) {
          unit.style.setProperty('--planet-x', point.x + 'px');
          unit.style.top = point.y + 'px';
        }
      } else positionCallout(unit, point);
    }
    const bodies = signals?.bodies ?? [];
    orbitLabels.hidden = !bodies.length;
    const center = bodies.find(body => body.marker === 'center')?.point;
    for (const [index, label] of bodyLabels.entries()) {
      const body = bodies[index];
      label.hidden = !body?.point;
      if (!body?.point) continue;
      if (bodyNames[index].textContent !== body.name) bodyNames[index].textContent = body.name;
      if (body.marker) {
        label.dataset.marker = body.marker;
        const left = body.marker === 'planet' ? body.point.x > innerWidth - 99 : body.point.x < center?.x;
        label.dataset.side = left ? 'left' : 'right';
        label.dataset.vertical = body.marker === 'primary' && Math.abs(body.point.x - center?.x) < 25 ? 'high' : 'normal';
      } else delete label.dataset.marker;
      label.style.left = body.point.x + 'px';
      label.style.top = body.point.y + 'px';
    }
    const panel = $('tatooine-orbit-panel');
    const rulerVisible = Boolean(signals?.orbitSpan && panel && !panel.hidden);
    ruler.hidden = !rulerVisible;
    if (rulerVisible) {
      // The orbit camera is orthographic, so a horizontal unit is constant throughout the frame.
      const pixelsPerKm = innerHeight / (signals.orbitSpan * auKm);
      const power = 10 ** Math.floor(Math.log10(106 / pixelsPerKm));
      const length = [1, 2, 5].map(step => step * power).find(value => value * pixelsPerKm >= 57) ?? 10 * power;
      const text = length >= 1e6 ? `${(length / 10_000).toLocaleString('ko-KR')}만 km` : km(length);
      ruler.style.setProperty('--ruler-width', (length * pixelsPerKm).toFixed(2) + 'px');
      if (rulerLabel.textContent !== text) rulerLabel.textContent = text;
    }
    const returns = signals?.echoes ?? [];
    echoLabels.hidden = !returns.length;
    echoes.forEach((label, index) => {
      const echo = returns.find(echo => echo.index === index);
      label.hidden = !echo?.point;
      if (!echo?.point) return;
      if (label.textContent !== echo.name) label.textContent = echo.name;
      label.style.left = echo.point.x + 'px';
      label.style.top = echo.point.y + 'px';
      label.style.opacity = echo.opacity;
    });
  }

  function renderRecord(state) {
    const id = state.recordView;
    const source = destinations[id];
    const saved = state.records[id];
    const count = state.order.length;
    const signature = JSON.stringify([id, saved, count, state.recordBack]);
    if (signature === recordSignature) return;
    recordSignature = signature;
    copy('log-count', `${count} / 7`);
    copy('log-title', source.name);
    copy('log-work', `《${source.work}》`);
    copy('log-result', source.result);
    const context = source.recordContext ?? [];
    show('log-context', context.length > 0);
    $('log-context').replaceChildren(...context.map(({ heading, text }) => {
      const section = element('section', '', 'log-entry log-comparison');
      section.append(element('h3', heading), element('p', text));
      return section;
    }));
    copy('log-question', source.question);
    copy('log-comparison', source.comparison);
    copy('log-distance', source.distance);
    copy('log-distance-analogy', distanceAnalogy(source.reference));
    show('log-distance-analogy', Boolean(source.reference));
    $('log-source').href = source.source[1];
    copy('log-source', source.source[0] + ' ↗');
    show('log-science', Boolean(source.science));
    if (source.science) {
      $('log-science').href = source.science[1];
      copy('log-science', source.science[0] + ' ↗');
    }
    const lines = saved?.lines ?? [];
    show('log-details', lines.length > 0);
    $('log-details').replaceChildren(...lines.map(line => element('li', line)));
    show('log-paths', Boolean(saved?.paths));
    if (saved?.paths) {
      const paths = Object.entries(saved.paths);
      const table = document.createElement('table');
      const head = table.createTHead().insertRow();
      for (const title of ['경로', '이동', '손실', '회수', '순소비', '잔량']) {
        const cell = element('th', title);
        cell.scope = 'col';
        head.append(cell);
      }
      const tbody = table.createTBody();
      for (const [key, { spent, left, recovered }] of paths) {
        const row = tbody.insertRow();
        const volumes = [recovered === undefined ? undefined : spent + recovered, recovered, spent, left];
        const cells = [desertRoutes[key].name, `${desertRoutes[key].duration / 1000}초`,
          ...volumes.map(volume => volume === undefined ? '—' : `${volume}mL`)];
        for (const item of cells) row.insertCell().textContent = item;
      }
      const note = element('p', '체험용 수치 · 순소비 = 손실 − 회수 · 잔량 = 출발량 − 순소비', 'path-note');
      $('log-paths').replaceChildren(desertRecordCards(paths), table, note);
      if (paths.length === 2) {
        const timeDifference = (desertRoutes.shade.duration - desertRoutes.sun.duration) / 1000;
        const waterDifference = saved.paths.shade.left - saved.paths.sun.left;
        const balance = waterDifference === 0 ? '두 경로의 물 잔량이 같았다'
          : `물이 ${Math.abs(waterDifference)}mL ${waterDifference > 0 ? '더' : '덜'} 남았다`;
        $('log-paths').append(element('p', `암벽 그늘길은 ${timeDifference}초 더 걸렸고 ${balance}.`));
      }
    }
    show('log-stellar', id === 'b612');
    show('log-back', Boolean(state.recordBack));
    show('log-ending', count === 7 && !state.recordBack);
    show('log-next', !state.recordBack);
    $('log-next').classList.toggle('primary', count < 7);
  }

  const mapMarkers = new Map();
  const departureMarkers = new Map();
  const earth = element('span', '지구', 'map-earth');
  $('map-markers').append(earth);
  for (const id of destinationIds) {
    const info = destinations[id];
    const button = element('button', '', 'map-marker');
    button.type = 'button';
    button.dataset.world = id;
    button.style.setProperty('--world-accent', '#' + info.color.toString(16).padStart(6, '0'));
    button.append(element('span', '', 'map-reticle'), element('span', info.name, 'map-label'),
      element('span', '', 'map-label-note'));
    button.addEventListener('click', event => callbacks.inspect(id, event.detail === 0));
    mapMarkers.set(id, button);
    $('map-markers').append(button);
  }
  for (const id of ['earth', ...destinationIds]) {
    const label = element('span', destinations[id]?.name ?? '지구', 'departure-marker');
    departureMarkers.set(id, label);
    $('departure-markers').append(label);
  }
  $('map-travel').addEventListener('click', () => callbacks.choose());
  $('map-record').addEventListener('click', () => callbacks.readSelected());

  function renderMap(state) {
    const recommendation = destinationIds.slice(1).find(id => !state.records[id]);
    const current = destinations[state.current];
    copy('map-position', `현재 위치 · ${current.name} · 탐사 기록 ${state.order.length}/7`);
    for (const [id, marker] of mapMarkers) {
      const status = id === state.current ? '현재 위치' : id === recommendation ? '세미나 추천 항로' : state.records[id] ? '탐사 완료' : '';
      marker.setAttribute('aria-pressed', String(id === state.mapSelection));
      marker.setAttribute('aria-label', [destinations[id].name, status].filter(Boolean).join(' · '));
      marker.dataset.current = String(id === state.current);
      marker.dataset.recommended = String(id === recommendation);
      marker.lastElementChild.textContent = id === state.current ? '현재 위치' : id === recommendation ? '추천' : '';
    }
    const id = state.mapSelection;
    const selected = destinations[id];
    show('map-inspection', Boolean(selected));
    if (!selected) return;
    copy('map-world-name', selected.name);
    copy('map-world-state', id === state.current ? '현재 위치' : id === recommendation ? '세미나 추천 항로' : state.records[id] ? '탐사 완료' : '미탐사');
    copy('map-world-work', `《${selected.work}》`);
    copy('map-world-distance', selected.distance);
    copy('map-distance-analogy', distanceAnalogy(selected.reference));
    show('map-distance-analogy', Boolean(selected.reference));
    show('map-record', Boolean(state.records[id]));
    show('map-travel', id !== state.current);
    show('map-flight-length', id !== state.current);
    if (id !== state.current) {
      const profile = routeFlight(state.current, id);
      copy('map-travel', `${selected.name}${id === 'adrian' || id === 'tatooine' ? '으로' : '로'} 출항 ↗`);
      copy('map-flight-length', `${profile.length} · 항해 연출 ${profile.duration / 1000}초`);
    }
  }

  function positionRouteMarkers(points, map, progress, from, to) {
    const reveal = smoothstep(progress, .26, .39);
    const chartFade = 1 - smoothstep(progress, .77, .99);
    const destinationFade = 1 - smoothstep(progress, .76, .89);
    for (const { id, x, y, radius, visible } of points) {
      const marker = map ? id === 'earth' ? earth : mapMarkers.get(id) : departureMarkers.get(id);
      marker.style.left = x + '%';
      marker.style.top = y + '%';
      if (map) {
        marker.hidden = !visible;
        marker.style.setProperty('--planet-radius', Math.max(8, radius) + 'px');
        continue;
      }

      const distanceFade = smoothstep(radius, 1.2, 4.5);
      const edgeFade = smoothstep(Math.min(x, 100 - x), 2.5, 8) *
        smoothstep(Math.min(y, 100 - y), 9, 17);
      const opacity = reveal * (id === to ? destinationFade : chartFade) * distanceFade * edgeFade;
      marker.hidden = !visible || opacity <= 0;
      marker.style.opacity = String(opacity);
      marker.style.setProperty('--planet-radius', radius + 'px');
      marker.style.setProperty('--label-scale', String(.55 + .45 * smoothstep(radius, 1.2, 11)));
      marker.dataset.active = String(id === from || id === to);
    }
    if (!map || !to) return;
    const target = points.find(point => point.id === to && point.visible);
    positionCallout($('map-inspection'), target && {
      x: target.x * window.innerWidth / 100, y: target.y * window.innerHeight / 100
    }, { vertical: true, radius: target?.radius });
  }

  function renderArchive(state) {
    copy('directory-count', `탐사 기록 ${state.order.length}/7`);
    copy('directory-position', `현재 위치 · ${destinations[state.current].name}`);
    const entries = state.order.map(id => {
      const info = destinations[id];
      const entry = element('article', '', 'directory-entry');
      entry.style.setProperty('--world-accent', '#' + info.color.toString(16).padStart(6, '0'));
      const title = element('div', '', 'directory-world');
      title.append(element('h3', info.name), element('p', `《${info.work}》`, 'small'));
      const read = element('button', '기록 보기 ↗', 'button');
      read.type = 'button';
      read.setAttribute('aria-label', `${info.name} 기록 보기`);
      read.addEventListener('click', () => callbacks.read(id, 'archive'));
      const distance = element('p', info.distance, 'small');
      if (info.reference) distance.append(element('span', distanceAnalogy(info.reference), 'distance-analogy'));
      entry.append(title, distance, read);
      return entry;
    });
    $('directory-entries').replaceChildren(...entries);
  }

  function renderCommunication(elapsed) {
    $('communication-progress').value = elapsed;
    $('signal-stages').querySelectorAll('li').forEach((item, i) => {
      const reached = elapsed >= i * 4000;
      item.hidden = !reached;
      if (reached && (i === 2 || elapsed < (i + 1) * 4000)) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
  }

  return { renderSurface, renderOrbitTime, positionSurface, renderRecord, renderMap, renderArchive, positionRouteMarkers, renderCommunication };
}
