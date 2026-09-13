// render.js - UI rendering functions
import { $, esc, svoName, humanSvo, contractBadge, dataObjectLabel, statusBadge, formatTime } from '../utils.js';
import { STATE } from '../state.js';

// Source helpers
export function objContract(obj) {
  const v = (obj.variables || [])[0] || {};
  return { svo: v.standard_variable_uri || null, unit: v.unit || null, format: obj.format || null,
           spatial: v.spatial_type || null, crs: v.crs || null, catalog: null };
}

export function specInContract(c) {
  return { svo: c.standard_variable_uri || null, unit: c.unit || null, format: c.format || null, catalog: c.catalog || null };
}

export function specOutContract(c) {
  return { svo: c.standard_variable_uri || null, unit: c.unit || null, format: c.format || null, catalog: c.catalog || null };
}

export function applyOut(state, outC) {
  const s = { ...state };
  if (outC.svo) s.svo = outC.svo;
  if (outC.unit) s.unit = outC.unit;
  if (outC.format) s.format = outC.format;
  if (outC.catalog) s.catalog = outC.catalog;
  return s;
}

export function gapsBetween(a, b) {
  const g = [];
  if (b.unit && a.unit !== b.unit) g.push(`unit <code>${esc(a.unit || '—')}</code> ≠ <code>${esc(b.unit)}</code>`);
  if (b.format && a.format !== b.format) g.push(`format <code>${esc(a.format || '—')}</code> ≠ <code>${esc(b.format)}</code>`);
  if (b.catalog && a.catalog !== b.catalog) g.push(`not in catalog (needs <code>${esc(b.catalog)}</code>)`);
  return g;
}

export function changesMade(before, outC) {
  const c = [];
  if (outC.unit && outC.unit !== before.unit) c.push(`unit <b>${esc(before.unit || '—')} → ${esc(outC.unit)}</b>`);
  if (outC.format && outC.format !== before.format) c.push(`format <b>${esc(before.format || '—')} → ${esc(outC.format)}</b>`);
  if (outC.catalog) c.push(`registers in <b>${esc(outC.catalog)}</b>`);
  return c;
}

export function findSpec(name) {
  return Object.values(STATE.SPECS).find(s => s.name === name);
}

// Render sources panel
export function renderSources(objs) {
  const el = $('sourcesList');
  if (!el) return;
  if (!objs.length) { el.innerHTML = '<p class="muted">none registered</p>'; return; }
  el.innerHTML = objs.map(o => {
    const v = (o.variables || [])[0] || {};
    const svo = svoName(v.standard_variable_uri || '');
    const meta = [v.unit && `unit: ${v.unit}`, o.format && `fmt: ${o.format}`, v.spatial_type, v.crs].filter(Boolean).join('  ·  ');
    return `<div class="src-card">
      <div class="s-label">${esc(o.label)}</div>
      <div class="s-svo">${esc(svo)}</div>
      <div class="s-meta">${esc(meta)}</div>
      <div class="s-uri">${esc(o.resource_uri)}</div>
    </div>`;
  }).join('');
}

// Render transform chain
export function renderChain(sourceObj, chainNames, targetContract) {
  let state = objContract(sourceObj);
  let html = '';

  // Source vs target row
  html += `<div class="versus">
    <div class="vs-box">
      <div class="vb-role">source</div>
      <div class="vb-svo">${esc(svoName(state.svo || ''))}</div>
      <div class="vb-props">${contractBadge(state)}</div>
    </div>
    <div class="vs-arrow">→</div>
    <div class="vs-box">
      <div class="vb-role">model needs</div>
      <div class="vb-svo">${esc(svoName(targetContract.svo || ''))}</div>
      <div class="vb-props">${contractBadge(targetContract)}</div>
    </div>
  </div>`;

  if (chainNames.length === 0) {
    html += `<div class="result-line">direct match — no transform required</div>`;
    return html;
  }

  html += `<div class="chain">`;
  for (const name of chainNames) {
    const spec = findSpec(name);
    if (!spec) { html += `<div class="err">spec "${esc(name)}" not found in registry</div>`; continue; }
    const inputs = (spec.contracts || []).filter(c => c.role === 'input');
    const outputs = (spec.contracts || []).filter(c => c.role === 'output');
    const inC = inputs.find(c => c.standard_variable_uri === state.svo || !c.standard_variable_uri) || inputs[0] || {};
    const outC = outputs[0] || {};

    const gaps = gapsBetween(state, specInContract(inC));
    const changes = changesMade(state, specOutContract(outC));

    html += `<div class="step-row">
      <div class="step-gutter"></div>
      <div class="step-content">`;
    if (gaps.length) html += `<div class="gap-line">${gaps.join(' &nbsp;·&nbsp; ')}</div>`;
    html += `<div class="transform-box">
        <span class="tb-name">${esc(spec.name)}</span>
        <span class="tb-type">${esc(spec.transform_type)}</span>
        <div class="tb-method">${esc(spec.method || '')}</div>
        ${changes.length ? `<div class="tb-changes">${changes.join('  ·  ')}</div>` : ''}
      </div>`;
    html += `</div></div>`;
    state = applyOut(state, specOutContract(outC));
  }

  const remainingGaps = gapsBetween(state, targetContract);
  if (remainingGaps.length) {
    html += `<div class="step-row"><div class="step-gutter"></div><div class="step-content">
      <div class="gap-line err">${remainingGaps.join(' · ')} — path incomplete</div>
    </div></div>`;
  } else {
    html += `<div class="step-row"><div class="step-gutter"></div><div class="step-content">
      <div class="result-line">${contractBadge(state)} — matches model input</div>
    </div></div>`;
  }
  html += `</div>`;
  return html;
}

// Render DFC plan
export function renderDfcPlan(plan, source, target) {
  const steps = plan?.plan_json?.steps || [];
  const names = steps.map(s => s.name);
  const note = target.note
    ? `<p class="bfs-note" style="margin-top:12px">${esc(target.note)}</p>`
    : '';

  const graphOut = $('graphOut');
  if (!graphOut) return;

  if (plan?.status === 'ready') {
    graphOut.innerHTML = `<div class="branch">
      <div class="branch-header"><div class="branch-index">1</div><div class="branch-title">${esc(source.label)} <span class="pill ok">ready</span></div></div>
      ${renderChain(source, [], target.contract)}
    </div>${note}`;
    return;
  }
  if (!steps.length) {
    graphOut.innerHTML = `<div class="branch">
      <div class="branch-header">
        <div class="branch-index">1</div>
        <div class="branch-title">${esc(source.label)} → ${esc(target.plannerLabel || target.label)} <span class="pill bad">${esc(plan?.status || 'unresolved')}</span></div>
      </div>
      <p class="err">No transform chain is registered for this source and target combination.</p>
    </div>${note}`;
    return;
  }
  if (plan?.plan_json?.dfc_fanout) {
    graphOut.innerHTML = steps.map((step, idx) => `<div class="branch">
      <div class="branch-header">
        <div class="branch-index">${idx + 1}</div>
        <div class="branch-title">${esc(source.label)} → ${esc(step.dfc_area || step.env_values?.AREA || `area ${idx + 1}`)} <span class="pill ok">area aggregation</span></div>
      </div>
      ${renderChain(source, [step.name], target.contract)}
    </div>`).join('') + note;
    return;
  }
  graphOut.innerHTML = `<div class="branch">
    <div class="branch-header">
      <div class="branch-index">1</div>
      <div class="branch-title">${esc(source.label)} → ${esc(target.plannerLabel || target.label)} <span class="pill ok">${steps.length}-step plan</span></div>
    </div>
    ${renderChain(source, names, target.contract)}
  </div>${note}`;
}

// Render DFC answer cards
export function metricCard(result) {
  const { target, source, plan, error, targetRecords = [], objectiveId = '' } = result;
  const steps = plan?.plan_json?.steps || [];
  const isReady = !error && (plan?.status === 'ready' || steps.length > 0);
  const hasTarget = targetRecords.length > 0;
  const cls = error ? 'bad' : isReady && hasTarget ? 'ok' : 'warn';
  const status = error ? 'needs source' : isReady && hasTarget ? 'ready to compare' : isReady ? 'needs target' : 'review';
  const sourceLabel = source ? (source.label || source.id) : 'No matching modeled output';
  const calculation = error ? error : (steps.length ? `${steps.length} transform task${steps.length === 1 ? '' : 's'}` : (plan?.status === 'ready' ? 'Direct modeled-output match' : 'Plan requires review'));
  const targetInfo = summarizeTargetRecords(targetRecords);
  const compareLabel = error ? 'Model path missing' : (isReady && hasTarget ? 'Run modeled metric to compare' : hasTarget ? 'Target loaded; model path pending' : 'Adopted target not matched');

  return `<div class="metric-card ${cls}">
    <div class="mc-top">
      <div class="mc-title">${esc(target.label)}</div>
      <div class="mc-status">${esc(status)}</div>
    </div>
    <div class="mc-note">${esc(target.summary)}</div>
    <div class="mc-row"><span>Modeled output</span><b>${esc(sourceLabel)}</b></div>
    <div class="mc-row"><span>Modeled value</span><b>${esc(calculation)}</b></div>
    <div class="mc-row"><span>DFC target</span><b>${esc(targetInfo.label)}</b></div>
    <div class="mc-row"><span>Expected to meet?</span><b>${esc(compareLabel)}</b></div>
    ${renderTargetDetails(targetRecords)}
    <div class="mc-actions">
      ${source && !error ? `<button class="metric-inspect-btn" data-source-id="${esc(source.id)}" data-target-key="${esc(target.key)}" data-objective-id="${esc(objectiveId)}" data-target-label="${esc(target.plannerLabel || target.label)}">Inspect</button>` : ''}
    </div>
  </div>`;
}

function formatTargetValue(record) {
  const v = (record.target_values || [])[0];
  if (!v) return record.dfc_statement;
  if (v.min !== undefined && v.max !== undefined) return `${v.min}–${v.max} ${v.unit}`;
  if (v.value !== undefined) return `${v.value} ${v.unit}`;
  return record.dfc_statement;
}

function summarizeTargetRecords(records) {
  if (!records?.length) return { label: 'No adopted target matched', detail: 'Try a different aquifer, area, or GMA.' };
  const first = records[0];
  const value = formatTargetValue(first);
  const suffix = records.length > 1 ? ` + ${records.length - 1} more` : '';
  return {
    label: `${value}${suffix}`,
    detail: first.dfc_statement,
    source: `PDF p. ${first.source?.pdf_page || '—'}`,
  };
}

function renderTargetDetails(records) {
  if (!records?.length) return '';
  const rows = records.slice(0, 8).map(r => `<li>
    <b>${esc([r.area, r.aquifer].filter(Boolean).join(' · ') || 'GMA-wide')}</b>
    <span>${esc(r.dfc_statement)}</span>
    <code>${esc(`PDF p. ${r.source?.pdf_page || '—'}`)}</code>
  </li>`).join('');
  const more = records.length > 8 ? `<p class="muted" style="margin-top:6px">${records.length - 8} additional adopted targets matched this filter.</p>` : '';
  return `<details style="margin-top:8px">
    <summary class="muted">adopted DFC target evidence</summary>
    <ul style="margin:8px 0 0 16px;font-size:12px;line-height:1.5">${rows}</ul>
    ${more}
  </details>`;
}

export function renderDfcEvaluationResults(results) {
  const answerOut = $('dfcAnswerOut');
  if (!answerOut) return;

  const ready = results.filter(r => !r.error && (r.plan?.status === 'ready' || (r.plan?.plan_json?.steps || []).length > 0)).length;
  const targetLoaded = results.reduce((n, r) => n + (r.targetRecords?.length || 0), 0);
  const needs = results.length - ready;
  const firstReady = results.find(r => !r.error && r.source && r.plan && (r.plan.status === 'ready' || (r.plan.plan_json?.steps || []).length > 0));

  answerOut.innerHTML = `<div class="answer-summary">
    <div class="answer-hero">
      <div class="answer-label">Evaluation answer</div>
      <div class="answer-title">${esc(dfcContextLabel())}</div>
      <div class="answer-copy">${ready} of ${results.length} DFC metric${results.length === 1 ? '' : 's'} have a modeled-output calculation path. ${targetLoaded} adopted DFC target record${targetLoaded === 1 ? '' : 's'} matched the selected GMA/aquifer/year. Final meet/not-meet status requires running the modeled metric and comparing it to the target.</div>
    </div>
    <div class="answer-stat"><div class="answer-label">Metric paths</div><div class="value">${ready}/${results.length}</div></div>
    <div class="answer-stat"><div class="answer-label">Adopted records</div><div class="value">${targetLoaded}</div></div>
    <div class="answer-stat"><div class="answer-label">Missing paths</div><div class="value">${needs}</div></div>
  </div>
  <div class="metric-grid">${results.map(metricCard).join('')}</div>`;

  if (firstReady) {
    STATE.PLAN_DFC = firstReady.plan;
    STATE.DFC_SELECTED_SOURCE = firstReady.source;
    STATE.DFC_SELECTED_TARGET = firstReady.target;
  }
}

function dfcContextLabel() {
  const gma = $('dfcGmaId')?.value || 'selected GMA';
  const aquifer = $('dfcAquifer')?.value?.trim() || 'selected aquifer';
  const year = $('dfcTargetYear')?.value?.trim() || 'target year';
  return `${gma} | ${aquifer} | ${year}`;
}

export function renderDfcAnswerPlaceholder() {
  const answerOut = $('dfcAnswerOut');
  if (!answerOut) return;

  answerOut.innerHTML = `<div class="answer-summary">
    <div class="answer-hero">
      <div class="answer-label">Planner question</div>
      <div class="answer-title">Select a GMA and evaluate the DFCs.</div>
      <div class="answer-copy">The adapter will inspect the registered GAM modeled outputs, identify which DFC metrics can be calculated, and expose the workflow evidence below.</div>
    </div>
    <div class="answer-stat"><div class="answer-label">Metric paths</div><div class="value">—</div></div>
    <div class="answer-stat"><div class="answer-label">Adopted records</div><div class="value">—</div></div>
    <div class="answer-stat"><div class="answer-label">Compliance</div><div class="value" style="font-size:18px">Pending</div></div>
  </div>
  <div class="metric-grid">
    ${STATE.DFC_TARGETS.filter(t => t.key !== 'compliance-report').map(t => `<div class="metric-card warn">
      <div class="mc-top"><div class="mc-title">${esc(t.label)}</div><div class="mc-status">not evaluated</div></div>
      <div class="mc-note">${esc(t.summary)}</div>
      <div class="mc-row"><span>Modeled value</span><b>Evaluate to calculate</b></div>
      <div class="mc-row"><span>DFC target</span><b>Evaluate to load adopted target</b></div>
    </div>`).join('')}
  </div>`;
}
