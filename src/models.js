import * as THREE from 'three';

export function randomSequence(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeB612() {
  const group = new THREE.Group();
  const geometry = new THREE.IcosahedronGeometry(1, 6);
  const positions = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  const crater = new THREE.Vector3(.48, .45, .75).normalize();
  const basin = new THREE.Vector3(-.2, -.33, .92).normalize();
  const colors = [];
  const palette = [0x5e5f68, 0x6c6a72, 0x747078, 0x807c80, 0x898389].map(value => new THREE.Color(value));
  for (let i = 0; i < positions.count; i += 3) {
    const center = new THREE.Vector3();
    for (let j = 0; j < 3; j++) center.add(point.fromBufferAttribute(positions, i + j));
    center.normalize();
    const value = Math.sin(center.x * 29 + center.z * 61) * Math.cos(center.y * 46);
    const tint = palette[Math.min(4, Math.floor((value + 1) * 2.49))];
    for (let j = 0; j < 3; j++) {
      point.fromBufferAttribute(positions, i + j).normalize();
      const { x, y, z } = point;
      const ridge = Math.sin(x * 9 + z * 3) * Math.cos(z * 7 - y * 6);
      const small = Math.sin(y * 15 + x * 8) * Math.sin(z * 16);
      const depression = .14 * Math.exp(-15 * point.distanceToSquared(crater))
        + .1 * Math.exp(-22 * point.distanceToSquared(basin));
      const radius = 1 + .1 * ridge + .024 * small - depression;
      positions.setXYZ(i + j, x * radius, y * radius * .82, z * radius * .94);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: .95
  }));
  group.add(terrain);

  const normal = new THREE.Vector3(-.69, .53, -.49).normalize();
  const ray = new THREE.Raycaster(normal.clone().multiplyScalar(2), normal.clone().negate());
  terrain.updateMatrixWorld();
  const surface = ray.intersectObject(terrain)[0].point;
  const garden = new THREE.Group();
  garden.position.copy(surface).addScaledVector(normal, -.002);
  garden.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  group.add(garden);

  const material = (color, roughness = .75) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness });
  const leaf = material(0x4e7953);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.008, .011, .22, 7), material(0x537b46));
  stem.position.y = .117;
  stem.rotation.z = -.08;
  garden.add(stem);
  for (const side of [-1, 1]) {
    const frond = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leaf);
    frond.position.set(side * .044, side === 1 ? .13 : .088, 0);
    frond.scale.set(.064, .014, .028);
    frond.rotation.z = side * .47;
    garden.add(frond);
  }
  const bloom = new THREE.Group();
  bloom.position.set(.01, .238, 0);
  garden.add(bloom);
  const petals = [0xa52340, 0xc73552, 0xe3596c, 0x8d1e39].map(color => material(color, .65));
  for (let layer = 0; layer < 3; layer++) {
    const count = 6 - layer;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + layer * .49;
      const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), petals[(i + layer) % petals.length]);
      const radius = .055 - layer * .015;
      petal.position.set(Math.sin(angle) * radius, layer * .013, Math.cos(angle) * radius);
      petal.scale.set(.042 - layer * .006, .035 - layer * .004, .025);
      petal.rotation.set(.46 - layer * .14, angle, 0, 'YXZ');
      bloom.add(petal);
    }
  }

  const cover = new THREE.Group();
  cover.visible = false;
  garden.add(cover);
  const profile = [
    [.142, .01], [.143, .07], [.143, .22], [.135, .285], [.113, .331],
    [.076, .36], [.041, .375], [0, .38]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { edge: { value: new THREE.Color(0x9dd8ed) } },
    vertexShader: `
      varying vec3 normalView;
      varying vec3 towardCamera;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        normalView = normalize(normalMatrix * normal);
        towardCamera = normalize(-p.xyz);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec3 edge;
      varying vec3 normalView;
      varying vec3 towardCamera;
      void main() {
        float rim = pow(1.0 - clamp(dot(normalize(normalView), normalize(towardCamera)), 0.0, 1.0), 2.1);
        float reflection = pow(max(dot(normalize(normalView), normalize(vec3(-.65,.6,.65))),0.0),20.0);
        gl_FragColor = vec4(edge + reflection * .23, .025 + .63 * rim + .18 * reflection);
        #include <colorspace_fragment>
      }`
  }));
  glass.renderOrder = 2;
  cover.add(glass);
  const base = new THREE.Mesh(new THREE.TorusGeometry(.142, .009, 7, 32), material(0xc2a27b, .45));
  base.rotation.x = Math.PI / 2;
  base.position.y = .012;
  cover.add(base);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(.021, 1), material(0xb4d5e1, .3));
  knob.position.y = .393;
  cover.add(knob);

  const sproutNormal = new THREE.Vector3(.48, -.19, .85).normalize();
  ray.set(sproutNormal.clone().multiplyScalar(2), sproutNormal.clone().negate());
  const sproutBed = new THREE.Group();
  sproutBed.position.copy(ray.intersectObject(terrain)[0].point);
  sproutBed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sproutNormal);
  group.add(sproutBed);
  const soil = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material(0x57483f));
  soil.scale.set(.075, .02, .063);
  sproutBed.add(soil);
  const sprout = new THREE.Group();
  sproutBed.add(sprout);
  const shoot = new THREE.Mesh(new THREE.CylinderGeometry(.013, .021, .18, 7), material(0x648c4b));
  shoot.position.y = .09;
  sprout.add(shoot);
  for (const side of [-1, 1]) {
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material(side === 1 ? 0xa3be72 : 0x789e56));
    bud.position.set(side * .048, .15, 0);
    bud.scale.set(.058, .024, .036);
    bud.rotation.z = side * .34;
    sprout.add(bud);
  }
  const sproutTip = new THREE.Object3D();
  sproutTip.position.y = .16;
  sprout.add(sproutTip);

  return { group, terrain, garden, bloom, cover, normal, surface, sproutBed, sprout, sproutTip };
}

export function atmosphere(radius) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 normalView;
      varying vec3 towardCamera;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        normalView = normalize(normalMatrix * normal);
        towardCamera = normalize(-p.xyz);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      varying vec3 normalView;
      varying vec3 towardCamera;
      void main() {
        float glow = pow(1.0 - max(dot(normalize(normalView),normalize(towardCamera)),0.0),4.3);
        gl_FragColor = vec4(.19,.51,.98,.57*glow);
      }`
  }));
}

export function glow(color) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 96;
  const context = surface.getContext('2d');
  const tint = new THREE.Color(color).getHexString();
  const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.12, '#' + tint);
  gradient.addColorStop(.27, '#' + tint + '72');
  gradient.addColorStop(1, '#' + tint + '00');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const map = new THREE.CanvasTexture(surface);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}
