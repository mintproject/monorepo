// utils.js - Helper functions
export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

export const svoName = uri => (uri || '').split('/').pop();

export const humanSvo = uri => {
  const n = svoName(uri);
  const i = n.indexOf('__');
  if (i < 0) return n.replace(/_/g, ' ');
  return n.slice(0, i).replace(/_/g, ' ') + ' — ' + n.slice(i + 2).replace(/_/g, ' ');
};

export const statusBadge = st => {
  const u = String(st || '').toUpperCase();
  if (['COMPLETED', 'DONE', 'SUCCESS'].includes(u)) return '<span class="pill ok">completed</span>';
  if (['FAILED', 'ERROR', 'CANCELLED', 'ARCHIVING_FAILED', 'PHASE_ERROR'].includes(u)) return '<span class="pill bad">failed</span>';
  return '<span class="pill warn">running</span>';
};

export const formatTime = iso => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export const contractBadge = c => {
  const parts = [];
  if (c.svo) parts.push(`<span style="color:var(--acc)">${esc(svoName(c.svo))}</span>`);
  if (c.unit) parts.push(`unit: ${esc(c.unit)}`);
  if (c.format) parts.push(`fmt: ${esc(c.format)}`);
  if (c.spatial) parts.push(esc(c.spatial));
  if (c.crs) parts.push(esc(c.crs));
  if (c.catalog) parts.push(`catalog: <b>${esc(c.catalog)}</b>`);
  return parts.join('  ·  ') || '<span class="muted">—</span>';
};

export const dataObjectLabel = o => {
  const v = (o.variables || [])[0] || {};
  const bits = [o.format && `fmt: ${o.format}`, v.unit && `unit: ${v.unit}`, v.standard_variable_uri && svoName(v.standard_variable_uri)].filter(Boolean);
  return `${o.label || o.id}${bits.length ? '  ·  ' + bits.join('  ·  ') : ''}`;
};

export const normDfcText = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();