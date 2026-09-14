const XSS_PATTERN = /<\s*\/?script/i;
const XSS_EVENT_PATTERN = /\bon\w+\s*=/i;
const XSS_URI_PATTERN = /javascript\s*:/i;
const XSS_ELEMENT_PATTERN = /<\s*\/?\s*(iframe|object|embed|link|img|svg|math)\b[^>]*>/i;

export function hasXSS(value) {
  if (typeof value !== 'string') return false;
  return (
    XSS_PATTERN.test(value) ||
    XSS_EVENT_PATTERN.test(value) ||
    XSS_URI_PATTERN.test(value) ||
    XSS_ELEMENT_PATTERN.test(value)
  );
}

export function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function isUnsafeInput(value) {
  return hasXSS(value);
}

export function sanitizeEmployeeId(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
}

export function sanitizeName(value) {
  return value.replace(/[^a-zA-Z\s.'\-]/g, '').substring(0, 100);
}

export function sanitizePhone(value) {
  return value.replace(/[^0-9+\-\s()]/g, '').substring(0, 20);
}

export function sanitizeEmail(value) {
  return value.replace(/[^a-zA-Z0-9@._+\-]/g, '').substring(0, 255);
}
