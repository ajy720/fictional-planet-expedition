import ko from './ko/index.js';

export const defaultLocale = 'ko';
const catalogs = new Map([[defaultLocale, ko]]);
const listeners = new Set();
const numberFormats = new Map();
let locale = defaultLocale;

export const getLocale = () => locale;

export function registerLocale(language, messages) {
  if (language !== defaultLocale) catalogs.set(language, messages);
}

export function setLocale(language) {
  if (!catalogs.has(language) || language === locale) return false;
  locale = language;
  for (const listener of listeners) listener();
  return true;
}

export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatMessage(language, key, params = {}) {
  const messages = catalogs.get(language);
  const template = messages && Object.hasOwn(messages, key) ? messages[key]
    : Object.hasOwn(ko, key) ? ko[key] : undefined;
  if (typeof template !== 'string') throw new Error(`Unknown message: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

export const t = (key, params) => formatMessage(locale, key, params);

export function formatNumber(value, options, language = locale) {
  const key = JSON.stringify([language, options]);
  if (!numberFormats.has(key)) numberFormats.set(key, new Intl.NumberFormat(language, options));
  return numberFormats.get(key).format(value);
}

export function formatFixed(value, digits) {
  return formatNumber(Number(value.toFixed(digits)), {
    useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits
  });
}

export const joinLabels = labels => labels.join(t('common.listSeparator'));

export function localizeDom(root) {
  for (const element of root.querySelectorAll('[data-copy]')) {
    const lines = t(element.dataset.copy).split('\n');
    element.replaceChildren(...lines.flatMap((line, index) =>
      index ? [element.ownerDocument.createElement('br'), line] : [line]));
  }
  for (const attribute of ['alt', 'aria-label', 'content']) {
    for (const element of root.querySelectorAll(`[data-copy-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-copy-${attribute}`)));
    }
  }
}
