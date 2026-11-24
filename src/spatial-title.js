import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

function titleArtwork(text) {
  const image = document.createElement('canvas');
  image.width = 1024;
  image.height = 320;
  const context = image.getContext('2d');
  context.font = '500 218px "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.fillStyle = '#f6eee5';
  context.shadowColor = '#080914cb';
  context.shadowBlur = 36;
  context.fillText(text, 40, 163, 944);
  context.shadowColor = '#c9a99594';
  context.shadowBlur = 16;
  context.fillText(text, 40, 163, 944);
  const aspect = Math.min(984, context.measureText(text).width + 70) / image.height;
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.x = aspect * image.height / image.width;
  return { geometry: new PlaneGeometry(aspect, 1), texture };
}

export function createSpatialTitle(text) {
  const { geometry, texture } = titleArtwork(text);
  const title = new Mesh(geometry, new MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false, fog: false
  }));
  title.userData.text = text;
  title.visible = false;
  return title;
}

export function updateSpatialTitle(title, text) {
  if (title.userData.text === text) return;
  const { geometry, texture } = titleArtwork(text);
  title.geometry.dispose();
  title.material.map.dispose();
  title.geometry = geometry;
  title.material.map = texture;
  title.userData.text = text;
}

export function placeSpatialTitle(title, camera, distance, x, y, scale) {
  const height = Math.tan(camera.fov * Math.PI / 360) * distance;
  title.position.copy(new Vector3(x * height * camera.aspect, y * height, -distance)
    .applyQuaternion(camera.quaternion).add(camera.position));
  title.quaternion.copy(camera.quaternion);
  title.rotateY(-.19);
  title.scale.setScalar(height * scale);
}

export function projectAnchor(position, camera, canvas) {
  const point = position.clone().project(camera);
  if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return null;
  return { x: (point.x + 1) * canvas.clientWidth / 2, y: (1 - point.y) * canvas.clientHeight / 2 };
}
