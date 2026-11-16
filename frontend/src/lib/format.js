const DEFAULT_CURRENCY = 'COP';

export function money(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value ?? 0);
  const isWhole = ['COP', 'CLP', 'PYG'].includes(currency);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function compactMoney(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) < 1000000) return money(amount, currency);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function number(value, decimals = 0) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value ?? 0));
}

const INVARIANT_UNITS = new Set(['kg', 'g', 'mg', 'ml', 'l', 'lt', 'm', 'cm', 'mm', 'oz', 'lb']);

export function quantity(value, unit = 'unidad') {
  const amount = Number(value ?? 0);
  const label = String(unit || 'unidad').trim();
  if (amount === 1 || INVARIANT_UNITS.has(label.toLowerCase())) {
    return `${number(amount)} ${label}`;
  }

  let plural = `${label}es`;
  if (/z$/i.test(label)) plural = `${label.slice(0, -1)}ces`;
  else if (/[aeiouáéíóú]$/i.test(label)) plural = `${label}s`;

  return `${number(amount)} ${plural}`;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function date(value, options = {}) {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(parsed);
}

export function dateShort(value) {
  return date(value, { year: undefined });
}

export function dateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function timeOnly(value) {
  const parsed = parseDate(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysISO(iso, days) {
  const parsed = parseDate(iso) ?? new Date();
  parsed.setDate(parsed.getDate() + days);
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

export function longToday() {
  const text = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function errorMessage(error) {
  if (!error) return '';
  if (error.details?.length) {
    return `${error.message}: ${error.details.map((detail) => detail.message).join(', ')}`;
  }
  return error.message || 'Ocurrió un error';
}
