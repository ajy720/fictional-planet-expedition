import { formatMessage, formatNumber, getLocale, t } from './copy/index.js';
const lightYearKm = 9.461e12;
const astronomicalUnitKm = 149597870.7;

function reference(id, lightYears, url) {
  return {
    lightYears,
    get name() { return t(`world.${id}.referenceName`); },
    get landmark() { return t(`world.${id}.landmark`); },
    get source() { return [t(`world.${id}.referenceSource`), url]; }
  };
}

function knownDistance({ name, lightYears }) {
  return t('distance.known', { name, lightYears });
}

function scaledDistance(lightYears) {
  const km = lightYears * (lightYearKm / astronomicalUnitKm) / 100000;
  return t('distance.compactKilometers', { km: formatNumber(km, { maximumFractionDigits: km < 10 ? 1 : 0 }) });
}

export function distanceAnalogy(reference, { compact = false } = {}) {
  if (!reference) return '';
  const { lightYears, landmark } = reference;
  const distance = scaledDistance(lightYears);
  return t(compact ? 'distance.analogyCompact' : 'distance.analogy', { distance, landmark });
}

export function earthAngularDiameter(lightYears) {
  const radians = 2 * Math.atan(6371 / (lightYears * lightYearKm));
  return Number((radians * 180 / Math.PI * 3600 * 1e6).toPrecision(2));
}

// Use the real Neptune–Triton system as the scale model for the fictional pair.
export const pandoraScale = {
  primaryDiameter: 49528,
  pandoraDiameter: Math.round(12756 * .75),
  tritonDiameter: 2700,
  centerDistance: 354760,
  earthMoonDistance: 384400
};

function defineWorld(id, { color, workKey, reference, distanceKey, sections, scienceUrl, sourceUrl }) {
  const message = field => t(`world.${id}.${field}`);
  return {
    color, reference,
    get name() { return message('name'); },
    get work() { return t(workKey); },
    get distance() { return reference ? knownDistance(reference) : t(distanceKey); },
    get observation() { return id === 'b612' ? undefined : message('observation'); },
    get result() { return message('result'); },
    recordContext: sections.map(section => ({
      get heading() { return message(section + '.heading'); },
      get text() { return message(section + '.text'); }
    })),
    get question() { return message('question'); },
    get comparison() { return message('comparison'); },
    get science() { return [message('science'), scienceUrl]; },
    get source() { return [message('source'), sourceUrl]; }
  };
}

export const destinations = {
  b612: defineWorld('b612', {
    color: 0xa98a72, workKey: 'work.littlePrince',
    distanceKey: 'distance.unknown',
    sections: ['dailyCare'],
    scienceUrl: 'https://science.nasa.gov/solar-system/asteroids/101955-bennu/facts/',
    sourceUrl: 'https://lepetitprince.eu/numerique/le-petit-prince/'
  }),
  pandora: defineWorld('pandora', {
    color: 0x62bdae, workKey: 'work.avatar',
    reference: reference('pandora', 4.37, 'https://apod.nasa.gov/rjn/apod/ap190413.html'),
    sections: ['bioluminescence', 'polyphemus'],
    scienceUrl: 'https://origin.oceanexplorer.noaa.gov/ocean-fact/living-light/',
    sourceUrl: 'https://www.avatar.com/pandorapedia/pandora'
  }),
  adrian: defineWorld('adrian', {
    color: 0xc1ac7b, workKey: 'work.hailMary',
    reference: reference('adrian', 11.9, 'https://science.nasa.gov/exoplanets/target-star-catalog/'),
    sections: ['petrova', 'sample'],
    scienceUrl: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/infrared-astronomy/',
    sourceUrl: 'https://science.nasa.gov/the-science-behind-project-hail-mary/'
  }),
  erid: defineWorld('erid', {
    color: 0x96746b, workKey: 'work.hailMary',
    reference: reference('erid', 16, 'https://science.nasa.gov/universe/exoplanets/discovery-alert-spocks-home-planet-goes-poof/'),
    sections: ['echolocation', 'language'],
    scienceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6797687/',
    sourceUrl: 'https://science.nasa.gov/the-science-behind-project-hail-mary/'
  }),
  arrakis: defineWorld('arrakis', {
    color: 0xd9a566, workKey: 'work.dune',
    reference: reference('arrakis', 300, 'https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?frame=28068&mission=ISS006&roll=E'),
    sections: ['desert', 'stillsuit'],
    scienceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8727397/',
    sourceUrl: 'https://tip.dhappy.org/old/text/Frank%20Herbert%20-%20Dune.html'
  }),
  miller: defineWorld('miller', {
    color: 0x8faeb8, workKey: 'work.interstellar',
    distanceKey: 'distance.wormhole',
    sections: ['timeDilation', 'waves'],
    scienceUrl: 'https://www.nist.gov/news-events/news/2022/02/jila-atomic-clocks-measure-einsteins-general-relativity-millimeter-scale',
    sourceUrl: 'https://www.its.caltech.edu/~kip/index.html/PubScans/VI-59.pdf'
  }),
  tatooine: defineWorld('tatooine', {
    color: 0xdfae78, workKey: 'work.starWars',
    distanceKey: 'distance.unknown',
    sections: ['binarySunset', 'shadows'],
    scienceUrl: 'https://science.nasa.gov/exoplanets/other-stars-other-worlds/kepler-16-b-almost-a-real-life-tatooine/',
    sourceUrl: 'https://www.starwars.com/databank/Tatooine'
  })
};

export const destinationIds = Object.keys(destinations);

export const routeLayout = {
  earth: [-27, -2.7, -1],
  b612: [-20, 1.9, 2],
  pandora: [-12.7, 4.7, -4],
  adrian: [-5.8, 1.1, -8.3],
  erid: [1.6, -4.4, -3.4],
  arrakis: [8.9, -1.6, 3.3],
  miller: [15.6, 4.2, -7.6],
  tatooine: [23.1, .65, -.4]
};

function mapDistance(from, to) {
  return Math.hypot(...routeLayout[from].map((coordinate, i) => coordinate - routeLayout[to][i]));
}

const routeDistances = destinationIds.flatMap(from =>
  destinationIds.filter(to => from !== to).map(to => mapDistance(from, to)));
const minRoute = Math.min(...routeDistances);
const maxRoute = Math.max(...routeDistances);

const profiles = Object.fromEntries(destinationIds.map(from => [from, Object.fromEntries(
  destinationIds.filter(to => from !== to).map(to => {
    const distance = (mapDistance(from, to) - minRoute) / (maxRoute - minRoute);
    return [to, {
      duration: 1000 * Math.round(10 + 16 * distance ** .78),
      scale: 23 + 31 * distance,
      coast: 2.15 + .55 * distance
    }];
  })
)]));

export const routeFlight = (from, to) => profiles[from][to];
export const flightDuration = (from, to) => from ? routeFlight(from, to).duration : 8000;
export const arrivalNodes = [0, .25, .7, 1];
export const petrovaCheckpoint = from => Math.round(flightDuration(from, 'adrian') * .7);
const echoKeys = ['erid.rock', 'erid.arch', 'erid.pillar'];
export const echoName = index => t(echoKeys[index]);
export const desertRoutes = {
  sun: {
    get name() { return t('arrakis.sun.name'); }, duration: 6000, lookout: 2900, loss: 40, recovery: 14,
    get forecast() { return t('arrakis.sun.forecast'); },
    get prompt() { return t('arrakis.sun.prompt'); },
    get tool() { return t('arrakis.sun.tool'); }, get title() { return t('arrakis.sun.title'); },
    get description() { return t('arrakis.sun.description'); }
  },
  shade: {
    get name() { return t('arrakis.shade.name'); }, duration: 10000, lookout: 5100, loss: 20, recovery: 10,
    get forecast() { return t('arrakis.shade.forecast'); },
    get prompt() { return t('arrakis.shade.prompt'); },
    get tool() { return t('arrakis.shade.tool'); }, get title() { return t('arrakis.shade.title'); },
    get description() { return t('arrakis.shade.description'); }
  }
};

export function millerTimes(elapsed, locale = getLocale()) {
  const seconds = Math.floor(elapsed / 1000);
  const hoursOnEarth = Math.floor(seconds * 7 * 365.25 * 24 / 3600);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const pad = value => String(value).padStart(2, '0');
  return {
    local: [...(hours ? [hours] : []), minutes, seconds % 60].map(pad).join(':'),
    earth: formatMessage(locale, 'miller.earthTime', { days: Math.floor(hoursOnEarth / 24), hours: hoursOnEarth % 24 })
  };
}
