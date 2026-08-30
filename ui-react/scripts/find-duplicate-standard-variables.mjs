#!/usr/bin/env node
// Find duplicate standard variables in the live model catalog.
//
// A "duplicate cluster" is a set of modelcatalog_standard_variable rows that share
// a normalized label (trimmed, lowercased, whitespace-collapsed) but have distinct
// ids. For each row we also report how many variable_presentation rows point at it
// (its FK fan-in), so you can tell which id is the de-facto canonical one and which
// duplicates are safe to retire (0 references).
//
// Usage:
//   HASURA_ADMIN_SECRET=... node scripts/find-duplicate-standard-variables.mjs
//
// Optional env:
//   HASURA_ENDPOINT   GraphQL endpoint (default https://graphql.mint.isi.edu/v1/graphql)
//   HASURA_JWT        Bearer token to use instead of the admin secret
//   OUT_JSON          Path to also write the full report as JSON (e.g. /tmp/sv-dupes.json)

const ENDPOINT = process.env.HASURA_ENDPOINT ?? 'https://graphql.mint.isi.edu/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const JWT = process.env.HASURA_JWT;

if (!ADMIN_SECRET && !JWT) {
  console.error(
    'Need credentials: set HASURA_ADMIN_SECRET (or HASURA_JWT). ' +
      'The anonymous role cannot read modelcatalog_standard_variable.',
  );
  process.exit(1);
}

const headers = { 'Content-Type': 'application/json' };
if (ADMIN_SECRET) headers['x-hasura-admin-secret'] = ADMIN_SECRET;
else headers['Authorization'] = `Bearer ${JWT}`;

/** POST a GraphQL query and return data, throwing on any GraphQL/HTTP error. */
async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

/** Normalize a label for duplicate grouping: trim, collapse whitespace, lowercase. */
function normalize(label) {
  return (label ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const SV_QUERY = /* GraphQL */ `
  query AllStandardVariables {
    modelcatalog_standard_variable(order_by: { label: asc }) {
      id
      label
      description
      same_as
    }
  }
`;

// Pull presentation -> standard_variable links to count FK fan-in per SV id.
const VP_QUERY = /* GraphQL */ `
  query AllPresentationLinks {
    modelcatalog_variable_presentation {
      id
      standard_variable {
        id
      }
    }
  }
`;

async function main() {
  console.error(`Querying ${ENDPOINT} ...`);
  const [{ modelcatalog_standard_variable: svs }, { modelcatalog_variable_presentation: vps }] =
    await Promise.all([gql(SV_QUERY), gql(VP_QUERY)]);

  // Usage count per SV id (how many presentations reference it).
  const usage = new Map();
  for (const vp of vps) {
    const id = vp.standard_variable?.id;
    if (!id) continue;
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  // Group SV rows by normalized label.
  const clusters = new Map();
  for (const sv of svs) {
    const key = normalize(sv.label);
    if (!key) continue; // skip blank labels
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push({ ...sv, uses: usage.get(sv.id) ?? 0 });
  }

  // A cluster is a duplicate only if it has >1 distinct id.
  const dupeClusters = [...clusters.entries()]
    .map(([key, rows]) => ({ key, rows }))
    .filter((c) => c.rows.length > 1)
    .sort((a, b) => totalUses(b.rows) - totalUses(a.rows));

  const redundantRows = dupeClusters.reduce((n, c) => n + (c.rows.length - 1), 0);
  const totalPresentations = vps.length;
  const orphanedRedundant = dupeClusters.reduce(
    (n, c) => n + c.rows.filter((r) => r.uses === 0).length,
    0,
  );

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n=== Standard Variable Duplicate Report ===\n');
  console.log(`Total standard variables : ${svs.length}`);
  console.log(`Total variable presentations referencing SVs : ${totalPresentations}`);
  console.log(`Distinct labels (normalized) : ${clusters.size}`);
  console.log(`Duplicate clusters (label shared by >1 id) : ${dupeClusters.length}`);
  console.log(`Redundant rows (would disappear if each cluster merged to 1) : ${redundantRows}`);
  console.log(`  ...of which are unused (0 presentations, safe to delete) : ${orphanedRedundant}`);

  console.log('\n--- Top duplicate clusters (by total presentations attached) ---\n');
  const TOP = Number(process.env.TOP ?? 25);
  for (const c of dupeClusters.slice(0, TOP)) {
    console.log(`"${c.rows[0].label}"  (${c.rows.length} rows, ${totalUses(c.rows)} uses total)`);
    for (const r of [...c.rows].sort((a, b) => b.uses - a.uses)) {
      const flag = r.uses === 0 ? '  [unused]' : '';
      const sameAs = r.same_as ? `  same_as=${r.same_as}` : '';
      console.log(`    ${String(r.uses).padStart(4)}  ${r.id}${flag}${sameAs}`);
    }
    console.log('');
  }
  if (dupeClusters.length > TOP) {
    console.log(`... and ${dupeClusters.length - TOP} more clusters (set TOP=N to see more).`);
  }

  if (process.env.OUT_JSON) {
    const fs = await import('node:fs');
    fs.writeFileSync(
      process.env.OUT_JSON,
      JSON.stringify(
        { summary: { totalSvs: svs.length, dupeClusters: dupeClusters.length, redundantRows, orphanedRedundant }, clusters: dupeClusters },
        null,
        2,
      ),
    );
    console.log(`\nFull report written to ${process.env.OUT_JSON}`);
  }
}

function totalUses(rows) {
  return rows.reduce((n, r) => n + r.uses, 0);
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
