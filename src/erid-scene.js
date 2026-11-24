import * as THREE from 'three';
import { echoName } from './destinations.js';
import { echoDuration, echoInProgress, echoSpeed, echoTargets, emitterPosition } from './erid-sonar.js';
import { glow } from './models.js';

const { clamp, lerp, radToDeg, smoothstep } = THREE.MathUtils;
const emitter = new THREE.Vector3(...emitterPosition);
const wavePlane = new THREE.PlaneGeometry(36, 36);
const planarVertex = `
  varying vec2 point;
  void main() {
    point = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function makeFloor(scene) {
  const material = new THREE.ShaderMaterial({
    vertexShader: planarVertex,
    fragmentShader: `
      varying vec2 point;
      void main() {
        float distanceFromStation = length(point);
        vec2 tile = point * .5;
        vec2 edge = abs(fract(tile - .5) - .5) / max(fwidth(tile), vec2(.001));
        float grid = 1.0 - smoothstep(.12, 1.05, min(edge.x, edge.y));
        float sediment = .5 + .5 * sin(point.x * .42 + sin(point.y * .35)) * cos(point.y * .64);
        float horizon = exp(-distanceFromStation * .049);
        vec3 color = vec3(.001, .002, .005);
        color += vec3(.003, .012, .017) * horizon * (.52 + .48 * sediment);
        color += vec3(.006, .018, .024) * grid * horizon;
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }
    `
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = emitter.z;
  scene.add(floor);
}

function makeWavefront(scene, origin, direction, color, outgoing = false) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      tint: { value: new THREE.Color(color) }, radius: { value: 0 }, strength: { value: 0 },
      direction: { value: direction }, aperture: { value: outgoing ? .13 : .77 }
    },
    vertexShader: planarVertex,
    fragmentShader: `
      varying vec2 point;
      uniform vec3 tint;
      uniform vec2 direction;
      uniform float aperture, radius, strength;
      float band(float offset, float width) {
        float normalized = offset / max(width, fwidth(offset) * .66);
        return exp(-normalized * normalized);
      }
      void main() {
        float r = length(point);
        float angle = dot(point / max(r, .001), direction);
        float sector = smoothstep(aperture, min(.995, aperture + .28), angle);
        float d = r - radius;
        float core = band(d, .044);
        float wash = band(d, .21) * .34 + band(d, .48) * .10;
        float trail = band(d + .32, .052) * .40 + band(d + .63, .070) * .17;
        float launch = smoothstep(.035, .43, r);
        gl_FragColor = vec4(mix(tint, vec3(.92, .98, 1.), core * .62),
          (core + wash + trail) * sector * launch * strength);
        #include <colorspace_fragment>
      }
    `
  });
  const wave = new THREE.Mesh(wavePlane, material);
  wave.position.copy(origin);
  wave.rotation.x = -Math.PI / 2;
  scene.add(wave);
  return (radius, opacity, aperture) => {
    wave.visible = opacity > 0;
    material.uniforms.radius.value = radius;
    material.uniforms.strength.value = opacity;
    if (aperture !== undefined) material.uniforms.aperture.value = aperture;
  };
}

function makeStation(scene) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(.55, .72, .20, 12),
    new THREE.MeshBasicMaterial({ color: 0x12272f })
  );
  body.position.set(emitter.x, .1, emitter.z);
  scene.add(body);
  const rims = [[.56, .037, .202], [.37, .021, .229], [.18, .019, .248]];
  for (const [radius, width, height] of rims) {
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius, 64),
      new THREE.MeshBasicMaterial({ color: radius === .56 ? 0x468184 : 0x83e9dc, side: THREE.DoubleSide }));
    rim.position.set(emitter.x, height, emitter.z);
    rim.rotation.x = -Math.PI / 2;
    scene.add(rim);
  }
  const beacon = glow(0x8feedd);
  beacon.position.copy(emitter);
  scene.add(beacon);
  return strength => {
    beacon.material.opacity = .38 + .62 * strength;
    beacon.scale.setScalar(.80 + 1.45 * strength);
  };
}

function archParts() {
  const arch = new THREE.Shape();
  arch.moveTo(-1.76, 0);
  arch.lineTo(-1.76, 1.3);
  arch.absarc(0, 1.3, 1.76, Math.PI, 0, true);
  arch.lineTo(1.76, 0);
  arch.lineTo(1.10, 0);
  arch.lineTo(1.10, 1.3);
  arch.absarc(0, 1.3, 1.10, 0, Math.PI, false);
  arch.lineTo(-1.10, 0);
  arch.closePath();
  return [
    { geometry: new THREE.ExtrudeGeometry(arch, { depth: .64, curveSegments: 7, bevelEnabled: true,
      bevelSegments: 1, bevelThickness: .10, bevelSize: .08 }), at: [0, 0, -.32] },
    { geometry: new THREE.BoxGeometry(.91, .27, .94), at: [-1.43, .135, 0] },
    { geometry: new THREE.BoxGeometry(.91, .27, .94), at: [1.43, .135, 0] }
  ];
}

function makeStructures() {
  const rock = new THREE.IcosahedronGeometry(1, 1);
  const positions = rock.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const facet = 1 + .15 * Math.sin(9 * x + 7 * y + 4 * z);
    positions.setXYZ(i, 1.39 * x * facet + .24 * y, Math.max(-.63, .96 * y * facet), .92 * z * facet);
  }
  rock.computeVertexNormals();
  return [
    { center: [0, 0, -.9], parts: [{ geometry: rock, at: [0, .65, 0] }] },
    { center: [1.43, 0, -.4], parts: archParts() },
    { center: [0, 0, -.65], parts: [
      { geometry: new THREE.CylinderGeometry(.58, .87, .32, 6), at: [0, .16, 0] },
      { geometry: new THREE.CylinderGeometry(.43, .61, 2.89, 6), at: [0, 1.76, 0] },
      { geometry: new THREE.CylinderGeometry(.53, .46, .18, 6), at: [0, 3.27, 0] },
      { geometry: new THREE.CylinderGeometry(.32, .52, .42, 6), at: [0, 3.57, 0] }
    ] }
  ];
}

function makeReflector(scene, shape, target) {
  const impact = new THREE.Vector3(...target.impact);
  const tint = new THREE.Color(target.color);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { tint: { value: tint }, impact: { value: impact }, strength: { value: 0 }, sweep: { value: 0 } },
    vertexShader: `
      varying vec3 worldPoint, worldNormal;
      void main() {
        worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
        worldNormal = mat3(modelMatrix) * normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.);
      }
    `,
    fragmentShader: `
      varying vec3 worldPoint, worldNormal;
      uniform vec3 tint, impact;
      uniform float strength, sweep;
      void main() {
        float lighting = .24 + .76 * max(0., dot(normalize(worldNormal), normalize(vec3(-.4, .65, .55))));
        float distanceFromHit = distance(worldPoint, impact);
        float revealed = 1. - smoothstep(sweep, sweep + .65, distanceFromHit);
        float offset = (distanceFromHit - sweep) * 4.4;
        float crest = exp(-offset * offset);
        float strata = .86 + .14 * cos(worldPoint.y * 26. + worldPoint.x * 1.3);
        gl_FragColor = vec4(tint * (lighting * .18 * strata + crest * .41),
          strength * (.70 * revealed + .30 * crest));
        #include <colorspace_fragment>
      }
    `
  });
  const outline = new THREE.LineBasicMaterial({ color: tint, transparent: true, depthWrite: false });
  const group = new THREE.Group();
  const meshes = shape.parts.map(({ geometry, at }) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 16), outline);
    edges.renderOrder = 1;
    mesh.add(edges);
    group.add(mesh);
    return mesh;
  });
  group.position.set(impact.x + shape.center[0], 0, impact.z + shape.center[2]);
  group.updateMatrixWorld(true);
  const toward = impact.clone().sub(emitter).normalize();
  const hit = new THREE.Raycaster(emitter, toward).intersectObjects(meshes, false)[0];
  // Put the configured impact point on the actual front face, even if the mesh changes.
  if (hit) group.position.add(impact.clone().sub(hit.point));
  scene.add(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const label = bounds.getCenter(new THREE.Vector3());
  label.y = bounds.max.y + .47;

  const flash = glow(target.color);
  flash.position.copy(impact).addScaledVector(toward, -.055);
  flash.renderOrder = 2;
  scene.add(flash);
  const setReturn = makeWavefront(scene, impact, new THREE.Vector2(-toward.x, toward.z), target.color);
  return { label, update(elapsed, scanning, reduced, record) {
    const afterHit = elapsed - target.hitAt;
    const afterReturn = elapsed - target.returnAt;
    const life = Math.min(target.returnAt - target.hitAt + 820, echoDuration - target.hitAt);
    const strength = record ? .72 : scanning && afterHit >= 0
      ? 1 - smoothstep(afterHit, life * .49, life) : 0;
    group.visible = strength > 0;
    material.uniforms.strength.value = strength;
    material.uniforms.sweep.value = record || reduced ? 12 : Math.max(0, afterHit) * .012;
    outline.opacity = strength * (record || reduced ? .56 : .72 * smoothstep(afterHit, 40, 245));
    flash.visible = scanning && !reduced && afterHit >= 0 && afterHit < 390;
    flash.material.opacity = 1 - smoothstep(afterHit, 55, 390);
    flash.scale.setScalar(lerp(.85, 2.05, smoothstep(afterHit, 0, 390)));

    const leg = clamp(afterHit / target.hitAt, 0, 1);
    const returning = scanning && !reduced && afterHit >= 0 && afterReturn < 120;
    const fade = (1 - smoothstep(afterReturn, 0, 120)) * (.96 - .22 * leg);
    setReturn(target.distance * leg, returning ? fade : 0, lerp(.87, .50, leg));
    return strength;
  } };
}

export function createEridScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030811);
  makeFloor(scene);
  const setStation = makeStation(scene);
  const setOutgoing = makeWavefront(scene, emitter, new THREE.Vector2(0, 1), 0x70ebda, true);
  const reflectors = makeStructures().map((shape, index) => makeReflector(scene, shape, echoTargets[index]));
  const caller = glow(0x91c6ff);
  caller.position.set(.6, 4.45, -14.2);
  caller.scale.setScalar(1.8);
  scene.add(caller);
  let captions = [];

  return { scene,
    anchors: data => data.phase === 'reply' ? [['emitter', emitter], ['reply', caller.position]] : [['emitter', emitter]],
    echoes: () => captions,
    update(camera, data, reduced) {
      const narrow = clamp((1.22 - camera.aspect) / .7, 0, 1);
      camera.position.set(0, 4.9 + narrow, 5.7 + narrow * 3.5);
      camera.lookAt(0, 1.06, -10.85);
      const minimumHorizontalView = radToDeg(2 * Math.atan(.27 / camera.aspect));
      camera.fov = Math.max(46 + narrow * 10, minimumHorizontalView);
      camera.updateProjectionMatrix();

      const elapsed = data.echoElapsed ?? 0;
      const scanning = data.observing && echoInProgress(data);
      const outgoingEnd = echoTargets.at(-1).hitAt;
      const radius = elapsed * echoSpeed;
      setOutgoing(radius, scanning && !reduced ? 1 - smoothstep(elapsed, outgoingEnd + 40, outgoingEnd + 250) : 0);
      const reception = Math.max(...echoTargets.map(({ returnAt }) => elapsed < returnAt ? 0
        : 1 - smoothstep(elapsed - returnAt, 40, 350)));
      setStation(scanning && !reduced ? Math.max(reception, 1 - smoothstep(elapsed, 38, 330)) : 0);
      caller.visible = data.phase === 'reply' || data.phase === 'contact';
      caller.material.opacity = data.phase === 'contact' ? .68 : .40 + data.reply.length * .08;

      captions = reflectors.flatMap((reflector, index) => {
        const strength = reflector.update(elapsed, scanning, reduced, !data.observing && data.complete);
        return scanning && strength > .08
          ? [{ index, name: echoName(index), position: reflector.label, opacity: Math.min(1, strength * 1.4) }] : [];
      });
    }
  };
}
