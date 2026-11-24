import { t } from './copy/index.js';
export const introSections = [
  {
    at: 0, get title() { return t('intro.earthOrbit'); },
    get label() { return t('intro.scaleLabel'); }, get value() { return t('intro.scaleValue'); }, get note() { return t('intro.earthSunDistance'); }
  },
  {
    at: .23, get title() { return t('intro.moonApproach'); },
    get label() { return t('intro.earthMoonDistance'); }, get value() { return t('intro.moonDistanceValue'); }, get note() { return t('intro.moonLightTime'); }
  },
  {
    at: .72, get title() { return t('common.solarSystem'); },
    get label() { return t('intro.solarUnit'); }, get value() { return t('intro.auValue'); }, get note() { return t('intro.solarScaleNote'); }
  }
];

export const lastIntroSection = introSections.length - 1;

export function introSectionAt(progress) {
  return introSections.findLastIndex(section => progress >= section.at);
}
