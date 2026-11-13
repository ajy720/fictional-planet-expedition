import * as THREE from 'three';
import { atmosphere, glow, makeB612, randomSequence } from './models.js';
import { introSectionAt } from './intro.js';

const vector = (x, y, z) => new THREE.Vector3(x, y, z);
const ORBIT_START = vector(.4, .28, 1).normalize();
const math = THREE.MathUtils;
const turn = math.degToRad;
const initial = new THREE.Spherical().setFromVector3(ORBIT_START.clone().multiplyScalar(3.8));

export const initialOrbit = () => ({ theta: initial.theta, phi: initial.phi, radius: initial.radius });

export function adjustOrbit(orbit, x, y, zoom = 1) {
  orbit.theta += turn(x);
  orbit.phi = math.clamp(orbit.phi + turn(y), turn(10), turn(170));
  orbit.radius = math.clamp(orbit.radius * zoom, 1.5, 5.45);
}

export async function createScene(container, labels, lookLabels) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.tabIndex = -1;
  renderer.domElement.setAttribute('aria-label', '3D 관측창. B612 도착 후 방향키로 회전하고 + 또는 −로 확대하거나 축소할 수 있습니다.');
  container.replaceChildren(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(43, 1, .01, 2600);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080e');
  const sunlight = new THREE.DirectionalLight(0xffe2c2, 2.5);
  sunlight.position.set(-2.8, 3.1, 5.4);
  const fill = new THREE.HemisphereLight(0xb8d5ff, 0x333244, .68);
  const flowerLight = new THREE.DirectionalLight(0xf9d9cc, 1.35);
  flowerLight.position.set(-4, 4, -4);
  scene.add(sunlight, fill, flowerLight);

  const random = randomSequence(61243);
  const stars = [];
  const tint = [];
  for (let i = 0; i < 5400; i++) {
    const y = 2 * random() - 1;
    const angle = Math.PI * 2 * random();
    const r = Math.sqrt(1 - y * y) * 890;
    stars.push(r * Math.cos(angle), y * 890, r * Math.sin(angle));
    const value = .16 + .65 * random() ** 5;
    tint.push(value * .82, value * .92, value);
  }
  const starField = new THREE.BufferGeometry();
  starField.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  starField.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  const background = new THREE.Points(starField, new THREE.PointsMaterial({ vertexColors: true, size: 1.35, sizeAttenuation: false, toneMapped: false }));
  scene.add(background);

  const loader = new THREE.TextureLoader();
  let earthMap, moonMap, cloudMap;
  try {
    [earthMap, moonMap, cloudMap] = await Promise.all([
      loader.loadAsync(import.meta.env.BASE_URL + 'textures/earth.jpg'),
      loader.loadAsync(import.meta.env.BASE_URL + 'textures/moon.jpg'),
      loader.loadAsync(import.meta.env.BASE_URL + 'textures/clouds.png')
    ]);
  } catch (error) {
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
  for (const map of [earthMap, moonMap, cloudMap]) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  function globe(radius, map) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), new THREE.MeshStandardMaterial({
      map, roughness: .88
    }));
  }

  const earthSystem = new THREE.Group();
  const earth = new THREE.Group();
  const earthSphere = globe(1, earthMap);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.01, 40, 24), new THREE.MeshStandardMaterial({
    map: cloudMap, transparent: true, opacity: .61, depthWrite: false
  }));
  const rim = atmosphere(1.025);
  clouds.renderOrder = 1;
  rim.renderOrder = 2;
  earth.add(earthSphere, clouds, rim);
  function earthAngle(x, y, z) {
    earthSphere.rotation.set(x, y, z);
    clouds.rotation.set(x, y + .04, z);
  }
  const moon = globe(1737.4 / 6371, moonMap);
  moon.position.copy(vector(.54, .075, -.84).normalize().multiplyScalar(384400 / 6371));
  moon.rotation.y = .24;
  earthSystem.add(earth, moon);
  scene.add(earthSystem);

  const au = 149597870.7 / 6371;
  const solar = new THREE.Group();
  solar.position.copy(vector(-.47, 0, -.88).normalize().multiplyScalar(au));
  scene.add(solar);
  const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(109, 3), new THREE.MeshBasicMaterial({ color: 0xffe2ac, transparent: true }));
  const sunGlow = glow(0xffb95f);
  sunGlow.scale.setScalar(1250);
  solar.add(sun, sunGlow);
  const orbitRadii = [.39, .72, 1, 1.52, 2.7, 4, 5.2, 6.4];
  const orbitAngles = [1.65, -1.28, 0, 1.02, 2.45, -.95, 2.85, .22];
  const orbitColors = [0xb0a099, 0xe2a97f, 0x85cfff, 0xd79177, 0xe5b58f, 0xe8c888, 0x91cacf, 0x7998de];
  const markerGeometry = new THREE.IcosahedronGeometry(1, 2);
  const planets = orbitRadii.map((factor, index) => {
    const radius = factor * au;
    const points = Array.from({ length: 144 }, (_, j) => {
      const angle = j / 144 * Math.PI * 2;
      return vector(radius * Math.cos(angle), 0, radius * Math.sin(angle));
    });
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
      color: index === 2 ? 0x5384aa : 0x364b5b, transparent: true, opacity: 0, depthWrite: false
    }));
    const planet = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({
      color: orbitColors[index], transparent: true, opacity: 0, depthWrite: false
    }));
    if (index === 2) planet.position.copy(solar.position).negate();
    else planet.position.set(radius * Math.cos(orbitAngles[index]), 0, radius * Math.sin(orbitAngles[index]));
    solar.add(orbit, planet);
    return { orbit, planet };
  });

  const stellar = new THREE.Group();
  const homeDot = glow(0x84bdfc);
  const alpha = glow(0xffd4a4);
  homeDot.position.set(-3.8, -.75, 0);
  homeDot.scale.setScalar(.86);
  alpha.position.set(4.3, 1.05, -1.8);
  alpha.scale.setScalar(1.36);
  const vectorLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([homeDot.position, alpha.position]), new THREE.LineDashedMaterial({
    color: 0x678198, transparent: true, opacity: .72, dashSize: .13, gapSize: .09
  }));
  vectorLine.computeLineDistances();
  stellar.add(homeDot, alpha, vectorLine);
  scene.add(stellar);

  const asteroid = makeB612();
  scene.add(asteroid.group);
  const streakPositions = new Float32Array(138 * 6);
  const particles = Array.from({ length: 138 }, () => ({
    x: (random() - .5) * 65, y: (random() - .5) * 36, z: random() * 105, size: .12 + random() * 1.5
  }));
  const streakGeometry = new THREE.BufferGeometry();
  const streakAttribute = new THREE.BufferAttribute(streakPositions, 3);
  streakGeometry.setAttribute('position', streakAttribute);
  const streaks = new THREE.LineSegments(streakGeometry, new THREE.LineBasicMaterial({
    color: 0x9dc4de, transparent: true, opacity: .55, depthWrite: false
  }));
  streaks.frustumCulled = false;
  scene.add(streaks);

  const raycaster = new THREE.Raycaster();
  const bloomWorld = new THREE.Vector3();
  const projection = new THREE.Vector3();
  const toBloom = new THREE.Vector3();
  const orbitPosition = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const stageLook = vector(0, 0, 0);
  const overviewDistance = 260000;
  const departure = introPose(1);
  const departureHeading = departure.target.clone().sub(departure.position).normalize();
  const departureRight = departureHeading.clone().cross(vector(0, 1, 0)).normalize();
  const asteroidScale = 1950;
  const destination = departure.position.clone().addScaledVector(departureHeading, 510000)
    .addScaledVector(departureRight, 167000);
  const departureOffset = departure.position.clone().sub(destination);
  const startingDistance = departureOffset.length();
  const heading = new THREE.Vector3();
  const markerPosition = new THREE.Vector3();

  function lookAt(position, target, near = .01, far = 2600) {
    if (camera.near !== near || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(position);
    camera.lookAt(target);
  }

  function label(text, target, opacity = 1, layer = labels) {
    if (opacity <= .01) return;
    target.getWorldPosition(projection).project(camera);
    if (projection.z < -1 || projection.z > 1 || Math.abs(projection.x) > .93 || Math.abs(projection.y) > .81) return;
    const caption = document.createElement('span');
    caption.textContent = text;
    caption.style.left = (projection.x + 1) * 50 + '%';
    caption.style.top = (1 - projection.y) * 50 + '%';
    caption.style.opacity = opacity;
    layer.append(caption);
  }

  function setScene(mode) {
    const solarSystem = mode === 'solar';
    const asteroidCloseup = mode === 'asteroid';
    earthSystem.visible = mode === 'earth' || solarSystem;
    moon.visible = solar.visible = solarSystem;
    stellar.visible = mode === 'stellar';
    asteroid.group.visible = asteroidCloseup;
    if (asteroidCloseup) {
      asteroid.group.position.set(0, 0, 0);
      asteroid.group.scale.setScalar(1);
    }
    sunlight.intensity = asteroidCloseup ? 2.25 : 2.45;
    flowerLight.intensity = asteroidCloseup ? 1.9 : 0;
    fill.intensity = asteroidCloseup ? .82 : .64;
    streaks.visible = false;
  }

  function introPose(progress) {
    const distance = 2.72 * Math.pow(overviewDistance / 2.72, progress);
    const inclination = math.lerp(.045, .74, math.smoothstep(progress, .29, 1));
    const target = solar.position.clone().multiplyScalar(math.smoothstep(distance, 6500, 90000) * .94);
    const offset = vector(-.065, Math.sin(inclination), Math.cos(inclination)).normalize().multiplyScalar(distance);
    return { position: target.clone().add(offset), target, distance };
  }

  function updateSolarMarkers(progress) {
    const opacity = math.smoothstep(progress, .49, .86);
    const planetFade = math.smoothstep(progress, .63, .84);
    const worldPerPixel = 2 * Math.tan(turn(camera.fov / 2)) / renderer.domElement.clientHeight;
    const sunDistance = camera.position.distanceTo(solar.position);
    sun.material.opacity = sunGlow.material.opacity = math.smoothstep(progress, .48, .78);
    sun.scale.setScalar(Math.max(1, sunDistance * worldPerPixel * 4 / 109));
    sunGlow.scale.setScalar(Math.max(1250, sunDistance * worldPerPixel * 43));
    for (let i = 0; i < planets.length; i++) {
      const { orbit, planet } = planets[i];
      orbit.material.opacity = opacity * (i === 2 ? .85 : .63);
      markerPosition.copy(planet.position).add(solar.position);
      planet.scale.setScalar(camera.position.distanceTo(markerPosition) * worldPerPixel * (i === 4 ? 4.4 : 2.6));
      planet.material.opacity = planetFade;
    }
  }

  function renderWorld() {
    camera.updateMatrixWorld();
    background.position.copy(camera.position);
    background.scale.setScalar(Math.max(1, camera.near * 1.5));
    renderer.render(scene, camera);
  }

  function introFrame(progress, reduceMotion) {
    const phase = introSectionAt(progress);
    const position = reduceMotion ? [0, .30, 1][phase] : progress;
    const pose = introPose(position);
    setScene('solar');
    lookAt(pose.position, pose.target, Math.max(.01, pose.distance / 25000), 1200000);
    earthAngle(.13, -1.55 + position * .26, -.17);
    updateSolarMarkers(position);
    renderWorld();
    label('지구', earth, math.smoothstep(position, .19, .26));
    label('달', moon, math.smoothstep(position, .18, .24) * (1 - math.smoothstep(position, .45, .62)));
    label('태양', sun, math.smoothstep(position, .67, .77));
  }

  function flightFrame(elapsed, reduceMotion) {
    const progress = math.clamp(elapsed / 8000, 0, 1);
    setScene('solar');
    asteroid.group.visible = progress > .06;
    const approachLight = math.smoothstep(progress, .38, .93);
    sunlight.intensity = math.lerp(2.45, 2.25, approachLight);
    flowerLight.intensity = 1.9 * approachLight;
    fill.intensity = math.lerp(.64, .82, approachLight);
    asteroid.group.position.copy(destination);
    asteroid.group.scale.setScalar(asteroidScale);
    const closing = 1 - Math.pow(1 - progress, 1.7);
    const distance = startingDistance * Math.pow(initial.radius * asteroidScale / startingDistance, closing);
    heading.copy(departureOffset).normalize().lerp(ORBIT_START, math.smoothstep(progress, .38, .91)).normalize();
    const position = destination.clone().addScaledVector(heading, distance);
    const sight = departureHeading.clone().lerp(heading.clone().negate(), math.smoothstep(progress, 0, .3)).normalize();
    lookAt(position, position.clone().add(sight), Math.max(.01, distance / 25000), 1200000);
    earthAngle(.13, -1.29, -.17);
    updateSolarMarkers(1);
    if (!reduceMotion && progress > 0 && progress < .78) {
      streaks.visible = true;
      streaks.position.copy(camera.position);
      streaks.quaternion.copy(camera.quaternion);
      streaks.scale.setScalar(asteroidScale);
      streaks.material.opacity = .47 * Math.sin(Math.PI * progress / .78);
      for (let i = 0; i < particles.length; i++) {
        const { x, y, z, size } = particles[i];
        const depth = -2 - (z + (1 - progress) * 140) % 105;
        streakPositions.set([x, y, depth, x, y, depth - size], i * 6);
      }
      streakAttribute.needsUpdate = true;
    }
    renderWorld();
    const labelOpacity = 1 - math.smoothstep(progress, 0, .13);
    label('지구', earth, labelOpacity);
    label('태양', sun, labelOpacity);
  }

  function earthFrame(mode) {
    setScene(mode === 'moon' ? 'earth' : 'stellar');
    if (mode === 'stellar') {
      lookAt(vector(0, .35, 13.5), stageLook);
      renderWorld();
      label('태양계', homeDot, 1, lookLabels);
      label('알파 센타우리 A', alpha, 1, lookLabels);
      return;
    }
    if (mode === 'moon') {
      lookAt(vector(.05, 1.8, 20.5), vector(0, 0, 0));
      earthAngle(.12, -1.55, -.17);
      renderWorld();
      return;
    }
    alpha.visible = vectorLine.visible = false;
    homeDot.position.set(mode === 'voyager' ? .44 : .16, .08, 0);
    homeDot.scale.setScalar(mode === 'voyager' ? .16 : .22);
    lookAt(vector(0, 0, 14), stageLook);
    renderWorld();
    alpha.visible = vectorLine.visible = true;
    homeDot.position.set(-3.8, -.75, 0);
    homeDot.scale.setScalar(.86);
  }

  const roseTarget = asteroid.surface.clone().addScaledVector(asteroid.normal, .19);
  const roseTangent = vector(0, 1, 0).cross(asteroid.normal).normalize();
  const rosePosition = roseTarget.clone().addScaledVector(asteroid.normal, .68).addScaledVector(roseTangent, 1.27);
  const orbitDirection = new THREE.Vector3();
  const roseDirection = rosePosition.clone().normalize();
  const cameraArc = new THREE.Quaternion();
  const fullArc = new THREE.Quaternion();
  const orbitRotation = new THREE.Quaternion();
  const roseRotation = new THREE.Quaternion();
  const rotationMatrix = new THREE.Matrix4();

  function orbitView(orbit) {
    const { radius, phi, theta } = orbit;
    spherical.set(radius, phi, theta);
    return orbitPosition.setFromSpherical(spherical);
  }

  function roseTransition(orbit, progress) {
    // Follow an arc around B612 so the camera stays above the terrain.
    const start = orbitView(orbit);
    lookAt(start, stageLook);
    orbitRotation.copy(camera.quaternion);
    roseRotation.setFromRotationMatrix(rotationMatrix.lookAt(rosePosition, roseTarget, asteroid.normal));
    orbitDirection.copy(start).normalize();
    fullArc.setFromUnitVectors(orbitDirection, roseDirection);
    cameraArc.identity().slerp(fullArc, progress);
    camera.position.copy(orbitDirection).applyQuaternion(cameraArc)
      .multiplyScalar(math.lerp(orbit.radius, rosePosition.length(), progress));
    camera.quaternion.slerpQuaternions(orbitRotation, roseRotation, progress);
  }

  function render(view) {
    labels.replaceChildren();
    lookLabels.replaceChildren();
    camera.up.set(0, 1, 0);
    if (view.look) {
      earthFrame(view.look);
      return;
    }
    asteroid.garden.visible = view.screen !== 'flight';
    asteroid.cover.visible = Boolean(view.covered);
    if (view.screen === 'start') {
      setScene('earth');
      const height = 2.23 * Math.tan(turn(camera.fov / 2));
      const portrait = camera.aspect < 1.15;
      lookAt(vector(portrait ? -.2 : -.48, .12, 2.65), vector(-height * camera.aspect * (portrait ? .31 : .50) - .48, .04, 0));
      earthAngle(.13, -1.58, -.21);
      renderWorld();
    } else if (view.screen === 'intro') {
      introFrame(view.progress, view.reduceMotion);
    } else if (view.screen === 'flight') {
      flightFrame(view.elapsed, view.reduceMotion);
    } else {
      setScene('asteroid');
      if (view.roseProgress !== undefined) {
        roseTransition(view.orbit, view.roseProgress);
      } else if (view.screen === 'orbit') {
        lookAt(orbitView(view.orbit), stageLook);
      } else {
        const target = roseTarget.clone();
        const close = rosePosition.clone();
        camera.up.copy(asteroid.normal);
        if (view.screen === 'log') {
          const right = target.clone().sub(close).cross(camera.up).normalize();
          close.addScaledVector(roseTangent, .19);
          target.addScaledVector(right, -.49);
        }
        lookAt(close, target);
      }
      renderWorld();
    }
  }

  function visibleRose() {
    asteroid.bloom.getWorldPosition(bloomWorld);
    projection.copy(bloomWorld).project(camera);
    if (Math.abs(projection.x) > 1 || Math.abs(projection.y) > 1 || projection.z < -1 || projection.z > 1) return null;
    toBloom.copy(bloomWorld).sub(camera.position);
    raycaster.set(camera.position, toBloom.clone().normalize());
    raycaster.far = toBloom.length() - .004;
    if (raycaster.intersectObject(asteroid.terrain, false).length) return null;
    const box = renderer.domElement.getBoundingClientRect();
    return { x: box.left + (projection.x + 1) * box.width / 2, y: box.top + (1 - projection.y) * box.height / 2 };
  }

  return {
    canvas: renderer.domElement,
    render,
    visibleRose,
    resize() {
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    }
  };
}
