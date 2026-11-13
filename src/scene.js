import * as THREE from 'three';
import { atmosphere, glow, makeB612, randomSequence } from './models.js';

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

export async function createScene(container, labels) {
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
  moon.position.set(384400 / 6371, 0, 0);
  earthSystem.add(earth, moon);
  scene.add(earthSystem);

  const solar = new THREE.Group();
  scene.add(solar);
  const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(.7, 3), new THREE.MeshBasicMaterial({ color: 0xffe2ac }));
  const sunGlow = glow(0xffb95f);
  sunGlow.scale.setScalar(4.2);
  solar.add(sun, sunGlow);
  const orbitRadii = [1.6, 2.55, 3.6, 4.85, 7.2, 9.7, 12, 14.2];
  const orbitAngles = [1.65, -1.28, .45, 1.02, 2.45, -.95, 2.85, .22];
  const orbitColors = [0xb0a099, 0xe2a97f, 0x85cfff, 0xd79177, 0xe5b58f, 0xe8c888, 0x91cacf, 0x7998de];
  const solarPlanets = orbitRadii.map((radius, index) => {
    const points = Array.from({ length: 112 }, (_, j) => {
      const angle = j / 112 * Math.PI * 2;
      return vector(radius * Math.cos(angle), 0, radius * Math.sin(angle));
    });
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
      color: index === 2 ? 0x426887 : 0x344655, transparent: true, opacity: .82
    }));
    const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(index === 4 ? .28 : .14, 2), new THREE.MeshBasicMaterial({ color: orbitColors[index] }));
    planet.position.set(radius * Math.cos(orbitAngles[index]), 0, radius * Math.sin(orbitAngles[index]));
    solar.add(orbit, planet);
    return planet;
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
  const stageStart = vector(.4, .5, 14);
  const stageLook = vector(0, 0, 0);
  const flightPath = new THREE.CatmullRomCurve3([
    stageStart, vector(.7, .48, 10), vector(2.9, 1.15, 6.6), ORBIT_START.clone().multiplyScalar(initial.radius)
  ], false, 'centripetal');

  const lookAt = (position, target) => {
    camera.position.copy(position);
    camera.lookAt(target);
  };

  function label(text, target) {
    target.getWorldPosition(projection).project(camera);
    if (projection.z < -1 || projection.z > 1 || Math.abs(projection.x) > .93 || Math.abs(projection.y) > .81) return;
    const caption = document.createElement('span');
    caption.textContent = text;
    caption.style.left = (projection.x + 1) * 50 + '%';
    caption.style.top = (1 - projection.y) * 50 + '%';
    labels.append(caption);
  }

  function setLayer(index) {
    earthSystem.visible = index === 0 || index === 1;
    moon.visible = index === 1;
    solar.visible = index === 2;
    stellar.visible = index === 3;
    asteroid.group.visible = index === 4;
    sunlight.intensity = index === 4 ? 2.25 : 2.45;
    flowerLight.intensity = index === 4 ? 1.9 : 0;
    fill.intensity = index === 4 ? .82 : .64;
    streaks.visible = false;
  }

  function introLayer(index, progress) {
    setLayer(index);
    const t = math.clamp((progress - index / 4) * 4, 0, 1);
    if (index === 0) {
      lookAt(vector(-.18, .12, math.lerp(2.72, 12, t)), vector(0, 0, 0));
      earthAngle(.13, -1.55 + t * .22, -.17);
    } else if (index === 1) {
      lookAt(vector(30.15, 3.1, math.lerp(95, 109, t)), vector(30.15, 0, 0));
      earthAngle(.13, -1.55, -.17);
      moon.rotation.y = .24;
    } else if (index === 2) {
      lookAt(vector(-1.2, math.lerp(11, 16, t), math.lerp(18, 23, t)), vector(0, 0, 0));
    } else {
      lookAt(vector(math.lerp(-1, .4, t), math.lerp(.25, .5, t), math.lerp(12, 14, t)), stageLook);
    }
  }

  const targets = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }));
  const blendScene = new THREE.Scene();
  const blendCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blend = new THREE.ShaderMaterial({
    depthTest: false,
    uniforms: { first: { value: targets[0].texture }, second: { value: targets[1].texture }, amount: { value: 0 } },
    vertexShader: 'varying vec2 screenUV; void main() { screenUV = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      varying vec2 screenUV;
      uniform sampler2D first;
      uniform sampler2D second;
      uniform float amount;
      void main() {
        gl_FragColor = mix(texture2D(first, screenUV), texture2D(second, screenUV), amount);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blend));

  function renderWorld(target = null) {
    camera.updateMatrixWorld();
    background.position.copy(camera.position);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  }

  function introFrame(progress, reduceMotion) {
    const index = Math.min(3, Math.floor(progress * 4));
    if (reduceMotion) {
      introLayer(index, index === 3 ? 1 : index / 4 + .025);
      renderWorld();
    } else {
      const boundary = [.25, .5, .75].find(value => Math.abs(progress - value) < .01);
      if (boundary !== undefined) {
        const incoming = boundary * 4;
        introLayer(incoming - 1, progress);
        renderWorld(targets[0]);
        introLayer(incoming, progress);
        renderWorld(targets[1]);
        renderer.setRenderTarget(null);
        blend.uniforms.amount.value = (progress - boundary + .01) / .02;
        renderer.render(blendScene, blendCamera);
        introLayer(index, progress);
        camera.updateMatrixWorld();
      } else {
        introLayer(index, progress);
        renderWorld();
      }
    }
    if (index === 1) {
      label('지구', earth);
      label('달', moon);
    } else if (index === 2) {
      label('태양', sun);
      label('지구', solarPlanets[2]);
    } else if (index === 3) {
      label('태양계', homeDot);
      label('알파 센타우리 A', alpha);
    }
  }

  function flightFrame(elapsed, reduceMotion) {
    const progress = math.clamp(elapsed / 8000, 0, 1);
    const fade = math.clamp(progress / .13, 0, 1);
    if (fade === 0) {
      introLayer(3, 1);
      renderWorld();
      return;
    }
    if (fade < 1 && !reduceMotion) {
      introLayer(3, 1);
      renderWorld(targets[0]);
    }
    setLayer(4);
    lookAt(flightPath.getPoint(progress), stageLook);
    if (!reduceMotion && progress > 0 && progress < .78) {
      streaks.visible = true;
      streaks.position.copy(camera.position);
      streaks.quaternion.copy(camera.quaternion);
      streaks.material.opacity = .47 * Math.sin(Math.PI * progress / .78);
      for (let i = 0; i < particles.length; i++) {
        const { x, y, z, size } = particles[i];
        const depth = -2 - (z + (1 - progress) * 140) % 105;
        streakPositions.set([x, y, depth, x, y, depth - size], i * 6);
      }
      streakAttribute.needsUpdate = true;
    }
    if (fade < 1 && !reduceMotion) {
      renderWorld(targets[1]);
      renderer.setRenderTarget(null);
      blend.uniforms.amount.value = fade;
      renderer.render(blendScene, blendCamera);
    } else renderWorld();
  }

  function earthFrame(mode) {
    setLayer(mode === 'moon' ? 0 : 3);
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

  function render(view) {
    labels.replaceChildren();
    camera.up.set(0, 1, 0);
    if (view.look) {
      earthFrame(view.look);
      return;
    }
    asteroid.cover.visible = Boolean(view.covered);
    if (view.screen === 'start') {
      setLayer(0);
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
      setLayer(4);
      if (view.screen === 'orbit') {
        const { radius, phi, theta } = view.orbit;
        spherical.set(radius, phi, theta);
        lookAt(orbitPosition.setFromSpherical(spherical), stageLook);
      } else {
        const target = asteroid.surface.clone().addScaledVector(asteroid.normal, .19);
        const tangent = vector(0, 1, 0).cross(asteroid.normal).normalize();
        const close = target.clone().addScaledVector(asteroid.normal, .68).addScaledVector(tangent, 1.27);
        camera.up.copy(asteroid.normal);
        if (view.screen === 'log') {
          const right = target.clone().sub(close).cross(camera.up).normalize();
          close.addScaledVector(tangent, .19);
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
      const dimensions = renderer.getDrawingBufferSize(new THREE.Vector2());
      for (const target of targets) target.setSize(dimensions.x, dimensions.y);
    }
  };
}
