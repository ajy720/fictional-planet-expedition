export function positionCallout(element, point, { vertical = false, radius = 0, avoid = [] } = {}) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const hasObstacles = avoid.length > 0;
  const attached = Boolean(point && width >= 680 && height >= (hasObstacles ? 440 : 520) &&
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
    const upper = point.y - radius - h - 30;
    const lower = point.y + radius + 29;
    const above = point.y > height * .51 && upper >= 145;
    const minimumTop = hasObstacles ? 66 : 106;
    const verticalPlacement = (anchorLeft, onTop) => {
      const left = clamp(anchorLeft, edge, width - w - edge);
      const top = onTop ? upper : lower;
      return { left, top, x: clamp(point.x, left + 8, left + w - 8), y: onTop ? top + h + 5 : top - 7 };
    };
    const center = point.x - w * .38;
    const candidates = [verticalPlacement(center, above)];
    if (hasObstacles) {
      if (upper >= minimumTop) candidates.push(verticalPlacement(center, !above));
      const gap = radius + 29;
      const towardRight = point.x < width / 2;
      for (const fraction of [.5, .82, .18]) {
        const top = clamp(point.y - h * fraction, minimumTop, height - h - 42);
        for (const right of [towardRight, !towardRight]) {
          const left = right ? point.x + gap : point.x - gap - w;
          candidates.push({ left, top, x: right ? left - 7 : left + w + 7,
            y: clamp(point.y, top + 8, top + h - 8) });
        }
      }
      for (const shifted of [point.x - w + 8, point.x - 8]) {
        candidates.push(verticalPlacement(shifted, false));
        if (upper >= minimumTop) candidates.push(verticalPlacement(shifted, true));
      }
    }
    const fit = candidates.find(({ left, top }) => left >= edge && left + w <= width - edge && top >= minimumTop &&
      top + h <= height - 42 && !avoid.some(rect =>
        left < rect.left + rect.width && left + w > rect.left &&
        top < rect.top + rect.height && top + h > rect.top
      ));
    if (!fit) {
      element.classList.remove('projected');
      return;
    }
    ({ left, top, x, y } = fit);
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
  const onRight = left + w / 2 >= point.x;
  element.style.setProperty('--callout-yaw', onRight ? '7deg' : '-7deg');
  element.style.setProperty('--callout-origin', onRight ? 'left center' : 'right center');
}
