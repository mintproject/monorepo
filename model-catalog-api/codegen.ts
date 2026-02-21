import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: [
    {
      [process.env.HASURA_GRAPHQL_URL || 'http://localhost:8080/v1/graphql']: {
        headers: {
          'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey',
        },
      },
    },
  ],
  documents: 'src/hasura/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-document-nodes',
      ],
    },
  },
}

export default config
