import * as THREE from 'three';
import { randomSequence } from './models.js';
import { auKm, binaryOffsets, binaryOrbit, ellipsePosition, orbitPosition, outerOrbit, tatooineBodies } from './tatooine-orbit.js';

const { lerp } = THREE.MathUtils;
const origin = new THREE.Vector3();
const sphere = new THREE.SphereGeometry(1, 80, 56);

const surfaceVertex = `
  varying vec3 surface;
  varying vec3 worldNormal;
  varying vec3 worldPoint;
  void main() {
    surface = position;
    worldNormal = mat3(modelMatrix) * normal;
    worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const noise = `
  float hash(vec3 p) {
    p = fract(p * .3183099 + vec3(.13, .29, .47));
    p *= 17.;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noiseAt(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float terrainAt(vec3 p) {
    return .55 * noiseAt(p) + .27 * noiseAt(p * 2.13)
      + .13 * noiseAt(p * 4.39) + .05 * noiseAt(p * 9.13);
  }
`;

function starMaterial(colors, seed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ember: { value: new THREE.Color(colors[0]) },
      plasma: { value: new THREE.Color(colors[1]) },
      flare: { value: new THREE.Color(colors[2]) },
      seed: { value: seed }
    },
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 surface, worldNormal;
      uniform vec3 ember, plasma, flare;
      uniform float seed;
      ${noise}
      void main() {
        vec3 p = normalize(surface) + seed;
        float flow = terrainAt(p * 6.);
        float granules = noiseAt(p * 140. + flow * 2.);
        float threads = noiseAt(p * 57. + vec3(flow * 6., 0., flow * 3.));
        float hot = smoothstep(.27, .77, .56 * threads + .31 * flow + .13 * granules);
        float spots = smoothstep(.61, .80, noiseAt(p * 11.) * .74 + noiseAt(p * 24.) * .26);
        vec3 color = mix(ember, plasma, hot);
        color = mix(color, flare, .46 * smoothstep(.56, .95, hot) + .13 * granules);
        color *= 1. - .83 * spots;
        float limb = clamp((viewMatrix * vec4(normalize(worldNormal), 0.)).z, 0., 1.);
        gl_FragColor = vec4(color * (.56 + .44 * pow(limb, .55)), 1.);
        #include <colorspace_fragment>
      }
    `
  });
}

function corona(radius, color, seed) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 6, radius * 6), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(color) }, seed: { value: seed } },
    vertexShader: `varying vec2 coord; void main() {
      coord = uv * 2. - 1.;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }`,
    fragmentShader: `
      uniform vec3 tint;
      uniform float seed;
      varying vec2 coord;
      void main() {
        float r = length(coord) * 3.;
        float theta = atan(coord.y, coord.x) + seed;
        float outside = max(0., r - 1.);
        float corona = exp(-outside * 12.) * .37;
        float streamers = pow(.5 + .5 * sin(theta * 9. + 1.4 * sin(theta * 5.)), 5.);
        corona += (.032 + .17 * streamers) * exp(-outside * 3.4);
        gl_FragColor = vec4(tint, corona * (1. - smoothstep(2.15, 3., r)));
        #include <colorspace_fragment>
      }`
  }));
  // Put the corona behind the opaque photosphere so it never washes out the texture.
  return mesh;
}

function planetMaterial(primary, secondary) {
  return new THREE.ShaderMaterial({
    uniforms: { primary: { value: primary }, secondary: { value: secondary } },
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 surface, worldNormal, worldPoint;
      uniform vec3 primary, secondary;
      ${noise}
      float impact(vec3 p, vec3 center, float radius) {
        float d = distance(p, normalize(center)) / radius;
        float rim = (d - .88) * 10.;
        return .26 * exp(-rim * rim) - .29 * (1. - smoothstep(.21, .91, d));
      }
      void main() {
        vec3 p = normalize(surface);
        vec3 n = normalize(worldNormal);
        vec3 a = normalize(primary - worldPoint), b = normalize(secondary - worldPoint);
        float warp = terrainAt(p * 3.7 + 9.);
        float basin = terrainAt(p * 4.7 + warp * 1.8);
        float ridges = terrainAt(p * 16. + vec3(0., warp * 4., 0.));
        float strata = pow(.5 + .5 * sin(dot(p, vec3(118., 176., 86.)) + 41. * ridges), 3.);
        float duneField = smoothstep(.35, .74, terrainAt(p * 18. + 17.));
        float stone = noiseAt(p * 123.) - .5;
        float craters = impact(p, vec3(-.64,.74,.18), .16)
          + impact(p, vec3(.73,.53,-.30), .12)
          + impact(p, vec3(-.17,.91,-.45), .067)
          + impact(p, vec3(.18,.94,.32), .075)
          + impact(p, vec3(-.87,.35,-.26), .085);
        vec3 rock = mix(vec3(.22,.073,.038), vec3(.59,.31,.139), smoothstep(.27,.64, basin));
        vec3 sand = mix(vec3(.62,.325,.151), vec3(.92,.68,.365), ridges);
        vec3 albedo = mix(rock, sand, smoothstep(.36,.69, basin + .17 * ridges));
        albedo *= .91 + .13 * strata * duneField + .15 * stone + craters;
        float mainLight = max(0., dot(n, a));
        float redLight = max(0., dot(n, b));
        vec3 lit = albedo * (vec3(.048,.039,.044) + mainLight * vec3(1.04,.85,.65)
          + redLight * vec3(.17,.064,.026));
        float facing = clamp((viewMatrix * vec4(n,0.)).z, 0., 1.);
        float haze = pow(1. - facing, 4.) * smoothstep(-.16, .60, dot(n,a));
        gl_FragColor = vec4(lit + haze * vec3(.37,.19,.076), 1.);
        #include <colorspace_fragment>
      }
    `
  });
}

function backgroundStars(scene) {
  const random = randomSequence(17815);
  const group = new THREE.Group();
  for (const [count, color, size] of [[470, 0x8ca0b7, 1.15], [72, 0xd6b8a1, 1.6], [30, 0xc0cee6, 1.85]]) {
    const points = Array.from({ length: count }, () => new THREE.Vector3(random() - .5, random() - .5, 0));
    group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(points), new THREE.PointsMaterial({
      color, size, sizeAttenuation: false, transparent: true, opacity: .5, depthWrite: false
    })));
  }
  scene.add(group);
  return group;
}

export function createTatooineOrbit() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070d19);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 9);
  const background = backgroundStars(scene);
  const angle = new THREE.Vector3(0, .92, .39).normalize();
  camera.position.copy(angle).multiplyScalar(2.5);
  camera.lookAt(origin);
  background.position.copy(angle).multiplyScalar(-4);
  background.quaternion.copy(camera.quaternion);
  const relative = new THREE.Vector3();
  const positions = Object.fromEntries(Object.keys(tatooineBodies).map(key => [key, new THREE.Vector3()]));
  const radii = Object.fromEntries(Object.entries(tatooineBodies).map(([key, body]) => [key, body.radiusKm / auKm]));
  const meshes = {
    primary: new THREE.Mesh(sphere, starMaterial([0xaf3c0e, 0xffa439, 0xffe7a8], 4.3)),
    secondary: new THREE.Mesh(sphere, starMaterial([0x941d14, 0xf96332, 0xffbb73], 1.5)),
    planet: new THREE.Mesh(sphere, planetMaterial(positions.primary, positions.secondary))
  };
  for (const [key, mesh] of Object.entries(meshes)) {
    mesh.scale.setScalar(radii[key]);
    scene.add(mesh);
  }
  const halos = [corona(radii.primary, 0xff9d43, 2), corona(radii.secondary, 0xff6039, 4)];
  for (const halo of halos) halo.quaternion.copy(camera.quaternion);
  scene.add(...halos);

  function path(orbit, offset, color, opacity) {
    const points = Array.from({ length: 192 }, (_, i) =>
      ellipsePosition(orbit, 2 * Math.PI * i / 192, new THREE.Vector3()).multiplyScalar(offset));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false }));
    scene.add(line);
  }

  path(binaryOrbit, binaryOffsets[0], 0xffbe71, .58);
  path(binaryOrbit, binaryOffsets[1], 0xe18c70, .52);
  path(outerOrbit, 1, 0xa1b6d3, .52);
  const starsLink = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, origin]),
    new THREE.LineBasicMaterial({ color: 0xffc39c, transparent: true, opacity: .24, depthWrite: false }));
  starsLink.frustumCulled = false;
  scene.add(starsLink);

  const bodies = [
    { name: tatooineBodies.planet.name, position: positions.planet, marker: 'planet' },
    { name: '공통 질량 중심', position: origin, marker: 'center' },
    { name: tatooineBodies.primary.name, position: positions.primary, marker: 'primary' },
    { name: tatooineBodies.secondary.name, position: positions.secondary, marker: 'secondary' }
  ];

  return {
    scene, camera, bodies,
    update(aspect, height, progress, day) {
      orbitPosition(binaryOrbit, day, relative);
      positions.primary.copy(relative).multiplyScalar(binaryOffsets[0]);
      positions.secondary.copy(relative).multiplyScalar(binaryOffsets[1]);
      orbitPosition(outerOrbit, day, positions.planet);
      for (const [key, mesh] of Object.entries(meshes)) mesh.position.copy(positions[key]);
      const endpoints = starsLink.geometry.attributes.position;
      endpoints.setXYZ(0, ...positions.primary);
      endpoints.setXYZ(1, ...positions.secondary);
      endpoints.needsUpdate = true;

      const portrait = aspect < .85;
      // Leave room below the orbit for the simulation controls.
      const chartHeight = portrait ? height : Math.max(height * .44, height - 341);
      const systemSpan = Math.max(2.05, 1.65 / aspect, 1.34 * height / chartHeight) * Math.max(1, 610 / height);
      const span = systemSpan * lerp(.88, 1, progress);
      const screenY = portrait ? .43 : (Math.min(85, height * .15) + chartHeight / 2) / height;
      camera.left = -span * aspect / 2;
      camera.right = span * aspect / 2;
      camera.top = span * screenY;
      camera.bottom = camera.top - span;
      camera.updateProjectionMatrix();

      background.scale.set(span * aspect * 1.03, span * 1.03, 1);
      for (const [index, key] of ['primary', 'secondary'].entries()) {
        halos[index].position.copy(positions[key]).addScaledVector(angle, -radii[key]);
      }
    }
  };
}
