import * as THREE from 'three';
import { glow, randomSequence } from './models.js';
import { desertRoutes, destinations, pandoraScale } from './destinations.js';
import { desertSurveyDuration, millerCrestAt, millerWavePassedAt, millerWavePeriod, waterReport } from './observations.js';
import { createEridScene } from './erid-scene.js';
import { createRouteScene } from './routes-scene.js';
import { createTatooineOrbit } from './tatooine-orbit-scene.js';
import { groundSkyAt } from './tatooine-orbit.js';
import { createSpatialTitle, placeSpatialTitle, projectAnchor, updateSpatialTitle } from './spatial-title.js';

const { clamp, lerp, smoothstep, degToRad } = THREE.MathUtils;
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const sphere = new THREE.IcosahedronGeometry(1, 1);
const ball = new THREE.SphereGeometry(1, 44, 28);
const circle = new THREE.RingGeometry(.98, 1, 64);
const flat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
const solid = (color, extra) => new THREE.MeshBasicMaterial({ color, ...extra });

function place(group, geometry, material, at, size = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...at);
  mesh.scale.set(...size);
  group.add(mesh);
  return mesh;
}

function terrain(scene, color, roughness, seed) {
  const random = randomSequence(seed);
  const geometry = new THREE.PlaneGeometry(150, 150, 60, 60);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    position.setY(i, roughness * (.6 * Math.sin(x * .29 + z * .13) + .4 * Math.cos(z * .41) + random() * .2));
  }
  geometry.computeVertexNormals();
  return place(scene, geometry, flat(color), [0, -.3, -35]);
}

function landscape(horizon, zenith, ground, distance) {
  const scene = new THREE.Scene();
  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { horizon: { value: new THREE.Color(horizon) }, zenith: { value: new THREE.Color(zenith) } },
    vertexShader: `varying vec3 direction; void main() {
      direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    fragmentShader: `varying vec3 direction; uniform vec3 horizon; uniform vec3 zenith; void main() {
      float t = smoothstep(-0.04, 0.66, normalize(direction).y); gl_FragColor = vec4(mix(horizon, zenith, t), 1.);
      #include <colorspace_fragment>
    }`
  });
  const dome = place(scene, ball, sky, [0, 0, 0], [210, 210, 210]);
  dome.renderOrder = -2;
  scene.fog = new THREE.FogExp2(horizon, distance);
  const light = new THREE.DirectionalLight(0xffddd0, 2.5);
  light.position.set(-7, 13, 5);
  const fill = new THREE.HemisphereLight(0xdce9ff, ground, .95);
  scene.add(light, fill);
  const setSky = (low, high) => {
    sky.uniforms.horizon.value.copy(low);
    sky.uniforms.zenith.value.copy(high);
    scene.fog.color.copy(low);
  };
  return { scene, light, fill, setSky };
}

function gasGiant() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 1 },
      shadow: { value: new THREE.Color().setRGB(.31, .22, .16) },
      highlight: { value: new THREE.Color().setRGB(.81, .62, .43) }
    },
    vertexShader: `
      varying vec3 localPosition;
      varying vec3 localNormal;
      void main() {
        localPosition = position;
        localNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      varying vec3 localPosition;
      varying vec3 localNormal;
      uniform float opacity;
      uniform vec3 shadow;
      uniform vec3 highlight;
      void main() {
        vec3 p = normalize(localPosition);
        float latitude = p.y + .035 * sin(p.x * 11. + p.z * 7.);
        float bands = .55 + .23 * sin(latitude * 26.) + .16 * sin(latitude * 61. + p.z * 5.);
        vec3 tint = mix(shadow, highlight, bands);
        float light = .18 + .82 * max(0., dot(normalize(localNormal), normalize(vec3(-.7, .6, .8))));
        gl_FragColor = vec4(light * tint, opacity);
        #include <colorspace_fragment>
      }`
  });
  return new THREE.Mesh(ball, material);
}

function pandoraOrbitalView() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050b17);
  const center = vec(0, 0, 0);
  const orbitRadius = 5.05;
  function drawOrbit(radius, color) {
    const points = [];
    for (let i = 0; i <= 112; i++) {
      const theta = 2 * Math.PI * i / 112;
      points.push(vec(radius * Math.cos(theta), 0, radius * Math.sin(theta)));
    }
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({
      color, dashSize: .15, gapSize: .085, opacity: .69, transparent: true
    }));
    path.computeLineDistances();
    scene.add(path);
  }
  drawOrbit(orbitRadius, 0x6eb1ba);
  const planet = place(scene, ball, solid(0x62c6b1), [0, 0, 0], [.47, .47, .47]);
  const lengthScale = orbitRadius / pandoraScale.centerDistance;
  const mother = gasGiant();
  mother.scale.setScalar(pandoraScale.primaryDiameter * lengthScale / 2);
  mother.rotation.z = -.19;
  scene.add(mother);
  const bodies = [{ labelKey: 'world.pandora.name', position: planet.position }, { labelKey: 'pandora.polyphemus', position: mother.position }];
  const points = [center, vec(orbitRadius, 0, 0)];
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x6eb1ba, opacity: .44, transparent: true }));
  const distanceLine = new THREE.Group();
  distanceLine.add(path);
  const ticks = [];
  for (let km = 100000; km < pandoraScale.centerDistance; km += 100000) {
    const x = km * lengthScale;
    ticks.push(vec(x, 0, -.09), vec(x, 0, .09));
  }
  distanceLine.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks),
    new THREE.LineBasicMaterial({ color: 0x8ac6d2 })));
  scene.add(distanceLine);
  const random = randomSequence(718);
  const dots = Array.from({ length: 260 }, () => vec((random() - .5) * 65, -3 - random() * 30, (random() - .5) * 65));
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(dots), new THREE.PointsMaterial({
    color: 0x6687a4, size: 1.45, sizeAttenuation: false, toneMapped: false
  })));
  return {
    scene, bodies,
    update(camera, progress, time, data) {
      const orbitAngle = -.55 - time / 19000;
      planet.position.set(orbitRadius * Math.cos(orbitAngle), 0, orbitRadius * Math.sin(orbitAngle));
      const compare = Boolean(data?.scaleComparison);
      const diameter = compare ? pandoraScale.tritonDiameter : pandoraScale.pandoraDiameter;
      planet.scale.setScalar(diameter * lengthScale / 2);
      planet.material.color.set(compare ? 0xd9cbbb : 0x62c6b1);
      mother.material.uniforms.shadow.value.set(compare ? 0x18306c : 0x97816f);
      mother.material.uniforms.highlight.value.set(compare ? 0x7da0ee : 0xe8cdb0);
      bodies[0].labelKey = compare ? 'pandora.triton' : 'world.pandora.name';
      bodies[1].labelKey = compare ? 'pandora.neptune' : 'pandora.polyphemus';
      distanceLine.rotation.y = -orbitAngle;
      const zoom = data?.orbitZoom ?? 1;
      const follow = 1 - 1 / zoom;
      const fit = Math.max(1, 1.13 / camera.aspect);
      const distance = fit * lerp(.76, 1, progress) / zoom;
      const x = planet.position.x * follow;
      const z = planet.position.z * follow;
      camera.position.set(x, 9.6 * distance, z + 12.8 * distance);
      const aimHeight = -.9 - .66 * fit;
      camera.lookAt(x, aimHeight / zoom, z + .2 / zoom);
    }
  };
}

function pandora() {
  const { scene, light, fill, setSky } = landscape(0x85c8a1, 0x204a5e, 0x182537, .037);
  terrain(scene, 0x274238, .46, 934);
  const random = randomSequence(127);
  const trunk = flat(0x3f5846);
  const leaf = flat(0x528854, { emissive: 0x0eac9d, emissiveIntensity: 0 });
  const under = flat(0x315445, { emissive: 0x168fb9, emissiveIntensity: 0 });
  const positions = [];
  const groundEye = vec(0, 2, 5);
  const mother = gasGiant();
  mother.position.set(7.5, 25, -54);
  const stem = new THREE.CylinderGeometry(.25, .55, 1, 6);
  for (let i = 0; i < 50; i++) {
    const x = (random() - .5) * 44, z = -4 - random() * 40;
    const h = 2 + random() * 8;
    const sightlineX = mother.position.x * (z - groundEye.z) / (mother.position.z - groundEye.z);
    if (z > -20 && Math.abs(x - sightlineX) < 4.4) continue;
    place(scene, stem, trunk, [x, h / 2, z], [.9, h, .9]).rotation.z = (random() - .5) * .17;
    for (let j = 0; j < 4; j++) {
      const offset = (j - 1.5) * .85;
      place(scene, sphere, j % 2 ? leaf : under, [x + offset, h - .6 + j * .38, z], [1.7, .62, 1.15]).rotation.z = offset * .24;
      positions.push(x + offset, h - .92 + j * .38, z + .7);
    }
  }
  for (let i = 0; i < 180; i++) {
    const x = (random() - .5) * 23, z = 1 - random() * 33, h = .12 + random() * .48;
    place(scene, sphere, under, [x, h, z], [.18, h, .32]).rotation.z = (random() - .5) * .9;
    positions.push(x, h * 1.5, z);
  }
  const dots = new THREE.BufferGeometry();
  dots.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const sparks = new THREE.Points(dots, new THREE.PointsMaterial({ size: .077, color: 0x80ffdc, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(sparks);
  const day = new THREE.Color(0x85c8a1), night = new THREE.Color(0x08182d), upper = new THREE.Color(0x204a5e), dark = new THREE.Color(0x030b1c);
  const low = day.clone(), high = upper.clone();
  const forest = vec(1.45, 1.75, -6);
  mother.material.transparent = true;
  mother.material.depthWrite = false;
  const surfaceDistance = pandoraScale.centerDistance - pandoraScale.pandoraDiameter / 2;
  mother.scale.setScalar(groundEye.distanceTo(mother.position) * pandoraScale.primaryDiameter / (2 * surfaceDistance));
  mother.rotation.z = -.28;
  scene.add(mother);
  const orbit = pandoraOrbitalView();
  const aim = vec(0, 0, 0);
  const pullback = vec(0, 6, 9);
  return { scene, orbit, orbitStart: 1,
    anchors: data => {
      if (data.view !== 'ground' || data.viewProgress !== 0) return [];
      return data.target === 1 && data.light >= .82 ? [['forest-light', forest], ['polyphemus', mother.position]]
        : [['forest-light', forest]];
    },
    update(camera, data) {
    const t = data.light;
    light.intensity = lerp(2.5, .08, t);
    fill.intensity = lerp(.95, .16, t);
    leaf.emissiveIntensity = t * .4;
    under.emissiveIntensity = t * .31;
    sparks.material.opacity = t * .92;
    setSky(low.lerpColors(day, night, t), high.lerpColors(upper, dark, t));
    const lookingUp = Math.max(data.lookPitch ?? 0, Math.min(1, data.viewProgress));
    const pullingBack = smoothstep(data.viewProgress, 1, 1.5);
    const visibility = smoothstep(t, .2, .92);
    mother.visible = visibility > 0;
    mother.material.uniforms.opacity.value = visibility;
    camera.position.copy(groundEye).addScaledVector(pullback, pullingBack);
    aim.set(lerp(.35, 2, lookingUp), lerp(2.4, 24 + pullingBack * 4, lookingUp), lerp(-12, -41, lookingUp));
    camera.lookAt(aim);
  } };
}

function adrian() {
  const { scene } = landscape(0xc9ad84, 0x6f6a58, 0x8f6d46, .034);
  const random = randomSequence(8228);
  const cloud = flat(0xafa38b);
  for (let i = 0; i < 95; i++) {
    const height = Math.floor(random() * 5) * 3.4 - 9;
    place(scene, sphere, cloud, [(random() - .5) * 110, height, -7 - random() * 90], [5 + random() * 12, .5 + random(), 3 + random() * 8]);
  }
  const probe = new THREE.Group();
  scene.add(probe);
  place(probe, new THREE.CylinderGeometry(.61, .82, .82, 8), flat(0x32444e, { metalness: .4 }), [0, .23, 0]);
  place(probe, new THREE.CylinderGeometry(.48, .58, .68, 10), flat(0x92fff1, { emissive: 0x317c73, transparent: true, opacity: .7 }), [0, -.43, 0]);
  for (const x of [-.92, .92]) place(probe, new THREE.BoxGeometry(.8, .18, .48), flat(0x273148), [x, .28, 0]);
  const tether = place(scene, new THREE.CylinderGeometry(.024, .024, 1, 5), flat(0x4e514b), [0, 0, 0]);
  const particles = new THREE.Group();
  for (let i = 0; i < 18; i++) place(particles, sphere, solid(0xc1ece0), [0, 0, 0], [.035, .035, .035]);
  probe.add(particles);
  const slide = new THREE.Group();
  scene.add(slide);
  place(slide, ball, solid(0x163d40), [0, 0, -.9], [2.65, 2.65, .12]);
  const rim = place(slide, circle, solid(0x97d0bb, { side: THREE.DoubleSide }), [0, 0, -.72], [2.65, 2.65, 1]);
  const debris = new THREE.Group();
  slide.add(debris);
  for (let i = 0; i < 42; i++) {
    const r = Math.sqrt(random()) * 1.55, a = random() * Math.PI * 2;
    const dot = place(debris, sphere, solid(i % 3 ? 0x3e8078 : 0x70ac98), [Math.cos(a) * r, Math.sin(a) * r, -.62], [.045, .018, .024]);
    dot.rotation.z = a;
  }
  const organisms = new THREE.Group();
  slide.add(organisms);
  const microbe = flat(0x7bd5a7, {
    emissive: 0x246f4a, emissiveIntensity: .55, transparent: true, depthWrite: false
  });
  for (let i = 0; i < 8; i++) place(organisms, new THREE.CapsuleGeometry(.071, .16, 3, 6), microbe, [0, 0, -.44]);
  const probeAnchor = vec(0, 0, 0);
  const lensAnchor = vec(2.52, .52, -.71);
  let zoom;
  const anchors = data => [['sampling', data.phase === 'magnify' ? lensAnchor : probeAnchor.copy(probe.position)]];
  return { scene, anchors, update(camera, data, reduced) {
    const magnify = data.phase === 'magnify';
    probe.visible = tether.visible = !magnify;
    slide.visible = magnify;
    const down = smoothstep(data.elapsed, 0, 3000);
    const y = lerp(1.05, -1.15, down);
    probe.position.set(.25, y, -4.35);
    tether.position.set(.25, (7 + y) / 2, -4.35);
    tether.scale.y = 7 - y;
    particles.visible = data.elapsed >= 3000;
    particles.children.forEach((child, i) => {
      const spiral = ((reduced ? 0 : data.animation ?? 0) / 1600 + i / 18) % 1;
      const radius = lerp(1.45, .18, spiral);
      child.position.set(radius * Math.cos(i * 2.4), -.44 - .7 * (1 - spiral), radius * Math.sin(i * 2.4));
    });
    if (magnify) {
      camera.position.set(0, 0, 8);
      camera.lookAt(0, 0, 0);
      rim.visible = true;
      const now = data.animation ?? 0;
      const target = data.magnification;
      if (!zoom || reduced || !data.observing || now < zoom.startedAt) {
        zoom = { from: target, to: target, startedAt: now };
      }
      const magnification = lerp(zoom.from, zoom.to, smoothstep(now - zoom.startedAt, 0, 200));
      if (zoom.to !== target) zoom = { from: magnification, to: target, startedAt: now };
      const debrisScale = .78 + magnification * .16;
      const organismScale = magnification / 3;
      // Magnify the specimen in the slide plane without pushing particles behind it.
      debris.scale.set(debrisScale, debrisScale, 1);
      organisms.scale.set(organismScale, organismScale, 1);
      microbe.opacity = lerp(.13, 1, smoothstep(magnification, 1, 3.65));
      const time = reduced ? 0 : now / 1000;
      organisms.children.forEach((child, i) => {
        const angle = i * 2.39;
        child.position.set(Math.sin(angle + time * .45) * (i % 3 + 1) * .46, Math.cos(angle + time * .27) * .99, -.44);
        child.rotation.z = angle - time * .61;
      });
    } else {
      zoom = undefined;
      camera.position.set(0, .9, 5);
      camera.lookAt(0, -.5, -9);
    }
  } };
}

function saltBasin(surface) {
  const positions = surface.geometry.attributes.position;
  const colors = [];
  const sand = surface.material.color.clone();
  const salt = new THREE.Color(0xd9cdb7);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = (positions.getX(i) + 16) / 24;
    const z = (positions.getZ(i) + 5) / 19;
    const edge = Math.hypot(x, z) + .06 * Math.sin(x * 13 + z * 8);
    color.copy(sand).lerp(salt, 1 - smoothstep(edge, .62, 1.04)).toArray(colors, i * 3);
  }
  surface.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  surface.material.vertexColors = true;
  surface.material.color.set(0xffffff);
}

function desertWake(scene) {
  const wake = new THREE.Group();
  const random = randomSequence(942);
  const ridge = new THREE.PlaneGeometry(19, 7, 44, 14);
  ridge.rotateX(-Math.PI / 2);
  const positions = ridge.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) - 6.7;
    const z = positions.getZ(i);
    const crest = .43 * Math.sin(x * .57) - x * .08;
    const width = lerp(.65, 2.5, smoothstep(x, -16, -1));
    const crossSection = Math.max(0, 1 - Math.abs(z - crest) / width) ** 1.2;
    const lengthwise = smoothstep(x, -16, -.8) * (1 - smoothstep(x, -.5, 2.8));
    const y = -.37 + 2.15 * lengthwise * crossSection * (.8 + random() * .32);
    positions.setXYZ(i, x, y, z);
  }
  ridge.computeVertexNormals();
  place(wake, ridge, flat(0xc29460), [0, 0, 0]);
  const dust = [];
  for (let i = 0; i < 230; i++) {
    const trailing = random();
    const x = .9 - trailing * 16;
    const y = .38 + random() ** 1.6 * lerp(2.6, .75, trailing);
    const z = (random() - .5) * lerp(3, 4.8, trailing) - x * .09;
    dust.push(x, y, z);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  const softParticle = glow(0xffffff);
  wake.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0xc18f61, map: softParticle.material.map, size: .66, transparent: true, opacity: .54, depthWrite: false
  })));
  softParticle.material.dispose();
  scene.add(wake);
  return wake;
}

function desertCistern(scene, viewpoint, rock) {
  const shelter = new THREE.Group();
  shelter.position.set(12.15, -.06, -17.8);
  shelter.rotation.y = Math.atan2(viewpoint.x - shelter.position.x, viewpoint.z - shelter.position.z);
  scene.add(shelter);
  const stone = flat(0x625850, { side: THREE.DoubleSide });
  const rim = flat(0x8f7d6a, { side: THREE.DoubleSide });
  const mineral = flat(0xe1c7a3, { side: THREE.DoubleSide, emissive: 0x695645, emissiveIntensity: .04 });
  const basin = (radius, height, arcStart = .2 * Math.PI, arcLength = 1.6 * Math.PI) =>
    new THREE.CylinderGeometry(radius, radius, height, 35, 1, true, arcStart, arcLength);
  place(shelter, basin(1.63, 1.23), stone, [0, .61, 0]);
  place(shelter, basin(1.69, .13), rim, [0, 1.22, 0]);
  const floor = place(shelter, new THREE.CircleGeometry(1.65, 40), flat(0x45392e), [0, .08, 0]);
  floor.rotation.x = -Math.PI / 2;
  const stain = flat(0x4a3a30, { side: THREE.DoubleSide });
  place(shelter, basin(1.62, .23), stain, [0, .52, 0]);
  for (let i = 0; i < 11; i++) {
    place(shelter, basin(1.608, .052 + .021 * Math.sin(i * 2.4), .68 + i * .449, .44),
      mineral, [0, .66 + .012 * Math.cos(i * 4), 0]);
  }
  place(shelter, sphere, rock, [-2.55, 1.32, -.75], [1.3, 2.03, 1.9]);
  place(shelter, sphere, rock, [2.62, 1.51, -.91], [1.35, 2.36, 1.79]);
  place(shelter, sphere, rock, [0, 2.91, -1.26], [3.61, .84, 2.18]);
  place(shelter, sphere, rock, [-.24, 1.24, -3.22], [3.1, 2.21, 1.22]);
  shelter.updateMatrixWorld();
  return { target: shelter.localToWorld(vec(0, .76, -.99)), mineral };
}

function desertWaterBottle(table) {
  const bottle = new THREE.Group();
  bottle.position.copy(table.position);
  bottle.position.add(vec(-.28, table.scale.y / 2, .13));
  bottle.rotation.y = -.22;
  bottle.visible = false;
  table.parent.add(bottle);

  const shadow = place(bottle, new THREE.CircleGeometry(.25, 32),
    solid(0x322215, { transparent: true, opacity: .22, depthWrite: false }),
    [.025, .002, -.012], [1.16, .8, 1]);
  shadow.rotation.x = -Math.PI / 2;

  const metal = new THREE.MeshStandardMaterial({ color: 0x373735, roughness: .42, metalness: .45 });
  place(bottle, new THREE.CylinderGeometry(.192, .183, .08, 32), metal, [0, .04, 0]);
  place(bottle, new THREE.CylinderGeometry(.123, .126, .12, 32), metal, [0, .89, 0]);
  const grip = new THREE.BoxGeometry(.014, .083, .013);
  const gripMaterial = flat(0x656158);
  for (let i = 0; i < 18; i++) {
    const angle = i / 18 * Math.PI * 2;
    place(bottle, grip, gripMaterial, [.124 * Math.sin(angle), .89, .124 * Math.cos(angle)]).rotation.y = angle;
  }

  const profile = [[.182, .063], [.205, .095], [.205, .75], [.191, .79], [.122, .833], [.122, .857]];
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xd2e9dd, roughness: .21, clearcoat: 1, transparent: true, opacity: .26, depthWrite: false
  });
  place(bottle, new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 40), glass, [0, 0, 0]);

  const liquid = new THREE.MeshStandardMaterial({ color: 0x287a70, roughness: .32 });
  const surface = new THREE.MeshStandardMaterial({ color: 0x78bfb3, roughness: .36 });
  const water = place(bottle, new THREE.CylinderGeometry(.175, .175, 1, 40), [liquid, surface, liquid], [0, 0, 0]);
  const tick = new THREE.BoxGeometry(1, .008, .004);
  const marking = solid(0xede3c9);
  const waterBottom = .089;
  const chamberHeight = .66;
  for (let i = 0; i <= 10; i++) {
    const width = i % 5 === 0 ? .065 : .034;
    place(bottle, tick, marking, [.097 - width / 2, waterBottom + chamberHeight * i / 10, .188], [width, 1, 1]);
  }

  const reading = bottle.position.clone().add(vec(.36, .65, .04));
  return { bottle, reading, fill(left) {
    water.scale.y = chamberHeight * left / 100;
    water.position.y = waterBottom + water.scale.y / 2;
  } };
}

function arrakis() {
  const { scene, light, fill } = landscape(0xe8bd87, 0x597d8b, 0xaa6c43, .022);
  saltBasin(terrain(scene, 0xb57945, .57, 945));
  const random = randomSequence(590);
  const sand = flat(0xd4a367);
  const rock = flat(0x825942);
  for (let i = 0; i < 38; i++) {
    const x = (random() - .5) * 98, z = -55 - random() * 52;
    const ridge = place(scene, sphere, sand, [x, -.54, z], [6 + random() * 14, 2 + random() * 4, 4 + random() * 16]);
    ridge.rotation.y = random();
  }
  for (let i = 0; i < 16; i++) {
    const z = -4 - i * 1.9;
    const x = 4.1 + Math.sin(i * .45) * 2.8;
    const cliff = place(scene, sphere, rock, [x, 1.2, z], [1.45 + random(), 2.5 + random() * 3, 1.7]);
    cliff.rotation.y = random() * Math.PI;
  }
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? -1 : 1;
    const d = 4.75 + random() * 2.7;
    place(scene, sphere, rock, [side * d, .24 + random() * .35, -34 - random() * 8],
      [1.25 + random() * 2.1, .65 + random() * 2.1, 1.7 + random() * 2]);
  }
  const paths = {
    sun: new THREE.CatmullRomCurve3([vec(0, 1.9, 8), vec(-3, 2.5, 0), vec(-6.3, 2.4, -12), vec(-3, 1.9, -24), vec(0, 1.9, -29)]),
    shade: new THREE.CatmullRomCurve3([vec(0, 1.9, 8), vec(6, 1.7, 1), vec(8.5, 1.5, -13), vec(6, 1.8, -26), vec(0, 1.9, -29)])
  };
  const wake = desertWake(scene);
  const cistern = desertCistern(scene,
    paths.shade.getPointAt(desertRoutes.shade.lookout / desertRoutes.shade.duration), flat(0x5c443a));
  const lamp = new THREE.SpotLight(0xffe8bb, 0, 13, .43, .66, 1.65);
  lamp.target.position.copy(cistern.target);
  scene.add(lamp, lamp.target);
  const landingView = vec(0, .95, -38);
  const stationStone = flat(0x51443d);
  const station = new THREE.BoxGeometry(1, 1, 1);
  for (const x of [-1.88, 1.88]) {
    place(scene, station, stationStone, [x, .35, -36.2], [.24, 1.22, .32]);
    place(scene, station, solid(0xf0c484), [x, .83, -36.02], [.16, .12, .04]);
  }
  const table = place(scene, station, flat(0x775e45), [0, .21, -38.04], [2.15, .48, 1.11]);
  const waterBottle = desertWaterBottle(table);
  for (const [name, path] of Object.entries(paths)) {
    for (let i = 1; i < 13; i++) {
      const p = path.getPointAt(i / 13);
      place(scene, sphere, flat(name === 'sun' ? 0xc5ab83 : 0x665e54), [p.x, .15, p.z], [.46, .13, .65]);
    }
  }
  const sun = glow(0xffcd84);
  sun.position.set(-28, 30, -75);
  sun.scale.setScalar(29);
  scene.add(sun);
  const pathAnchors = Object.entries(paths).map(([name, path]) => {
    const position = path.getPointAt(name === 'shade' ? .36 : .22);
    position.y = .29;
    return [name + '-path', position];
  });
  const fork = vec(.65, 2.35, -15);
  const wakeTarget = vec(0, .75, -41);
  return { scene, anchors(data) {
    if (!data.path) return pathAnchors;
    if (data.complete) return [['desert-water-reading', waterBottle.reading]];
    const route = desertRoutes[data.path];
    return data.elapsed === route.lookout && data.desertSurvey === null
      ? [['desert-lookout', data.path === 'shade' ? cistern.target : wakeTarget]] : [];
  }, update(camera, data, reduced) {
    const path = paths[data.path ?? 'sun'];
    const route = desertRoutes[data.path ?? 'sun'];
    waterBottle.bottle.visible = data.observing && Boolean(data.path && data.complete);
    if (waterBottle.bottle.visible) waterBottle.fill(waterReport(route, 1, data.suitChecked).left);
    const stop = route.lookout / route.duration;
    const raw = clamp(data.path ? data.elapsed / route.duration : 0, 0, 1);
    const t = !reduced || raw === 1 ? raw
      : raw < stop ? (raw < stop * .5 ? 0 : stop * .5) : raw < .76 ? stop : .76;
    const atLookout = data.path ? 1 - smoothstep(Math.abs(t - stop), 0, .14) : 0;
    const survey = clamp((data.desertSurvey ?? 0) / desertSurveyDuration, 0, 1);
    const instrument = data.desertSurvey == null ? 0 : atLookout * (reduced ? 1 : smoothstep(survey, 0, .24));
    const shade = data.path === 'shade' ? Math.sin(Math.PI * t) : 0;
    light.intensity = lerp(3.1, .34, shade);
    fill.intensity = lerp(.97, .48, shade);
    camera.position.copy(path.getPointAt(t));
    const target = path.getPointAt(Math.min(1, t + .17));
    const entering = smoothstep(t, 0, .23);
    target.lerp(fork, 1 - entering);
    target.lerp(landingView, smoothstep(t, .78, 1));
    wake.position.set(lerp(-23, -11, reduced && data.desertSurvey != null ? .86 : survey), .04, -40.7);
    wake.visible = data.path === 'sun' && raw > .25 && raw < .78;
    wakeTarget.set(wake.position.x - (2.8 + 2 * survey), .92, wake.position.z);
    target.lerp(data.path === 'shade' ? cistern.target : wakeTarget, atLookout);
    lamp.position.copy(camera.position);
    lamp.intensity = data.path === 'shade' ? 185 * instrument : 0;
    cistern.mineral.emissiveIntensity = data.path === 'shade' ? lerp(.04, .38, instrument) : .04;
    camera.fov = lerp(lerp(55, 47, entering), data.path === 'sun' ? 20 : 39, instrument);
    if (camera.aspect < 1 && data.path === 'shade' && atLookout > 0) camera.fov += 10 * atLookout;
    camera.updateProjectionMatrix();
    camera.lookAt(target.x, target.y - .13, target.z);
  } };
}

function miller() {
  const { scene } = landscape(0x9aabad, 0x293641, 0x273340, .022);
  const geometry = new THREE.PlaneGeometry(145, 150, 90, 90);
  geometry.rotateX(-Math.PI / 2);
  const surface = place(scene, geometry, flat(0x56777d, { roughness: .27, metalness: .34 }), [0, -.15, -44]);
  const waveGeo = new THREE.PlaneGeometry(115, 21, 60, 20);
  waveGeo.rotateX(-Math.PI / 2);
  const wave = place(scene, waveGeo, new THREE.MeshStandardMaterial({
    color: 0x435b69, roughness: .43, metalness: .07, side: THREE.DoubleSide
  }), [0, -.14, -73]);
  const crestLength = 95;
  const crestPositions = new THREE.Float32BufferAttribute(new Float32Array(crestLength * 3), 3);
  const crestGeometry = new THREE.BufferGeometry();
  crestGeometry.setAttribute('position', crestPositions);
  const foam = new THREE.Line(crestGeometry, new THREE.LineBasicMaterial({
    color: 0xa8d0d4, opacity: .4, transparent: true, depthWrite: false
  }));
  foam.frustumCulled = false;
  wave.add(foam);
  const surfaceHeight = (x, z, time, height) => .08 * Math.sin(x * .64 + z * 1.4 - time * 1.27)
    + height * Math.exp(-((z + Math.sin(x * .09) - time * .13) ** 2) / 10) * (1 + .17 * Math.cos(x * .12));
  const updateWater = (mesh, time, crest) => {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      positions.setY(i, surfaceHeight(x, z, time, crest));
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  };
  let updated = -1;
  return { scene, anchors: () => [], update(camera, data, reduced) {
    const phase = data.elapsed % millerWavePeriod;
    const frame = reduced ? (phase < millerCrestAt ? 1400 : phase < millerWavePassedAt ? millerCrestAt : millerWavePassedAt) : phase;
    const approach = Math.min(1, frame / millerCrestAt);
    const breaking = smoothstep(frame, millerCrestAt, millerWavePeriod);
    const emerging = data.elapsed < millerWavePeriod ? 1 : smoothstep(frame, 0, 1400);
    const height = lerp(8.1, 11.8, approach) * emerging * (1 - breaking);
    wave.position.z = -73 + approach * 55 + breaking * 32;
    wave.visible = height > .15;
    foam.material.opacity = lerp(.4, .72, breaking);
    const bucket = Math.floor((reduced ? frame : data.elapsed) / 100);
    if (bucket !== updated) {
      updateWater(surface, (reduced ? frame : data.elapsed) / 1000, 0);
      const time = frame / 1000;
      updateWater(wave, time, height);
      for (let i = 0; i < crestLength; i++) {
        const x = lerp(-54, 54, i / (crestLength - 1));
        const z = time * .13 - Math.sin(x * .09);
        crestPositions.setXYZ(i, x, surfaceHeight(x, z, time, height) + .045, z);
      }
      crestPositions.needsUpdate = true;
      updated = bucket;
    }
    camera.position.set(0, 2.25, 6);
    camera.lookAt(0, 2.8 + approach * (1 - breaking) * 3.9, -41);
  } };
}

function tatooine() {
  const { scene, light, fill, setSky } = landscape(0xe59a64, 0x6e667d, 0xaa6a49, .018);
  light.intensity = 0;
  terrain(scene, 0xa46d45, .22, 231);
  place(scene, new THREE.CylinderGeometry(6, 6.16, .22, 10), flat(0xbe9267), [0, -.03, -.15]);
  place(scene, new THREE.CylinderGeometry(.41, .56, 1.7, 7), flat(0xb38562), [0, .93, 0]);
  place(scene, new THREE.CylinderGeometry(.56, .58, .11, 7), flat(0xcba179), [0, 1.76, 0]);
  const dune = flat(0xc4936a);
  for (let i = 0; i < 14; i++) place(scene, sphere, dune, [(i - 7) * 8.5, -.37, -25 - (i % 4) * 8], [9, 1.8 + i % 3, 9]);
  const stars = [0xffd69a, 0xffaa7b].map((color, i) => {
    const sun = place(scene, ball, solid(color, { fog: false }), [0, 0, 0]);
    sun.scale.setScalar(i ? 1.45 : 2.75);
    const halo = glow(color);
    halo.scale.setScalar(i ? 10 : 12);
    sun.add(halo);
    const lamp = new THREE.DirectionalLight(color, 1.5);
    scene.add(lamp);
    const shadow = place(scene, new THREE.PlaneGeometry(.53, 1), solid(i ? 0x3b3856 : 0x2c2941, { transparent: true, opacity: .38, depthWrite: false }), [0, .1, 0]);
    shadow.geometry.translate(0, -.5, 0);
    shadow.rotation.x = -Math.PI / 2;
    return { sun, lamp, shadow };
  });
  const low = new THREE.Color(), high = new THREE.Color();
  const day = new THREE.Color(0xdb9a68), night = new THREE.Color(0x211d3c);
  const upper = new THREE.Color(0x6a678b), dark = new THREE.Color(0x080d25);
  const groundEye = vec(0, 5.4, 15.5);
  const gnomon = vec(.3, 1.45, 0);
  const orbit = createTatooineOrbit();
  return { scene, orbit, orbitStart: 0, anchors: data => data.viewProgress === 0 ? [['sunset', gnomon]] : [],
    update(camera, data) {
    const { suns } = groundSkyAt(data.orbitDays ?? 0, data.sky);
    const highest = Math.max(suns[0].altitude, suns[1].altitude);
    const dusk = 1 - smoothstep(highest, degToRad(-13), degToRad(29));
    setSky(low.lerpColors(day, night, dusk), high.lerpColors(upper, dark, dusk));
    fill.intensity = lerp(1.1, .42, dusk);
    stars.forEach(({ sun, lamp, shadow }, index) => {
      const { above, altitude, direction, distance } = suns[index];
      const [x, y, z] = direction;
      sun.position.set(x, y, z).multiplyScalar(distance * 135).add(groundEye);
      sun.visible = shadow.visible = above;
      lamp.position.set(x, y, z);
      lamp.intensity = above ? (.85 + Math.sin(altitude) * 1.15) * (index ? .65 : 1) : 0;
      shadow.rotation.z = -Math.atan2(x, -z);
      shadow.scale.y = 1.7 * clamp(1 / Math.tan(Math.max(.01, altitude)), 1, 8);
    });
    const pullBack = smoothstep(data.viewProgress, 0, .5);
    camera.position.set(groundEye.x, groundEye.y + pullBack * 8, groundEye.z + pullBack * 8);
    camera.lookAt(0, 12.4 + pullBack * 16.6, -28);
    camera.fov = lerp(90, 56, pullBack);
    camera.updateProjectionMatrix();
  } };
}

const makeSurface = { pandora, adrian, erid: createEridScene, arrakis, miller, tatooine };

export function createExpeditionScenes(renderer, viewportCamera, asteroidTemplate, earthTemplate) {
  const surfaces = new Map();
  const camera = new THREE.PerspectiveCamera(46, 1, .025, 260);
  const routes = createRouteScene(renderer, asteroidTemplate, earthTemplate);
  let signals = null;

  function prepare(id) {
    if (makeSurface[id] && !surfaces.has(id)) {
      const surface = makeSurface[id]();
      surface.title = createSpatialTitle(destinations[id].name);
      surface.scene.add(surface.title);
      surfaces.set(id, surface);
    }
  }

  function render(view) {
    signals = null;
    camera.aspect = viewportCamera.aspect;
    camera.fov = 46;
    camera.updateProjectionMatrix();
    if (['directory', 'launchpad', 'route-flight'].includes(view.screen)) {
      routes.render(view, camera.aspect);
      return true;
    }
    const id = view.screen === 'surface' ? view.destination
      : view.screen === 'log' ? view.recordView : view.current;
    if (!id || id === 'b612') return false;
    prepare(id);
    const surface = surfaces.get(id);
    const data = view.screen === 'surface' ? view.observation : view.records[id]?.view;
    if (!data) return false;
    const orbitProgress = surface.orbit ? (data.viewProgress ?? 0) - surface.orbitStart : 0;
    const chart = orbitProgress >= .5;
    const observing = view.screen === 'surface';
    const orbitalCamera = chart && surface.orbit.camera;
    const chartProgress = smoothstep(orbitProgress, .5, 1);
    if (orbitalCamera) {
      surface.orbit.update(camera.aspect, renderer.domElement.clientHeight, chartProgress, data.orbitDays ?? 0);
    } else if (chart) surface.orbit.update(camera, chartProgress, view.reduceMotion ? 0 : view.motionTime, observing ? data : null);
    else surface.update(camera, { ...data, animation: view.motionTime, observing }, view.reduceMotion);
    const hasWideView = camera.aspect >= 1.15;
    const isMoving = id === 'arrakis' && Boolean(data.path);
    const specialView = isMoving || data.viewProgress > 0 || (id === 'pandora' && data.lookPitch > .27) || (id === 'adrian' && data.phase === 'magnify');
    surface.title.visible = observing && !specialView && hasWideView;
    if (surface.title.visible) updateSpatialTitle(surface.title, destinations[id].name);
    if (surface.title.visible && surface.titleAspect !== camera.aspect) {
      placeSpatialTitle(surface.title, camera, 9.4, -.66, .50, .30);
      surface.titleAspect = camera.aspect;
    }
    if (observing && !isMoving && !chart) {
      camera.translateX(view.parallax.x * .34);
      camera.translateY(-view.parallax.y * .19);
      camera.rotateY(-view.parallax.x * .022);
      camera.rotateX(-view.parallax.y * .015);
    }
    const renderCamera = orbitalCamera || camera;
    renderer.render(chart ? surface.orbit.scene : surface.scene, renderCamera);
    if (observing) {
      const project = point => projectAnchor(point, renderCamera, renderer.domElement);
      signals = {
        title: surface.title.visible,
        transitionFade: .91 * (1 - smoothstep(Math.abs(orbitProgress - .5), 0, .26)),
        orbitSpan: orbitalCamera ? orbitalCamera.top - orbitalCamera.bottom : null,
        anchors: chart ? [] : surface.anchors(data).map(([key, point]) => [key, project(point)]),
        bodies: chart && orbitProgress >= .82
          ? surface.orbit.bodies.map(body => ({ ...body, point: project(body.position) })) : [],
        echoes: surface.echoes?.().map(echo => ({ ...echo, point: project(echo.position) }))
      };
    }
    return true;
  }

  return { prepare, render, routePoints: routes.project, routeTarget: routes.target, petrovaSignal: routes.petrovaSignal, surfaceSignals: () => signals };
}
