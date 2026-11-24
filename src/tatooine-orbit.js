import { MathUtils, Vector3 } from 'three';

// Kepler-16 orbital elements and stellar radii: Doyle et al. (2011), Table 1.
export const auKm = 149_597_870.7;
export const binaryOrbit = { axis: .22431, eccentricity: .15944, period: 41.07922, phase: .18 };
export const outerOrbit = { axis: .7048, eccentricity: .00685, period: 228.776, phase: -.61 };
export const orbitRates = [1, 5, 10];
export const defaultOrbitRate = 5;
export const tatooineBodies = {
  primary: { name: '첫 번째 해', radiusKm: .6489 * 695_700, mass: .6897 },
  secondary: { name: '두 번째 해', radiusKm: .22623 * 695_700, mass: .20255 },
  planet: { name: '타투인', radiusKm: 6_371 }
};

const totalMass = tatooineBodies.primary.mass + tatooineBodies.secondary.mass;
export const binaryOffsets = [-tatooineBodies.secondary.mass / totalMass, tatooineBodies.primary.mass / totalMass];

export function ellipsePosition(orbit, eccentricAnomaly, target) {
  const { axis, eccentricity: e } = orbit;
  return target.set(axis * (Math.cos(eccentricAnomaly) - e), 0,
    axis * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly));
}

export function orbitPosition(orbit, days, target) {
  // Solve M = E - e sin(E) so the motion speeds up near periapsis.
  const mean = orbit.phase + (days / orbit.period) * 2 * Math.PI;
  let eccentric = mean;
  for (let step = 0; step < 5; step++) {
    eccentric -= (eccentric - orbit.eccentricity * Math.sin(eccentric) - mean)
      / (1 - orbit.eccentricity * Math.cos(eccentric));
  }
  return ellipsePosition(orbit, eccentric, target);
}

const { degToRad, radToDeg } = MathUtils;
const afternoonStart = degToRad(51);
const afternoonSweep = degToRad(63);
const latitude = degToRad(32);
const cameraHeading = degToRad(15);

export function groundSkyAt(days, skyTime) {
  const binary = orbitPosition(binaryOrbit, days, new Vector3());
  const planet = orbitPosition(outerOrbit, days, new Vector3());
  const toCenter = planet.clone().negate().normalize();
  const centerHourAngle = afternoonStart + afternoonSweep * skyTime / 100;
  const suns = binaryOffsets.map(offset => {
    const ray = binary.clone().multiplyScalar(offset).sub(planet);
    const angularOffset = Math.atan2(toCenter.x * ray.z - toCenter.z * ray.x, toCenter.dot(ray));
    const hourAngle = centerHourAngle + angularOffset;
    // Project a coplanar star onto the observer's east, north and up axes.
    const east = -Math.sin(hourAngle);
    const north = -Math.sin(latitude) * Math.cos(hourAngle);
    const up = Math.cos(latitude) * Math.cos(hourAngle);
    const sunset = 100 * (Math.PI / 2 - afternoonStart - angularOffset) / afternoonSweep;
    return {
      direction: [
        north * Math.cos(cameraHeading) - east * Math.sin(cameraHeading),
        up,
        north * Math.sin(cameraHeading) + east * Math.cos(cameraHeading)
      ],
      altitude: Math.asin(up),
      distance: ray.length(),
      above: skyTime < sunset,
      sunset,
      angularOffset
    };
  });
  return {
    suns,
    visibleCount: Number(suns[0].above) + Number(suns[1].above),
    separation: radToDeg(Math.abs(suns[0].angularOffset - suns[1].angularOffset)),
    betweenSunsets: Math.abs(suns[0].sunset - suns[1].sunset) < .01
      ? null : (suns[0].sunset + suns[1].sunset) / 2
  };
}
