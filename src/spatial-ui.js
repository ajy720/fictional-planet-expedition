export function positionCallout(element, point, { vertical = false, radius = 0 } = {}) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const attached = Boolean(point && width >= 680 && height >= 520 &&
    point.x > 12 && point.x < width - 12 && point.y > 105 && point.y < height - 94);
  element.classList.toggle('projected', attached);
  if (!attached) return;

  const edge = 24;
  const w = element.offsetWidth;
  const h = element.offsetHeight;
  if (!w || !h) {
    element.classList.remove('projected');
    return;
  }
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let left, top, x, y;
  if (vertical) {
    const above = point.y > height * .51 && point.y - radius - h - 30 >= 145;
    left = clamp(point.x - w * .38, edge, width - w - edge);
    top = above ? point.y - radius - h - 30 : point.y + radius + 29;
    if (top + h > height - 42) {
      element.classList.remove('projected');
      return;
    }
    x = clamp(point.x, left + 8, left + w - 8);
    y = above ? top + h + 5 : top - 7;
  } else {
    const gap = radius + 34;
    const right = point.x + gap + w < width - edge || point.x < width / 2;
    left = clamp(right ? point.x + gap : point.x - w - gap, edge, width - w - edge);
    top = clamp(point.y - h * .55 - 24, 102, height - h - 124);
    x = right ? left - 7 : left + w + 7;
    y = top + h / 2;
  }
  const angle = Math.atan2(y - point.y, x - point.x);
  const startX = point.x + Math.cos(angle) * (radius + 3);
  const startY = point.y + Math.sin(angle) * (radius + 3);
  element.style.setProperty('--callout-left', left + 'px');
  element.style.setProperty('--callout-top', top + 'px');
  element.style.setProperty('--leader-start-x', startX - left + 'px');
  element.style.setProperty('--leader-start-y', startY - top + 'px');
  element.style.setProperty('--leader-length', Math.max(0, Math.hypot(x - startX, y - startY)) + 'px');
  element.style.setProperty('--leader-angle', angle + 'rad');
}
