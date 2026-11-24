import * as THREE from 'three';
import { glow, randomSequence } from './models.js';
import { destinationIds, destinations, petrovaCheckpoint, routeLayout, routeFlight } from './destinations.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (color, options) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...options });

function globe(color, index) {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const colors = [];
  const position = geometry.attributes.position;
  const tint = new THREE.Color(color);
  const sample = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const wave = Math.sin(y * (index === 7 ? 40 : 15) + Math.cos(z * 5) * 2 + x * 2);
    const cloud = Math.sin(x * 11 + z * 10) * Math.sin(y * 11 + x * 7);
    sample.copy(tint).multiplyScalar(.9 + wave * .12 + cloud * .16);
    colors.push(sample.r, sample.g, sample.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, flat(0xffffff, { vertexColors: true }));
}

const ids = ['earth', ...destinationIds];
const chartRadius = { earth: 1.08, b612: .67, pandora: .85, adrian: 1.25, erid: 1.01, arrakis: 1.3, miller: .91, tatooine: 1.03 };
const flightRadius = { ...chartRadius, b612: .27 };
const closeRange = id => flightRadius[id] * (3.7 + .25 / chartRadius[id]);
const overviewTarget = vec(-1.2, .7, -1.5);
const viewUp = vec(0, 1, 0);

export const departureStops = [0, .33, .67, 1];
export const departureStage = progress => progress >= .67 ? 2 : progress >= .33 ? 1 : 0;

function guide(points, color, opacity, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const options = { color, opacity, transparent: true, depthWrite: false };
  const material = dashed ? new THREE.LineDashedMaterial({ ...options, dashSize: .19, gapSize: .23 })
    : new THREE.LineBasicMaterial(options);
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

function routeCurve(from, to) {
  const distance = from.distanceTo(to);
  const middle = from.clone().lerp(to, .5);
  middle.z += 1.5 + distance * .09;
  middle.y += Math.min(4, distance * .12);
  return new THREE.QuadraticBezierCurve3(from, middle, to);
}

export function createRouteScene(renderer, asteroidTemplate, earthTemplate) {
  const camera = new THREE.PerspectiveCamera(44, 1, .02, 7200);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040812);
  const sunlight = new THREE.DirectionalLight(0xffe6c9, 3.4);
  sunlight.position.set(-24, 22, 19);
  scene.add(sunlight, new THREE.HemisphereLight(0xb9d6ff, 0x2a2238, .76));

  const worlds = Object.fromEntries(ids.map(id => [id, vec(...routeLayout[id])]));
  const planets = {};
  function putPlanet(id, mesh) {
    mesh.position.copy(worlds[id]);
    mesh.scale.setScalar(chartRadius[id]);
    mesh.rotation.y = id === 'earth' ? -1.5 : .45;
    planets[id] = mesh;
    scene.add(mesh);
  }
  destinationIds.forEach((id, index) => putPlanet(id, id === 'b612' ? asteroidTemplate.terrain.clone() : globe(destinations[id].color, index)));
  putPlanet('earth', earthTemplate.clone());

  const mother = globe(0xad886f, 7);
  const motherChartOffset = vec(-3, 1.25, -3.4);
  const motherFlightOffset = vec(-5.5, 4.1, -15);
  scene.add(mother);
  const twins = [glow(0xffe3a2), glow(0xff9e69)];
  const twinOffsets = [vec(-3.3, 1.55, -5.2), vec(-1.6, 2.04, -5.2)];
  twins.forEach((star, index) => {
    star.scale.setScalar(2.35 - index * .32);
    scene.add(star);
  });

  const staticPath = guide(new THREE.CatmullRomCurve3(ids.map(id => worlds[id])).getPoints(100), 0x6986a2, .43, true);
  const course = guide(Array.from({ length: 41 }, () => vec(0, 0, 0)), 0x9bdafa, .58);
  course.frustumCulled = false;
  staticPath.frustumCulled = false;
  const paths = new THREE.Group();
  paths.add(staticPath, course);
  scene.add(paths);
  let shownCourse;
  function updateCourse(from, to) {
    course.visible = Boolean(from && to && from !== to);
    if (!course.visible || shownCourse === from + to) return;
    shownCourse = from + to;
    const curve = routeCurve(worlds[from], worlds[to]);
    const points = course.geometry.attributes.position;
    curve.getPoints(points.count - 1).forEach(({ x, y, z }, i) => points.setXYZ(i, x, y, z));
    points.needsUpdate = true;
  }

  const random = randomSequence(8441);
  const positions = [], colors = [];
  for (let i = 0; i < 3550; i++) {
    const y = 2 * random() - 1;
    const angle = 2 * Math.PI * random();
    const radius = 420;
    const r = radius * Math.sqrt(1 - y * y);
    positions.push(r * Math.cos(angle), y * radius, r * Math.sin(angle));
    const intensity = .16 + .67 * random() ** 5;
    colors.push(intensity * .78, intensity * .89, intensity);
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  stars.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const starfield = new THREE.Points(stars, new THREE.PointsMaterial({
    vertexColors: true, size: 1.45, sizeAttenuation: false, toneMapped: false, fog: false
  }));
  scene.add(starfield);

  const dust = Array.from({ length: 125 }, () => ({
    x: (random() - .5) * 57, y: (random() - .5) * 33, z: random() * 82, length: .16 + random() * 1.45
  }));
  const dustPositions = new Float32Array(dust.length * 6);
  const dustGeometry = new THREE.BufferGeometry();
  const streakPositions = new THREE.BufferAttribute(dustPositions, 3);
  dustGeometry.setAttribute('position', streakPositions);
  const streaks = new THREE.LineSegments(dustGeometry, new THREE.LineBasicMaterial({ color: 0xa6bed9, transparent: true, depthWrite: false }));
  streaks.frustumCulled = false;
  scene.add(streaks);

  const lens = new THREE.Group();
  const rings = [];
  for (let i = 0; i < 10; i++) {
    const radius = 1.25 + i * .49;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .024, radius, 72),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xab95c2 : 0xd0c0a1, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    ring.position.z = -i * .45;
    lens.add(ring);
    rings.push(ring);
  }
  scene.add(lens);

  const beaconGeometry = new THREE.BufferGeometry().setFromPoints([vec(0, 0, 0)]);
  const beacon = new THREE.Points(beaconGeometry, new THREE.PointsMaterial({
    color: 0xc7e2ff, size: 2.6, sizeAttenuation: false, transparent: true, depthWrite: false, toneMapped: false
  }));
  scene.add(beacon);
  // False-color optics are drawn in the view frustum so the far-away signal stays legible.
  const spectralStar = glow(0xffd29e);
  const spectralTarget = glow(0xffb780);
  const spectrum = new THREE.Group();
  const trail = new THREE.BufferGeometry();
  const spectralCount = 390;
  const samples = new Float32Array(spectralCount * 3), tints = new Float32Array(spectralCount * 3);
  const spectralRandom = randomSequence(773);
  const trace = Array.from({ length: spectralCount }, (_, index) => {
    const t = index / (spectralCount - 1);
    tints.set([1, .16 + spectralRandom() * .69, .22 + spectralRandom() * .34], index * 3);
    return { t, scatter: spectralRandom() + spectralRandom() - 1 };
  });
  trail.setAttribute('position', new THREE.BufferAttribute(samples, 3));
  trail.setAttribute('color', new THREE.BufferAttribute(tints, 3));
  const plume = new THREE.Points(trail, new THREE.PointsMaterial({
    size: 3.4, sizeAttenuation: false, vertexColors: true, opacity: .63, transparent: true,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false
  }));
  plume.frustumCulled = false;
  plume.renderOrder = 5;
  const tracePositions = new Float32Array(65 * 3);
  const traceGeometry = new THREE.BufferGeometry();
  traceGeometry.setAttribute('position', new THREE.BufferAttribute(tracePositions, 3));
  const spine = new THREE.Line(traceGeometry, new THREE.LineBasicMaterial({
    color: 0xff8d7c, transparent: true, opacity: .49, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, toneMapped: false
  }));
  spine.frustumCulled = false;
  spine.renderOrder = 5;
  spectrum.add(spectralStar, spectralTarget, spine, plume);
  scene.add(spectrum);
  let signalPoint = null;
  const rayPoint = vec(0, 0, 0);
  function renderOptics(view, projectedTarget) {
    spectrum.visible = view.screen === 'route-flight' && view.destination === 'adrian'
      && view.observation.optics !== 'tracked' && view.elapsed >= petrovaCheckpoint(view.from);
    signalPoint = null;
    scene.background.set(spectrum.visible && view.observation.optics === 'infrared' ? 0x19091d : 0x040812);
    if (!spectrum.visible) return;
    const infrared = view.observation.optics === 'infrared';
    spectralStar.scale.setScalar(.058);
    spectralTarget.scale.setScalar(.037);
    spectralTarget.visible = spine.visible = plume.visible = infrared;
    spectralStar.position.copy(rayPoint.set(-.62, .33, .7).unproject(camera));
    if (!infrared) return;
    const targetX = 2 * clamp(projectedTarget.x, 37, 73) / 100 - 1;
    const targetY = 1 - 2 * clamp(projectedTarget.y, 39, 56) / 100;
    const pointOnTrace = (t, scatter) => rayPoint.set(
      lerp(-.62, targetX, t),
      lerp(.33, targetY, t) + Math.sin(Math.PI * t) * (.17 + scatter * .12),
      .7
    ).unproject(camera);
    spectralTarget.position.copy(pointOnTrace(1, 0));
    trace.forEach(({ t, scatter }, index) => pointOnTrace(t, scatter).toArray(samples, index * 3));
    for (let i = 0; i < 65; i++) pointOnTrace(i / 64, 0).toArray(tracePositions, i * 3);
    trail.attributes.position.needsUpdate = traceGeometry.attributes.position.needsUpdate = true;
    signalPoint = {
      x: (targetX + 1) * renderer.domElement.clientWidth / 2,
      y: (1 - targetY) * renderer.domElement.clientHeight / 2
    };
  }

  const layoutOffset = new THREE.Vector3();
  const mapAim = new THREE.Vector3();
  const mapFocus = new THREE.Vector3();
  let track;

  function positionWorlds(eye, scale, map) {
    layoutOffset.copy(eye).multiplyScalar(1 - scale);
    paths.scale.setScalar(scale);
    paths.position.copy(layoutOffset);
    for (const id of ids) {
      planets[id].position.copy(worlds[id]).multiplyScalar(scale).add(layoutOffset);
      planets[id].scale.setScalar(map ? chartRadius[id] * .67 : flightRadius[id]);
    }
    mother.position.copy(planets.pandora.position).add(map ? motherChartOffset : motherFlightOffset);
    mother.scale.setScalar(map ? 1.62 : 2.18);
    twins.forEach((star, i) => star.position.copy(planets.tatooine.position).add(twinOffsets[i]));
  }

  function overviewEye(aspect, map) {
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const wideChart = map && aspect >= 1.4;
    return overviewTarget.clone().add(vec(0, .5, Math.max(wideChart ? 39 : 42, (wideChart ? 31 : 34) / (tangent * aspect))));
  }

  function nearEye(id) {
    const radius = flightRadius[id];
    return worlds[id].clone().add(vec(radius * .2, radius * .17, closeRange(id)));
  }

  function render(view, aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const map = view.screen === 'directory';
    const departure = view.screen === 'launchpad';
    const origin = worlds[view.from];
    const profile = map ? null : routeFlight(view.from, view.destination);
    const eye = overviewEye(aspect, map);
    const stage = departureStage(view.launchProgress);
    const p = departure && view.reduceMotion && view.launchProgress < 1 ? departureStops[stage] : view.launchProgress;
    const t = map || departure ? 0 : clamp(view.elapsed / profile.duration, 0, 1);
    const scale = map ? 1 : departure ? profile.scale ** smoothstep(p, .62, 1) : profile.scale;
    positionWorlds(eye, scale, map);
    const target = map ? null : planets[view.destination].position;
    camera.up.copy(viewUp);
    if (map) {
      const next = worlds[view.mapSelection] ?? overviewTarget;
      const previous = worlds[view.mapMotion?.from] ?? overviewTarget;
      const amount = view.mapMotion?.progress ?? 1;
      const focusScale = aspect < 1.15 ? .035 : .09;
      mapFocus.copy(previous).lerp(next, amount).sub(overviewTarget).multiplyScalar(focusScale);
      mapFocus.z = 0;
      mapAim.copy(overviewTarget).addScaledVector(mapFocus, .72);
      camera.position.copy(eye).add(mapFocus);
      camera.position.x += view.parallax.x * 1.6;
      camera.position.y -= view.parallax.y * 1.1;
      if (aspect < 1.15) camera.up.set(.39, .92, 0);
      camera.lookAt(mapAim);
    } else if (departure) {
      const start = nearEye(view.from);
      // Pull back continuously, then establish the departure heading for the longer flight.
      const pullback = (4 ** p - 1) / 3;
      const aim = origin.clone().lerp(overviewTarget, smoothstep(p, .16, 1));
      camera.position.copy(start).lerp(eye, pullback);
      camera.lookAt(aim);
    } else {
      const offset = eye.clone().sub(target);
      const far = offset.length();
      const near = closeRange(view.destination);
      const approach = view.arrivalPush ?? 0;
      const range = far * (near / far) ** (t ** profile.coast) *
        (1 - approach * (view.destination === 'b612' ? .05 : .45));
      camera.position.copy(target).addScaledVector(offset, range / far);
      const aim = overviewTarget.clone().sub(eye).normalize()
        .lerp(offset.normalize().negate(), smoothstep(t, 0, .16));
      camera.lookAt(camera.position.clone().add(aim));
    }
    camera.updateMatrixWorld();
    track = target && {
      ...projectPoint(view.destination),
      trackingOpacity: departure ? smoothstep(p, .855, .99) : 1
    };
    const beaconFade = 1 - smoothstep(track?.radius ?? 0, 1.25, 4);
    beacon.visible = Boolean(track?.visible && beaconFade > 0);
    if (beacon.visible) {
      beacon.position.copy(target).addScaledVector(camera.position.clone().sub(target).normalize(), flightRadius[view.destination] * 1.4);
      beacon.material.opacity = .9 * beaconFade;
    }
    starfield.position.copy(camera.position);
    staticPath.visible = map || (departure ? p >= .22 : t < .63);
    const chartFade = departure ? smoothstep(p, .22, .69) * (1 - smoothstep(p, .8, .99)) : 0;
    staticPath.material.opacity = map ? .44 : .49 * chartFade;
    const suggested = destinationIds.slice(1).find(id => !view.records[id]);
    updateCourse(map ? view.current : view.from, map ? view.mapSelection ?? suggested : view.destination);
    course.material.opacity = map ? .64 : .64 * chartFade;
    lens.visible = !map && !departure && view.destination === 'miller' && t >= .25 && t < .65;
    if (lens.visible) {
      const depth = lerp(12, 1.5, smoothstep(t, .25, .65));
      lens.position.copy(vec(0, -.08, -depth).applyQuaternion(camera.quaternion).add(camera.position));
      lens.quaternion.copy(camera.quaternion);
      rings.forEach((ring, i) => { ring.material.opacity = .62 * (1 - i / rings.length) * Math.sin(Math.PI * (t - .25) / .4); });
    }
    streaks.visible = !map && !departure && !view.reduceMotion && t > .03 && t < .82;
    if (streaks.visible) {
      streaks.position.copy(camera.position);
      streaks.quaternion.copy(camera.quaternion);
      streaks.material.opacity = .49 * Math.sin(Math.PI * (t - .03) / .79);
      dust.forEach(({x, y, z, length}, i) => {
        const depth = -1 - (z + 240 * (1 - t)) % 82;
        dustPositions.set([x, y, depth, x, y, depth - length], i * 6);
      });
      streakPositions.needsUpdate = true;
    }
    renderOptics(view, track);
    renderer.render(scene, camera);
  }

  function projectPoint(id) {
    const position = planets[id].position;
    const center = position.clone().project(camera);
    const offset = position.clone().addScaledVector(viewUp, planets[id].scale.y).project(camera);
    return {
      id, x: 50 * (1 + center.x), y: 50 * (1 - center.y),
      radius: Math.abs(offset.y - center.y) * renderer.domElement.clientHeight / 2,
      visible: center.z > -1 && center.z < 1 && Math.abs(center.x) < .95 && Math.abs(center.y) < .82
    };
  }

  return { render, project: () => ids.map(projectPoint), target: () => track, petrovaSignal: () => signalPoint };
}
