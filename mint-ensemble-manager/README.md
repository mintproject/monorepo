# mint-ensemble-manager

Ensemble Manager for MINT

## Environment Variables

The following environment variables need to be configured:

## WARNING

Security has been activated for the API in version 6.0.0. This means that the API is now protected and requires a valid JWT to access.
If you are facing authorization issues, rollback to version 5.0.0.

### Authentication

-   `PUBLIC_KEY`: RSA public key in PEM format for JWT verification
-   `JWT_ALGORITHMS`: Comma-separated list of JWT algorithms (defaults to RS256)
-   `CLIENT_ID`: OAuth2 client ID for Swagger UI
-   `AUTHORIZATION_URL`: OAuth2 authorization URL for API documentation

### Server Configuration

-   `PORT`: Server port number (defaults to 3000)
-   `VERSION`: API version

### Redis Configuration

-   `REDIS_URL`: Redis connection URL for the job queues

## Setup

-   Configure MINT servers

```
edit src/config/config.json
```

-   Start node

```
npm start
```

-   Go to http://localhost:3000/v1/ui
