import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: [
    {
      [process.env.HASURA_ENDPOINT ?? 'https://graphql.mint.isi.edu/v1/graphql']: {
        headers: {
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET ?? '',
        },
      },
    },
  ],
  documents: 'src/graphql/**/*.graphql',
  ignoreNoDocuments: true,
  generates: {
    // SDL snapshot of the Hasura schema, committed so offline tests can resolve
    // the type of every selection set (see junction-key-fields.test.ts) without
    // needing a reachable Hasura.
    'src/graphql/generated/schema.graphql': {
      plugins: ['schema-ast'],
    },
    'src/graphql/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        scalars: {
          uuid: 'string',
          timestamptz: 'string',
          jsonb: 'unknown',
          // Hasura returns `_text` as a JSON array on read, but on write it expects
          // a Postgres array-literal string (see toPgTextArray in mutation-builder).
          _text: { input: 'string', output: 'string[]' },
        },
      },
    },
  },
};

export default config;
