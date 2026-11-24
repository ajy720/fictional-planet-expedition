import { formatFixed, formatNumber, joinLabels, localizeDom, t } from './copy/index.js';
import { MathUtils, Vector3 } from 'three';
import { desertRoutes, destinationIds, destinations, distanceAnalogy, millerTimes, pandoraScale, routeFlight } from './destinations.js';
import { echoInProgress } from './erid-sonar.js';
import { desertStep, eridTone, eridSignal, firstMillerWave, millerCrestAt, observationStatus, recordEntryText, suitTestVolume, tatooineShadowStatus, waterReport } from './observations.js';
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
const action = (id, labelKey, key, primary = false, content = '') =>
  `<button type="button" id="${id}" class="button${primary ? ' primary' : ''}" data-action="${key}"${labelKey ? ` data-copy="${labelKey}"` : ''}>${content}</button>`;
const tatooineOrbitControls = `<div class="binary-controls" id="tatooine-orbit-panel" hidden>
  <div class="binary-time">
    ${action('orbit-play', 'tatooine.playOrbit', 'orbit-play')}
    <label class="range-label">
      <span class="sr-only" data-copy="tatooine.orbitDaysLabel"></span>
      <input type="range" id="orbit-time" min="0" max="${outerOrbit.period}" step=".001" value="0">
    </label>
    <span class="binary-day" id="orbit-time-value"></span>
  </div>
  <div class="binary-time-options">
    ${action('orbit-first-cycle', 'tatooine.firstCycle', 'orbit-first-cycle')}
    ${action('orbit-reset', 'tatooine.reset', 'orbit-reset')}
    <select id="orbit-rate" data-copy-aria-label="tatooine.orbitRateLabel">
      ${orbitRates.map(rate => `<option value="${rate}"></option>`).join('')}
    </select>
    ${action('tatooine-ground', 'tatooine.backToGround', 'tatooine-ground')}
    ${action('tatooine-orbit', 'tatooine.openOrbit', 'tatooine-orbit', true)}
  </div>
</div>`;
const km = value => t('distance.kilometers', { km: formatNumber(Math.round(value)) });
const starSeparation = new Vector3();
const controls = {
  pandora: unit('forest-light', action('forest-day', 'pandora.day', 'day') + action('forest-night', 'pandora.night', 'night'))
    + unit('polyphemus', action('find-polyphemus', 'pandora.findPolyphemus', 'polyphemus', true))
    + unit('orbit-return', '<label id="pandora-zoom-label" class="range-label"><span id="pandora-zoom-label-text"></span> <input type="range" id="pandora-zoom" min="1" max="8" step=".5" value="1"><output id="pandora-zoom-value" for="pandora-zoom"></output></label>'
      + action('compare-pandora-scale', 'pandora.compareScale', 'compare-scale')
      + action('pandora-ground', 'pandora.backToForest', 'pandora-ground')),
  adrian: unit('sampling', action('lower-probe', 'adrian.lowerProbe', 'lower', true) + action('open-sample', 'adrian.openSample', 'sample', true)
    + '<label id="magnify-label" class="range-label" hidden><span data-copy="adrian.zoomLabel"></span> <input id="magnification" type="range" min="1" max="4" step=".5" value="1"><output id="magnification-value" for="magnification"></output></label>'),
  erid: unit('emitter', action('send-echo', 'erid.sendEcho', 'echo', true))
    + unit('reply', action('replay-erid', 'erid.replaySignal', 'replay-erid')
      + eridSignal.map((_, index) => action('send-tone-' + index, '', 'tone-' + index)).join('')),
  arrakis: unit('suit', action('check-suit', 'arrakis.checkSuit', 'suit', true))
    + unit('sun-path', action('desert-sun', '', 'sun', false, '<strong id="sun-name"></strong><span id="sun-forecast"></span>'))
    + unit('shade-path', action('desert-shade', '', 'shade', false, '<strong id="shade-name"></strong><span id="shade-forecast"></span>'))
    + unit('desert-lookout', action('desert-survey', '', 'desert-survey', true))
    + action('desert-water', 'arrakis.takeBottle', 'desert-water', true),
  miller: unit('departure', action('miller-depart', 'miller.depart', 'depart', true)),
  tatooine: unit('sunset', '<label id="tatooine-time" class="range-label"><span data-copy="tatooine.sunsetTime"></span> <input id="sky-time" type="range" min="0" max="100" step="any" value="0"></label>'
    + action('tatooine-day', 'tatooine.twoSuns', 'tatooine-day') + action('tatooine-dusk', 'tatooine.firstSunset', 'tatooine-dusk')
    + action('tatooine-night', 'tatooine.bothSunsets', 'tatooine-night'))
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
    water.append(waterBottle(left), element('strong', t('common.milliliters', { amount: left })));
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

  function renderReferences() {
    const sourcesList = document.createDocumentFragment();
    const distanceList = document.createDocumentFragment();
    for (const world of Object.values(destinations)) {
      const item = document.createElement('li');
      const sources = [world.source, world.science, world.reference?.source]
        .filter((source, index, all) => source && all.findIndex(other => other?.[1] === source[1]) === index);
      for (const [index, [title, href]] of sources.entries()) {
        if (index) item.append(t('common.listSeparator'));
        const link = element('a', t('common.externalLink', { label: title }));
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        item.append(link);
      }
      sourcesList.append(item);
    }

    for (const world of Object.values(destinations)) {
      if (!world.reference) continue;
      const { name, lightYears } = world.reference;
      const entry = element('li', '');
      const heading = element('div', '', 'distance-heading');
      heading.append(element('strong', world.name), element('span', name, 'small'),
        element('b', t('distance.lightYearsApproximate', { lightYears })));
      const track = element('span', '', 'distance-track');
      track.style.setProperty('--distance', Math.log10(lightYears) / 3 * 100 + '%');
      track.setAttribute('aria-hidden', 'true');
      entry.append(heading, track, element('span', distanceAnalogy(world.reference, { compact: true }), 'small'));
      distanceList.append(entry);
    }
    const unscaled = Object.values(destinations).filter(world => !world.reference).map(world => world.name);
    copy('unscaled-worlds', t('distance.unscaled', { worlds: joinLabels(unscaled) }));
    $('destination-sources').replaceChildren(sourcesList);
    $('distance-comparison').replaceChildren(distanceList);
  }

  function localizeOrbitRates() {
    for (const option of $('orbit-rate').options) {
      option.textContent = t('tatooine.daysPerSecond', { rate: option.value });
    }
  }

  function renderSurface(state) {
    const id = state.destination;
    const data = state.observation;
    if (id !== renderedSurface) {
      renderedSurface = id;
      binoculars.hidden = true;
      surface.innerHTML = controls[id];
      stageReadout.innerHTML = id === 'miller'
        ? '<div class="twin-clock"><span><span data-copy="miller.localClock"></span> <strong id="miller-local"></strong></span><span><span data-copy="miller.earthClock"></span> <strong id="miller-earth"></strong></span></div><div id="wave-observation" hidden></div>'
        : id === 'erid' ? `<div id="erid-signal" class="erid-signal" hidden>
            <span><span data-copy="erid.received"></span> <span class="signal-bars" aria-hidden="true">${signalBars(eridSignal)}</span> <span id="erid-tones"></span></span>
            <span id="erid-reply"></span>
          </div>` : id === 'tatooine'
          ? '<div id="tatooine-orbit-readout" hidden><strong id="tatooine-orbit-stat"></strong><span id="tatooine-orbit-reference"></span></div>'
          : '<span id="local-readout"></span>';
      localizeDom(surface);
      localizeDom(stageReadout);
      if (id === 'tatooine') localizeOrbitRates();
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
        copy('pandora-zoom-value', t('common.magnification', { zoom }));
        $('pandora-zoom').setAttribute('aria-label', comparing ? t('pandora.zoomTriton') : t('pandora.zoomPandora'));
        copy('pandora-zoom-label-text', comparing ? t('pandora.zoomTriton') : t('pandora.zoomPandora'));
        copy('compare-pandora-scale', comparing ? t('pandora.backToFiction') : t('pandora.compareScale'));
        $('forest-day').setAttribute('aria-pressed', String(data.target === 0));
        $('forest-night').setAttribute('aria-pressed', String(data.target === 1));
        const km = value => t('distance.compactKilometers', { km: formatNumber(value) });
        const earthMoonRatio = Math.round(100 * pandoraScale.centerDistance / pandoraScale.earthMoonDistance);
        copy('local-readout', orbitReady ? t(comparing ? 'pandora.realScaleReadout' : 'pandora.fictionalScaleReadout', {
          neptune: km(pandoraScale.primaryDiameter), triton: km(pandoraScale.tritonDiameter),
          pandora: km(pandoraScale.pandoraDiameter), distance: km(pandoraScale.centerDistance), ratio: earthMoonRatio
        }) : '');
        break;
      }
      case 'adrian':
        show('lower-probe', data.phase === 'ready' || data.phase === 'sampling');
        $('lower-probe').disabled = data.phase !== 'ready';
        show('open-sample', data.phase === 'sample');
        show('magnify-label', data.phase === 'magnify');
        $('magnification').value = data.magnification;
        copy('magnification-value', t('common.magnification', { zoom: data.magnification }));
        break;
      case 'erid': {
        const responding = data.phase === 'reply';
        const scanning = echoInProgress(data);
        const disabled = String(scanning);
        if ($('send-echo').getAttribute('aria-disabled') !== disabled) $('send-echo').setAttribute('aria-disabled', disabled);
        copy('send-echo', scanning ? t('erid.scanning') : data.phase === 'ready' ? t('erid.sendEcho') : t('erid.resendEcho'));
        show('erid-signal', responding || data.phase === 'contact');
        show('replay-erid', responding && state.sound);
        copy('erid-tones', joinLabels(eridSignal.map(eridTone)));
        eridSignal.forEach((_, index) => {
          const id = 'send-tone-' + index;
          show(id, responding);
          copy(id, t('erid.sendTone', { tone: eridTone(index) }));
        });
        show('erid-reply', responding);
        if (responding) {
          const reply = { count: data.reply.length, tones: joinLabels([...data.reply].map(eridTone)) };
          copy('erid-reply', t(data.reply ? 'erid.replyWithTones' : 'erid.emptyReply', reply));
        }
        break;
      }
      case 'arrakis': {
        const step = desertStep(data);
        show('check-suit', !data.suitChecked && !data.path);
        for (const [key, route] of Object.entries(desertRoutes)) {
          const id = 'desert-' + key;
          show(id, data.suitChecked && !data.path);
          copy(key + '-name', state.records.arrakis?.paths[key] ? t('arrakis.pathObserved', { route: route.name }) : route.name);
          copy(key + '-forecast', route.forecast);
        }
        show('desert-survey', step === 'lookout');
        show('desert-water', step === 'arrived');
        if (data.path) copy('desert-survey', desertRoutes[data.path].tool);
        binoculars.hidden = data.path !== 'sun' || step !== 'surveying';
        if (step === 'complete') {
          const { left } = waterReport(desertRoutes[data.path], 1, data.suitChecked);
          waterReading.textContent = t('common.milliliters', { amount: left });
        }
        copy('local-readout', step === 'ready' && data.suitChecked ? t('arrakis.suitReadout', { volume: t('common.milliliters', { amount: suitTestVolume }), initial: t('common.milliliters', { amount: 100 }) }) : '');
        break;
      }
      case 'miller': {
        const { local, earth } = millerTimes(data.elapsed);
        copy('miller-local', local);
        copy('miller-earth', earth);
        show('wave-observation', data.elapsed >= millerCrestAt);
        copy('wave-observation', firstMillerWave());
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
        copy('stage-description', orbitReady ? t('tatooine.orbitDescription') : destinations.tatooine.observation);
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
    const elapsedLabel = t('tatooine.orbitTime', { elapsed: formatFixed(data.orbitDays, 2), period: formatFixed(outerOrbit.period, 2) });
    if (slider.getAttribute('aria-valuetext') !== elapsedLabel) slider.setAttribute('aria-valuetext', elapsedLabel);
    copy('orbit-time-value', elapsedLabel);
    const onGround = data.view === 'ground';
    const playLabel = onGround ? t('tatooine.playRevolution') : t('tatooine.playOrbit');
    copy('orbit-play', data.orbitPlaying ? t('common.pause') : data.orbitDays === outerOrbit.period ? t('tatooine.replay') : playLabel);
    show('tatooine-orbit', onGround && data.visited === 3);
    if (onGround) {
      const sky = groundSkyAt(data.orbitDays, data.sky);
      copy('instruction', tatooineShadowStatus(sky));
      copy('tatooine-orbit-stat', t('tatooine.groundSeparation', { angle: formatFixed(sky.separation, 1) }));
      copy('tatooine-orbit-reference', t('tatooine.binaryPeriod', { period: formatFixed(binaryOrbit.period, 2) }));
      const dusk = $('tatooine-dusk');
      dusk.disabled = sky.betweenSunsets === null;
      dusk.title = dusk.disabled ? t('tatooine.nearSimultaneousSunset') : '';
      for (const [index, id] of ['tatooine-day', 'tatooine-dusk', 'tatooine-night'].entries()) {
        const button = $(id);
        const pressed = String(sky.visibleCount === 2 - index);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
      }
      return;
    }
    const separation = orbitPosition(binaryOrbit, data.orbitDays, starSeparation).length();
    copy('tatooine-orbit-stat', t('tatooine.orbitSeparation', { au: formatFixed(separation, 3), distance: t('tatooine.tenThousandKm', { km: formatNumber(Math.round(separation * auKm / 100_000) * 10) }) }));
    copy('tatooine-orbit-reference', t('tatooine.periods', { binary: formatFixed(binaryOrbit.period, 2), planet: formatFixed(outerOrbit.period, 2) }));
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
      const name = t(body.labelKey);
      if (bodyNames[index].textContent !== name) bodyNames[index].textContent = name;
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
      const text = length >= 1e6 ? t('tatooine.tenThousandKm', { km: formatNumber(length / 10_000) }) : km(length);
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
    copy('log-count', t('record.count', { count }));
    copy('log-title', source.name);
    copy('log-work', t('common.workTitle', { work: source.work }));
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
    copy('log-source', t('common.externalLink', { label: source.source[0] }));
    show('log-science', Boolean(source.science));
    if (source.science) {
      $('log-science').href = source.science[1];
      copy('log-science', t('common.externalLink', { label: source.science[0] }));
    }
    const lines = (saved?.entries ?? []).map(entry => recordEntryText(entry)).filter(Boolean);
    show('log-details', lines.length > 0);
    $('log-details').replaceChildren(...lines.map(line => element('li', line)));
    show('log-paths', Boolean(saved?.paths));
    if (saved?.paths) {
      const paths = Object.entries(saved.paths);
      const table = document.createElement('table');
      const head = table.createTHead().insertRow();
      for (const title of [t('arrakis.recordPath'), t('arrakis.recordDuration'), t('arrakis.recordLoss'), t('arrakis.recordRecovery'), t('arrakis.recordSpent'), t('arrakis.recordRemaining')]) {
        const cell = element('th', title);
        cell.scope = 'col';
        head.append(cell);
      }
      const tbody = table.createTBody();
      for (const [key, { spent, left, recovered }] of paths) {
        const row = tbody.insertRow();
        const volumes = [recovered === undefined ? undefined : spent + recovered, recovered, spent, left];
        const cells = [desertRoutes[key].name, t('common.seconds', { seconds: desertRoutes[key].duration / 1000 }),
          ...volumes.map(volume => volume === undefined ? '—' : t('common.milliliters', { amount: volume }))];
        for (const item of cells) row.insertCell().textContent = item;
      }
      const note = element('p', t('arrakis.recordFormula'), 'path-note');
      $('log-paths').replaceChildren(desertRecordCards(paths), table, note);
      if (paths.length === 2) {
        const timeDifference = (desertRoutes.shade.duration - desertRoutes.sun.duration) / 1000;
        const waterDifference = saved.paths.shade.left - saved.paths.sun.left;
        const balance = waterDifference === 0 ? t('arrakis.sameWaterRemaining')
          : t(waterDifference > 0 ? 'arrakis.moreWaterRemaining' : 'arrakis.lessWaterRemaining', {
              volume: t('common.milliliters', { amount: Math.abs(waterDifference) })
            });
        $('log-paths').append(element('p', t('arrakis.recordComparison', { seconds: timeDifference, balance })));
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
  const earth = element('span', t('common.earth'), 'map-earth');
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
    const label = element('span', destinations[id]?.name ?? t('common.earth'), 'departure-marker');
    departureMarkers.set(id, label);
    $('departure-markers').append(label);
  }
  $('map-travel').addEventListener('click', () => callbacks.choose());
  $('map-record').addEventListener('click', () => callbacks.readSelected());

  function localize() {
    recordSignature = undefined;
    renderReferences();
    earth.textContent = t('common.earth');
    for (const [id, marker] of mapMarkers) marker.querySelector('.map-label').textContent = destinations[id].name;
    for (const [id, marker] of departureMarkers) marker.textContent = destinations[id]?.name ?? t('common.earth');
    if (renderedSurface === 'tatooine') localizeOrbitRates();
  }

  function renderMap(state) {
    const recommendation = destinationIds.slice(1).find(id => !state.records[id]);
    const current = destinations[state.current];
    copy('map-position', t('map.position', { world: current.name, count: state.order.length }));
    for (const [id, marker] of mapMarkers) {
      const status = id === state.current ? t('map.current') : id === recommendation ? t('map.recommendedRoute') : state.records[id] ? t('map.visited') : '';
      marker.setAttribute('aria-pressed', String(id === state.mapSelection));
      marker.setAttribute('aria-label', joinLabels([destinations[id].name, status].filter(Boolean)));
      marker.dataset.current = String(id === state.current);
      marker.dataset.recommended = String(id === recommendation);
      marker.lastElementChild.textContent = id === state.current ? t('map.current') : id === recommendation ? t('map.recommended') : '';
    }
    const id = state.mapSelection;
    const selected = destinations[id];
    show('map-inspection', Boolean(selected));
    if (!selected) return;
    copy('map-world-name', selected.name);
    copy('map-world-state', id === state.current ? t('map.current') : id === recommendation ? t('map.recommendedRoute') : state.records[id] ? t('map.visited') : t('map.unvisited'));
    copy('map-world-work', t('common.workTitle', { work: selected.work }));
    copy('map-world-distance', selected.distance);
    copy('map-distance-analogy', distanceAnalogy(selected.reference));
    show('map-distance-analogy', Boolean(selected.reference));
    show('map-record', Boolean(state.records[id]));
    show('map-travel', id !== state.current);
    show('map-flight-length', id !== state.current);
    if (id !== state.current) {
      const profile = routeFlight(state.current, id);
      copy('map-travel', t(id === 'adrian' || id === 'tatooine' ? 'map.travelAfterConsonant' : 'map.travelAfterVowel', { world: selected.name }));
      copy('map-flight-length', t('map.flightLength', { second: profile.duration / 1000 }));
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
    copy('directory-count', t('archive.count', { count: state.order.length }));
    copy('directory-position', t('archive.position', { world: destinations[state.current].name }));
    const entries = state.order.map(id => {
      const info = destinations[id];
      const entry = element('article', '', 'directory-entry');
      entry.style.setProperty('--world-accent', '#' + info.color.toString(16).padStart(6, '0'));
      const title = element('div', '', 'directory-world');
      title.append(element('h3', info.name), element('p', t('common.workTitle', { work: info.work }), 'small'));
      const read = element('button', t('archive.readEntry'), 'button');
      read.type = 'button';
      read.setAttribute('aria-label', t('archive.readLabel', { world: info.name }));
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

  return { localize, renderSurface, renderOrbitTime, positionSurface, renderRecord, renderMap, renderArchive, positionRouteMarkers, renderCommunication };
}
