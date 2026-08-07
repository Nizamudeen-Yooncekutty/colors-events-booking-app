function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getSlotColor(slotIndex) {
  const goldenAngle = 137.508;
  const hue = (slotIndex * goldenAngle) % 360;
  return hslToHex(hue, 70, 35);
}

export function getSlotColorLight(slotIndex) {
  const goldenAngle = 137.508;
  const hue = (slotIndex * goldenAngle) % 360;
  return hslToHex(hue, 50, 95);
}
