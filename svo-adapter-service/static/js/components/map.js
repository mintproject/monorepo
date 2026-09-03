// map.js - GMA boundary map rendering
import { $, esc, normDfcText } from '../utils.js';
import { STATE } from '../state.js';

export function gmaLabelFromRecord(r) {
  const n = Number(r.gma ?? r.gma_id);
  return Number.isFinite(n) ? `GMA ${n}` : String(r.gma_id || r.gma || '');
}

export function gmaNumber(label) {
  const m = String(label || '').match(/\d+/);
  return m ? Number(m[0]) : 999;
}

export function aquiferChoiceFromRecord(r) {
  return r.aquifer || r.aquifer_system || '';
}

export function recordMatchesAquiferSelection(r, aquifer) {
  if (!aquifer) return true;
  const q = normDfcText(aquifer);
  return [r.aquifer_system, r.aquifer].some(v => normDfcText(v) === q);
}

export function selectedDfcRecords() {
  const gma = $('dfcGmaId')?.value;
  const aquifer = $('dfcAquifer')?.value;
  const year = Number($('dfcTargetYear')?.value || 0);
  return STATE.DFC_TARGET_RECORDS.filter(r => {
    if (gma && gmaLabelFromRecord(r) !== gma) return false;
    if (!recordMatchesAquiferSelection(r, aquifer)) return false;
    const targetYear = Number(r.period?.target_year || 0);
    if (year && targetYear && targetYear !== year) return false;
    return true;
  });
}

export function dfcMetricTargetsForCurrentContext() {
  const availableMetrics = new Set(selectedDfcRecords().map(r => r.metric));
  if (!availableMetrics.size) return [];
  return STATE.DFC_TARGETS
    .filter(t => t.key !== 'compliance-report')
    .filter(t => availableMetrics.has(t.targetMetric));
}

export function replaceSelectOptions(select, values, previous, fallback, emptyLabel) {
  if (!select) return '';
  select.innerHTML = '';
  if (!values.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = emptyLabel || 'No records';
    select.appendChild(opt);
    select.disabled = true;
    return '';
  }
  select.disabled = false;
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = v.value ?? v;
    opt.textContent = v.label ?? v;
    select.appendChild(opt);
  }
  const optionValues = values.map(v => String(v.value ?? v));
  const next = optionValues.includes(String(previous)) ? String(previous)
    : optionValues.includes(String(fallback)) ? String(fallback)
    : optionValues[0];
  select.value = next;
  return next;
}

export async function loadDfcTargetRecords() {
  if (STATE.DFC_TARGET_RECORDS.length) return STATE.DFC_TARGET_RECORDS;
  const lookup = await import('../api.js').then(m => m.api('GET', '/dfc-targets?limit=1000'));
  STATE.DFC_TARGET_RECORDS = lookup.records || [];
  return STATE.DFC_TARGET_RECORDS;
}

export function selectedGmaNum() {
  const n = gmaNumber($('dfcGmaId')?.value || '');
  return Number.isFinite(n) && n !== 999 ? n : null;
}

function arcgisGmaUrl(where = '1=1') {
  const qs = new URLSearchParams({
    where,
    outFields: 'GMAnum',
    returnGeometry: 'true',
    f: 'geojson',
    orderByFields: 'GMAnum ASC',
  });
  return `${STATE.TWDB_GMA_BOUNDARY_LAYER}/query?${qs.toString()}`;
}

export async function loadGmaBoundaryFeatures() {
  if (STATE.GMA_BOUNDARY_FEATURES) return STATE.GMA_BOUNDARY_FEATURES;
  if (!STATE.GMA_BOUNDARY_PROMISE) {
    STATE.GMA_BOUNDARY_PROMISE = fetch(arcgisGmaUrl())
      .then(async r => {
        const text = await r.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('TWDB boundary response was not JSON'); }
        if (!r.ok || data.error) throw new Error(data.error?.message || `TWDB boundary HTTP ${r.status}`);
        STATE.GMA_BOUNDARY_FEATURES = data.features || [];
        return STATE.GMA_BOUNDARY_FEATURES;
      })
      .catch(e => {
        STATE.GMA_BOUNDARY_PROMISE = null;
        throw e;
      });
  }
  return STATE.GMA_BOUNDARY_PROMISE;
}

function gmaFeatureNum(feature) {
  const p = feature?.properties || {};
  return Number(p.GMAnum ?? p.gmanum ?? p.GMA ?? p.gma);
}

function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flat();
  return [];
}

function mapBounds(features) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const feature of features) {
    for (const ring of geometryRings(feature.geometry)) {
      for (const pt of ring) {
        const x = Number(pt?.[0]);
        const y = Number(pt?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }
  }
  return Number.isFinite(bounds.minX) ? bounds : null;
}

function projectMapPoint(pt, bounds, width, height, pad) {
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const spanY = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const scale = Math.min(usableW / spanX, usableH / spanY);
  const mapW = spanX * scale;
  const mapH = spanY * scale;
  const offsetX = (width - mapW) / 2;
  const offsetY = (height - mapH) / 2;
  const x = offsetX + (Number(pt[0]) - bounds.minX) * scale;
  const y = offsetY + (bounds.maxY - Number(pt[1])) * scale;
  return [x, y];
}

function ringPath(ring, bounds, width, height, pad) {
  if (!ring?.length) return '';
  const stride = Math.max(1, Math.ceil(ring.length / 650));
  const points = ring.filter((_, i) => i % stride === 0 || i === ring.length - 1);
  return points.map((pt, i) => {
    const [x, y] = projectMapPoint(pt, bounds, width, height, pad);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function featurePath(feature, bounds, width, height, pad) {
  return geometryRings(feature.geometry)
    .map(ring => ringPath(ring, bounds, width, height, pad))
    .filter(Boolean)
    .join(' ');
}

function featureCenter(feature, bounds, width, height, pad) {
  const fb = mapBounds([feature]);
  if (!fb) return null;
  return projectMapPoint(
    [(fb.minX + fb.maxX) / 2, (fb.minY + fb.maxY) / 2],
    bounds,
    width,
    height,
    pad
  );
}

export function renderDfcMap(features) {
  const map = $('dfcMap');
  if (!map) return;
  const gmaNum = selectedGmaNum();
  const gmaLabel = gmaNum ? `GMA ${gmaNum}` : ($('dfcGmaId')?.value || 'GMA');
  const recordCount = selectedDfcRecords().length;

  const titleEl = $('dfcMapTitle');
  const summaryEl = $('dfcMapSummary');
  if (titleEl) titleEl.textContent = gmaLabel;
  if (summaryEl) summaryEl.textContent = `${recordCount} DFC target${recordCount === 1 ? '' : 's'}`;

  if (!features?.length) {
    map.innerHTML = '<div class="map-status">TWDB GMA boundary is unavailable.</div>';
    return;
  }
  const bounds = mapBounds(features);
  if (!bounds) {
    map.innerHTML = '<div class="map-status">TWDB GMA boundary geometry is empty.</div>';
    return;
  }
  const width = 360;
  const height = 250;
  const pad = 14;
  const selected = features.find(f => gmaFeatureNum(f) === gmaNum);
  const background = features
    .filter(f => gmaFeatureNum(f) !== gmaNum)
    .map(f => `<path class="map-path" d="${featurePath(f, bounds, width, height, pad)}"></path>`)
    .join('');
  const selectedPath = selected
    ? `<path class="map-path selected" d="${featurePath(selected, bounds, width, height, pad)}"></path>`
    : '';
  const labels = features.map(f => {
    const n = gmaFeatureNum(f);
    const center = featureCenter(f, bounds, width, height, pad);
    if (!center || !Number.isFinite(n)) return '';
    return `<text class="map-label ${n === gmaNum ? 'selected' : ''}" x="${center[0].toFixed(1)}" y="${center[1].toFixed(1)}">${n}</text>`;
  }).join('');
  const status = selected
    ? `TWDB GMA boundary layer | selected ${gmaLabel}`
    : `TWDB GMA boundary layer | ${gmaLabel} not found`;
  map.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(gmaLabel)} boundary map">
    ${background}
    ${selectedPath}
    ${labels}
  </svg><div class="map-status">${esc(status)}</div>`;
}

export function renderDfcMapLoading() {
  const map = $('dfcMap');
  if (!map) return;
  const gmaNum = selectedGmaNum();
  const titleEl = $('dfcMapTitle');
  const summaryEl = $('dfcMapSummary');
  if (titleEl) titleEl.textContent = gmaNum ? `GMA ${gmaNum}` : ($('dfcGmaId')?.value || 'GMA');
  if (summaryEl) summaryEl.textContent = 'loading boundary';
  map.innerHTML = '<div class="map-status">Loading TWDB GMA boundary...</div>';
}

export function updateDfcMap() {
  const request = ++STATE.DFC_MAP_REQUEST;
  if (STATE.GMA_BOUNDARY_FEATURES) {
    renderDfcMap(STATE.GMA_BOUNDARY_FEATURES);
    return;
  }
  renderDfcMapLoading();
  loadGmaBoundaryFeatures()
    .then(features => { if (request === STATE.DFC_MAP_REQUEST) renderDfcMap(features); })
    .catch(e => {
      if (request !== STATE.DFC_MAP_REQUEST) return;
      const map = $('dfcMap');
      if (map) map.innerHTML = `<div class="map-status">Boundary map unavailable: ${esc(e.message)}</div>`;
      const summaryEl = $('dfcMapSummary');
      if (summaryEl) summaryEl.textContent = 'boundary unavailable';
    });
}

export function updateDfcContextSelectors({ preserveGma = true, preserveAquifer = true, preserveYear = true, preserveMetric = true } = {}) {
  const gmaSel = $('dfcGmaId');
  const aquiferSel = $('dfcAquifer');
  const yearSel = $('dfcTargetYear');
  const metricSel = $('dfcMetricQuestionSel');
  const prevGma = preserveGma ? gmaSel?.value : '';
  const prevAquifer = preserveAquifer ? aquiferSel?.value : '';
  const prevYear = preserveYear ? yearSel?.value : '';
  const prevMetric = preserveMetric ? metricSel?.value : '';

  const recordGmas = new Set(STATE.DFC_TARGET_RECORDS.map(gmaLabelFromRecord).filter(Boolean));
  const gmaValues = Array.from({ length: 16 }, (_, i) => `GMA ${i + 1}`).map(gma => ({
    value: gma,
    label: recordGmas.has(gma) ? gma : `${gma} (no extracted DFC records)`,
  }));
  const gma = replaceSelectOptions(gmaSel, gmaValues, prevGma, 'GMA 12', 'No GMA records');

  const gmaRecords = STATE.DFC_TARGET_RECORDS.filter(r => gmaLabelFromRecord(r) === gma);
  const aquifers = Array.from(new Set(gmaRecords.map(aquiferChoiceFromRecord).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const aquifer = replaceSelectOptions(aquiferSel, aquifers, prevAquifer, 'Carrizo', 'No extracted aquifers');

  const aqRecords = gmaRecords.filter(r => recordMatchesAquiferSelection(r, aquifer));
  const years = Array.from(new Set(aqRecords.map(r => r.period?.target_year).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
  replaceSelectOptions(yearSel, years.map(y => String(y)), prevYear, '2070', 'No target year');

  const metricTargets = dfcMetricTargetsForCurrentContext();
  const metricOptions = metricTargets.length
    ? [{ value: 'all', label: 'All available DFC metrics' }, ...metricTargets.map(t => ({ value: t.key, label: t.label }))]
    : [{ value: 'all', label: 'No adopted DFC metrics extracted' }];
  replaceSelectOptions(metricSel, metricOptions, prevMetric, 'all', 'No DFC metrics');

  const boundaryInput = $('dfcBoundaryUri');
  if (boundaryInput && !boundaryInput.value.trim()) {
    boundaryInput.value = STATE.TWDB_GMA_BOUNDARY_LAYER;
  }
  const areaBoundaryInput = $('dfcAreaBoundaryUri');
  if (areaBoundaryInput && !areaBoundaryInput.value.trim()) {
    areaBoundaryInput.value = boundaryInput?.value || STATE.TWDB_GMA_BOUNDARY_LAYER;
  }
  updateDfcMap();
}
