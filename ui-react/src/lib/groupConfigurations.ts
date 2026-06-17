/**
 * groupConfigurations — pure transform from the flat SearchModelConfigurations
 * result set into the Model -> Configuration -> Setup structure the browse list
 * renders.
 *
 * A "setup" is a configuration row with a non-null `model_configuration_id`; a
 * "configuration" has a null one. Because filtering happens server-side at the
 * configuration level, a setup can match a facet while its parent config does
 * not — so we synthesize the parent (flagged `synthesized`) from the setup's
 * `parent_configuration` and render it dimmed, allowing the setup to nest.
 */

export interface RowSoftware {
  id: string;
  label: string;
}

export interface RowVersion {
  version_id?: string | null;
  software?: RowSoftware | null;
}

export interface SearchConfigurationRow {
  id: string;
  label: string;
  model_configuration_id?: string | null;
  software_version?: RowVersion | null;
  parent_configuration?: {
    id: string;
    label: string;
    software_version?: RowVersion | null;
  } | null;
}

export interface SetupNode {
  id: string;
  label: string;
}

export interface ConfigNode {
  id: string;
  label: string;
  versionId: string | null;
  /** true when this config node was inferred from a matching setup, not matched itself. */
  synthesized: boolean;
  setups: SetupNode[];
}

export interface ModelGroup {
  softwareId: string;
  softwareLabel: string;
  configs: ConfigNode[];
}

const UNKNOWN_SOFTWARE: RowSoftware = { id: '__unknown__', label: 'Unknown model' };

export function groupConfigurations(rows: SearchConfigurationRow[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  const configIndex = new Map<string, ConfigNode>();

  const ensureGroup = (software?: RowSoftware | null): ModelGroup => {
    const id = software?.id ?? UNKNOWN_SOFTWARE.id;
    const label = software?.label ?? UNKNOWN_SOFTWARE.label;
    let group = groups.get(id);
    if (!group) {
      group = { softwareId: id, softwareLabel: label, configs: [] };
      groups.set(id, group);
    }
    return group;
  };

  const ensureConfig = (
    configId: string,
    label: string,
    version: RowVersion | null | undefined,
    synthesized: boolean,
  ): ConfigNode => {
    const existing = configIndex.get(configId);
    if (existing) {
      // A real config row upgrades a previously-synthesized placeholder.
      if (!synthesized && existing.synthesized) {
        existing.synthesized = false;
        existing.label = label;
        existing.versionId = version?.version_id ?? existing.versionId;
      }
      return existing;
    }
    const node: ConfigNode = {
      id: configId,
      label,
      versionId: version?.version_id ?? null,
      synthesized,
      setups: [],
    };
    configIndex.set(configId, node);
    ensureGroup(version?.software).configs.push(node);
    return node;
  };

  // Pass 1: real configs first, so setups attach to real (non-synthesized) parents.
  for (const row of rows) {
    if (!row.model_configuration_id) {
      ensureConfig(row.id, row.label, row.software_version, false);
    }
  }

  // Pass 2: setups nest under their parent config (synthesizing it if absent).
  for (const row of rows) {
    if (row.model_configuration_id) {
      const parent = row.parent_configuration;
      const parentId = parent?.id ?? row.model_configuration_id;
      const node = ensureConfig(
        parentId,
        parent?.label ?? parentId,
        parent?.software_version,
        true,
      );
      node.setups.push({ id: row.id, label: row.label });
    }
  }

  const result = [...groups.values()];
  result.sort((a, b) => a.softwareLabel.localeCompare(b.softwareLabel));
  for (const group of result) {
    group.configs.sort((a, b) => a.label.localeCompare(b.label));
    for (const config of group.configs) {
      config.setups.sort((a, b) => a.label.localeCompare(b.label));
    }
  }
  return result;
}
