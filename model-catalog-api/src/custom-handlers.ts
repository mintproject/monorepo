/**
 * Custom endpoint handlers for the 13 /custom/ and /user/login endpoints.
 *
 * These endpoints perform cross-resource aggregation queries that require
 * nested GraphQL queries traversing multiple Hasura relationships. They
 * cannot be served by the generic CRUD Proxy in service.ts because they
 * join across resource types or return denormalized views.
 *
 * All handlers:
 * - Use readClient (Apollo Client) for queries via nested GraphQL
 * - Apply transformRow/transformList from mappers/response.ts
 * - Accept standard query params (username, label, page, per_page) where applicable
 * - Filter by user_id when username is provided
 * - Decode URI-encoded {id} parameters with decodeURIComponent()
 */

import { readClient, gql } from './hasura/client.js'
import { transformRow, transformList } from './mappers/response.js'
import { getResourceConfig } from './mappers/resource-registry.js'

// ---------------------------------------------------------------------------
// Shared field selections for deep nested queries
// ---------------------------------------------------------------------------

const SOFTWARE_FIELDS = `
  id label description has_documentation date_created date_modified user_id type
  author { id label }
  authors { id label }
  versions {
    id label description
    configurations {
      id label description
      setups { id label }
      inputs { id label }
      outputs { id label }
      parameters { id label }
      regions { id label }
    }
    input_variables { id label }
    output_variables { id label }
  }
`

const SETUP_FIELDS = `
  id label description has_documentation date_created date_modified user_id
  author { id label }
  authors { id label }
  model_configuration {
    id label description
    software_version { id label }
  }
  inputs {
    id label description has_fixed_resource format_type
    variable_presented_as { id label }
  }
  outputs {
    id label description has_fixed_resource format_type
    variable_presented_as { id label }
  }
  parameters {
    id label description has_default_value min_accepted_value max_accepted_value
    interventions { id label }
  }
  calibrated_variables { id label }
  calibration_targets { id label }
`

const CONFIGURATION_FIELDS = `
  id label description has_documentation date_created date_modified user_id
  author { id label }
  authors { id label }
  software_version { id label description }
  setups {
    id label description
    parameters { id label }
    inputs { id label }
    outputs { id label }
  }
  inputs {
    id label description has_fixed_resource format_type
    variable_presented_as { id label }
  }
  outputs {
    id label description has_fixed_resource format_type
    variable_presented_as { id label }
  }
  parameters {
    id label description has_default_value min_accepted_value max_accepted_value
    interventions { id label }
  }
  causal_diagrams { id label }
  time_intervals { id label }
  regions { id label }
`

// ---------------------------------------------------------------------------
// 1. /custom/model/index (custom_model_index_get)
// ---------------------------------------------------------------------------
async function custom_model_index_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('models')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = ['type: { _eq: "https://w3id.org/okn/o/sdm#Model" }']
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }
  if (label) { whereConditions.push('label: { _like: $label }'); variables['label'] = `%${label}%` }

  let varDecls = ''
  if (username) varDecls += ', $username: String!'
  if (label) varDecls += ', $label: String!'
  if (varDecls.startsWith(', ')) varDecls = varDecls.slice(2)
  const sigDecl = varDecls ? `(${varDecls})` : ''

  const queryStr = `query CustomModelIndex${sigDecl} { modelcatalog_software(where: { ${whereConditions.join(', ')} } limit: 200 offset: 0) { ${SOFTWARE_FIELDS} } }`

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    const rows = (data['modelcatalog_software'] ?? []) as Record<string, unknown>[]
    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_model_index_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 2. /custom/model/intervention (custom_model_intervention_get)
// ---------------------------------------------------------------------------
async function custom_model_intervention_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('models')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = ['type: { _eq: "https://w3id.org/okn/o/sdm#Model" }']
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const varDecls = username ? '($username: String!)' : ''
  const queryStr = `
    query CustomModelIntervention${varDecls} {
      modelcatalog_software(where: { ${whereConditions.join(', ')} } limit: 500 offset: 0) {
        id label description user_id type
        author { id label }
        versions {
          id label
          configurations {
            id label
            setups {
              id label
              parameters { id label interventions { id label } }
            }
          }
        }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    let rows = (data['modelcatalog_software'] ?? []) as Record<string, unknown>[]

    rows = rows.filter((sw: any) => {
      for (const ver of sw.versions ?? []) {
        for (const cfg of ver.configurations ?? []) {
          for (const setup of cfg.setups ?? []) {
            for (const param of setup.parameters ?? []) {
              if ((param.interventions ?? []).length > 0) {
                if (!label) return true
                return (param.interventions as any[]).some((inv: any) => inv.label?.toLowerCase().includes(label.toLowerCase()))
              }
            }
          }
        }
      }
      return false
    })

    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_model_intervention_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 3. /custom/model/region (custom_model_region_get)
// ---------------------------------------------------------------------------
async function custom_model_region_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('models')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = ['type: { _eq: "https://w3id.org/okn/o/sdm#Model" }']
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const varDecls = username ? '($username: String!)' : ''
  const queryStr = `
    query CustomModelRegion${varDecls} {
      modelcatalog_software(where: { ${whereConditions.join(', ')} } limit: 500 offset: 0) {
        id label description user_id type
        author { id label }
        versions { id label configurations { id label regions { id label } } }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    let rows = (data['modelcatalog_software'] ?? []) as Record<string, unknown>[]

    if (label) {
      const lbl = label.toLowerCase()
      rows = rows.filter((sw: any) => {
        for (const ver of sw.versions ?? []) {
          for (const cfg of ver.configurations ?? []) {
            for (const region of cfg.regions ?? []) {
              if (region.label?.toLowerCase().includes(lbl)) return true
            }
          }
        }
        return false
      })
    }

    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_model_region_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 4. /custom/models/variable (custom_models_variable_get)
// ---------------------------------------------------------------------------
async function custom_models_variable_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('models')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = ['type: { _eq: "https://w3id.org/okn/o/sdm#Model" }']
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const varDecls = username ? '($username: String!)' : ''
  const queryStr = `
    query CustomModelsVariable${varDecls} {
      modelcatalog_software(where: { ${whereConditions.join(', ')} } limit: 500 offset: 0) {
        id label description user_id type
        author { id label }
        versions { id label input_variables { id label } output_variables { id label } }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    let rows = (data['modelcatalog_software'] ?? []) as Record<string, unknown>[]

    if (label) {
      const lbl = label.toLowerCase()
      rows = rows.filter((sw: any) => {
        for (const ver of sw.versions ?? []) {
          const allVars = [...(ver.input_variables ?? []), ...(ver.output_variables ?? [])]
          if (allVars.some((v: any) => v.label?.toLowerCase().includes(lbl))) return true
        }
        return false
      })
    }

    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_models_variable_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 5. /custom/modelconfigurationsetups/variable (custom_modelconfigurationsetups_variable_get)
// ---------------------------------------------------------------------------
async function custom_modelconfigurationsetups_variable_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('modelconfigurationsetups')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = []
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const whereClause = whereConditions.length > 0 ? `where: { ${whereConditions.join(', ')} }` : ''
  const varDecls = username ? '($username: String!)' : ''
  const queryStr = `
    query CustomSetupsVariable${varDecls} {
      modelcatalog_model_configuration_setup(${whereClause} limit: 500 offset: 0) {
        id label description user_id
        model_configuration { id label }
        inputs { id label variable_presented_as { id label } }
        outputs { id label variable_presented_as { id label } }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    let rows = (data['modelcatalog_model_configuration_setup'] ?? []) as Record<string, unknown>[]

    if (label) {
      const lbl = label.toLowerCase()
      rows = rows.filter((setup: any) => {
        const allSpecs = [...(setup.inputs ?? []), ...(setup.outputs ?? [])]
        for (const spec of allSpecs) {
          for (const vp of spec.variable_presented_as ?? []) {
            if (vp.label?.toLowerCase().includes(lbl)) return true
          }
        }
        return false
      })
    }

    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_modelconfigurationsetups_variable_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 6. /custom/configurationsetups/{id} (custom_configurationsetups_id_get)
// ---------------------------------------------------------------------------
async function custom_configurationsetups_id_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('configurationsetups')!
  const id = decodeURIComponent(req.params.id)

  const queryStr = `
    query CustomConfigurationSetupById($id: String!) {
      modelcatalog_model_configuration_setup_by_pk(id: $id) {
        ${SETUP_FIELDS}
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables: { id } })
    const data = result.data as Record<string, unknown>
    const row = data['modelcatalog_model_configuration_setup_by_pk'] as Record<string, unknown> | null
    if (!row) { reply.code(404).send({ error: 'Not found' }); return }
    reply.code(200).send(transformRow(row, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_configurationsetups_id_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 7. /custom/modelconfigurationsetups/{id} (custom_modelconfigurationsetups_id_get)
// ---------------------------------------------------------------------------
async function custom_modelconfigurationsetups_id_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('modelconfigurationsetups')!
  const id = decodeURIComponent(req.params.id)

  const queryStr = `
    query CustomModelConfigurationSetupById($id: String!) {
      modelcatalog_model_configuration_setup_by_pk(id: $id) {
        ${SETUP_FIELDS}
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables: { id } })
    const data = result.data as Record<string, unknown>
    const row = data['modelcatalog_model_configuration_setup_by_pk'] as Record<string, unknown> | null
    if (!row) { reply.code(404).send({ error: 'Not found' }); return }
    reply.code(200).send(transformRow(row, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_modelconfigurationsetups_id_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 8. /custom/modelconfigurations/{id} (custom_modelconfigurations_id_get)
// ---------------------------------------------------------------------------
async function custom_modelconfigurations_id_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('modelconfigurations')!
  const id = decodeURIComponent(req.params.id)

  const queryStr = `
    query CustomModelConfigurationById($id: String!) {
      modelcatalog_model_configuration_by_pk(id: $id) {
        ${CONFIGURATION_FIELDS}
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables: { id } })
    const data = result.data as Record<string, unknown>
    const row = data['modelcatalog_model_configuration_by_pk'] as Record<string, unknown> | null
    if (!row) { reply.code(404).send({ error: 'Not found' }); return }
    reply.code(200).send(transformRow(row, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_modelconfigurations_id_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 9. /custom/models/standard_variable (custom_models_standard_variable_get)
// NOTE: standardvariables table does not exist yet; search by variable presentation label instead.
// ---------------------------------------------------------------------------
async function custom_models_standard_variable_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('models')!
  const { username, label } = req.query || {}

  const whereConditions: string[] = ['type: { _eq: "https://w3id.org/okn/o/sdm#Model" }']
  const variables: Record<string, unknown> = {}

  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const varDecls = username ? '($username: String!)' : ''
  const queryStr = `
    query CustomModelsStandardVariable${varDecls} {
      modelcatalog_software(where: { ${whereConditions.join(', ')} } limit: 500 offset: 0) {
        id label description user_id type
        author { id label }
        versions { id label input_variables { id label } output_variables { id label } }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables })
    const data = result.data as Record<string, unknown>
    let rows = (data['modelcatalog_software'] ?? []) as Record<string, unknown>[]

    if (label) {
      const lbl = label.toLowerCase()
      rows = rows.filter((sw: any) => {
        for (const ver of sw.versions ?? []) {
          const allVars = [...(ver.input_variables ?? []), ...(ver.output_variables ?? [])]
          if (allVars.some((v: any) => v.label?.toLowerCase().includes(lbl))) return true
        }
        return false
      })
    }

    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_models_standard_variable_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 10. /custom/datasetspecifications/{id}/datatransformations
//     (custom_datasetspecifications_id_datatransformations_get)
// TODO: datatransformations table does not exist in Hasura schema yet. Returns [].
// ---------------------------------------------------------------------------
async function custom_datasetspecifications_id_datatransformations_get(_req: any, reply: any) {
  reply.code(200).send([])
}

// ---------------------------------------------------------------------------
// 11. /custom/datasetspecifications (custom_datasetspecifications_get)
// ---------------------------------------------------------------------------
async function custom_datasetspecifications_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('datasetspecifications')!
  const { username, configurationid } = req.query || {}

  if (configurationid) {
    const cfgId = decodeURIComponent(configurationid)
    const innerVars: Record<string, unknown> = { cfgId }
    let innerDecls = '$cfgId: String!'
    if (username) { innerDecls += ', $username: String!'; innerVars['username'] = username }

    const cfgQuery = `
      query CustomDatasetSpecificationsByConfig(${innerDecls}) {
        modelcatalog_configuration_input(where: { model_configuration_id: { _eq: $cfgId } }) {
          dataset_specification { id label description has_fixed_resource format_type user_id }
        }
        modelcatalog_configuration_output(where: { model_configuration_id: { _eq: $cfgId } }) {
          dataset_specification { id label description has_fixed_resource format_type user_id }
        }
      }
    `

    try {
      const result = await readClient.query({ query: gql`${cfgQuery}`, variables: innerVars })
      const cfgData = result.data as Record<string, unknown>
      const inputSpecs = ((cfgData['modelcatalog_configuration_input'] ?? []) as any[])
        .map((r: any) => r.dataset_specification).filter(Boolean) as Record<string, unknown>[]
      const outputSpecs = ((cfgData['modelcatalog_configuration_output'] ?? []) as any[])
        .map((r: any) => r.dataset_specification).filter(Boolean) as Record<string, unknown>[]

      const seen = new Set<string>()
      const allSpecs = [...inputSpecs, ...outputSpecs].filter((spec: any) => {
        if (seen.has(spec.id)) return false
        seen.add(spec.id)
        return true
      })
      reply.code(200).send(transformList(allSpecs, resourceConfig))
    } catch (err: any) {
      req.log.error({ err }, 'custom_datasetspecifications_get (configurationid) failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
    return
  }

  const { page = 1, per_page = 25 } = req.query || {}
  const limit = parseInt(String(per_page), 10) || 25
  const offset = (parseInt(String(page), 10) - 1) * limit || 0

  const whereConditions: string[] = []
  const variables: Record<string, unknown> = { limit, offset }
  if (username) { whereConditions.push('user_id: { _eq: $username }'); variables['username'] = username }

  const whereClause = whereConditions.length > 0 ? `where: { ${whereConditions.join(', ')} }` : ''
  let varDecls = '$limit: Int!, $offset: Int!'
  if (username) varDecls += ', $username: String!'

  const listQuery = `
    query CustomDatasetSpecifications(${varDecls}) {
      modelcatalog_dataset_specification(${whereClause} limit: $limit offset: $offset) {
        id label description has_fixed_resource format_type user_id
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${listQuery}`, variables })
    const data = result.data as Record<string, unknown>
    const rows = (data['modelcatalog_dataset_specification'] ?? []) as Record<string, unknown>[]
    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_datasetspecifications_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 12. /custom/configuration/{id}/inputs (custom_configuration_id_inputs_get)
// ---------------------------------------------------------------------------
async function custom_configuration_id_inputs_get(req: any, reply: any) {
  const resourceConfig = getResourceConfig('datasetspecifications')!
  const id = decodeURIComponent(req.params.id)

  const queryStr = `
    query CustomConfigurationInputs($id: String!) {
      modelcatalog_model_configuration_by_pk(id: $id) {
        inputs {
          id label description has_fixed_resource format_type user_id
          variable_presented_as { id label }
        }
      }
    }
  `

  try {
    const result = await readClient.query({ query: gql`${queryStr}`, variables: { id } })
    const data = result.data as Record<string, unknown>
    const cfg = data['modelcatalog_model_configuration_by_pk'] as { inputs?: Record<string, unknown>[] } | null
    if (!cfg) { reply.code(404).send({ error: 'Configuration not found' }); return }
    const rows = (cfg.inputs ?? []) as Record<string, unknown>[]
    reply.code(200).send(transformList(rows, resourceConfig))
  } catch (err: any) {
    req.log.error({ err }, 'custom_configuration_id_inputs_get failed')
    reply.code(500).send({ error: 'Internal server error', details: err?.message })
  }
}

// ---------------------------------------------------------------------------
// 13. /user/login (user_login_post)
// Auth is handled externally via Keycloak. Returns 501.
// ---------------------------------------------------------------------------
async function user_login_post(_req: any, reply: any) {
  reply.code(501).send({
    error: 'Login endpoint not implemented',
    message: 'Authenticate directly with the Keycloak auth server to obtain a JWT token.',
  })
}

// ---------------------------------------------------------------------------
// Export all 13 handlers keyed by operationId
// ---------------------------------------------------------------------------
export const customHandlers: Record<string, (req: any, reply: any) => Promise<void>> = {
  custom_model_index_get,
  custom_model_intervention_get,
  custom_model_region_get,
  custom_models_variable_get,
  custom_modelconfigurationsetups_variable_get,
  custom_configurationsetups_id_get,
  custom_modelconfigurationsetups_id_get,
  custom_modelconfigurations_id_get,
  custom_models_standard_variable_get,
  custom_datasetspecifications_id_datatransformations_get,
  custom_datasetspecifications_get,
  custom_configuration_id_inputs_get,
  user_login_post,
}
