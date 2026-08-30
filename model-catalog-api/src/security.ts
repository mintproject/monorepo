/**
 * Security handlers for fastify-openapi-glue.
 *
 * fastify-openapi-glue calls the appropriate security handler method
 * when a route has a security requirement defined in the OpenAPI spec.
 * The OpenAPI spec uses BearerAuth as the security scheme name.
 *
 * Note: We do NOT validate the JWT here -- Hasura validates it.
 * The token is forwarded to Hasura via getWriteClient(authHeader)
 * which performs the actual auth check via row-level permissions.
 * If the token is invalid, Hasura will return a permission error.
 */

export const SecurityHandler = {
  async BearerAuth(req: any, _reply: any, _params: any[]) {
    const authHeader = req.headers?.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Missing or invalid Authorization header') as any
      err.statusCode = 401
      throw err
    }
    // Store the bearer token on the request for later use by service handlers
    req.bearerToken = authHeader.replace('Bearer ', '')
  },
}
