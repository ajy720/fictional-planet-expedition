export const emitterPosition = [0, .68, -2.55];
export const echoSpeed = .008;
export const echoTargets = [
  { impact: [-3.15, .68, -8.15], color: 0x78edcd },
  { impact: [-1.25, .68, -12.5], color: 0x9abaff },
  { impact: [4.25, .68, -16.55], color: 0xffc686 }
].map(target => {
  const distance = Math.hypot(...target.impact.map((coordinate, axis) => coordinate - emitterPosition[axis]));
  const hitAt = distance / echoSpeed;
  return { ...target, distance, hitAt, returnAt: 2 * hitAt };
});

export const echoDuration = Math.ceil(echoTargets.at(-1).returnAt + 510);
export const echoInProgress = data => data.echoElapsed != null && data.echoElapsed < echoDuration;
export const echoCount = data => echoTargets.filter(target => data.echoElapsed >= target.returnAt).length;
