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
  generates: {
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
        },
      },
    },
  },
};

export default config;
