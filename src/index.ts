import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './schema/typeDefs';
import { resolvers, formatError } from './resolvers';
import { config } from './config';

/**
 * GraphQL context type — import this in resolvers that need access to the
 * Express request (e.g., for authentication headers in the future).
 */
export interface AppContext {
  req: express.Request;
}

/**
 * Creates and configures the Apollo Server + Express app.
 * Exported as a factory function so integration tests can create
 * a fresh instance per test suite without starting a real HTTP server.
 */
export async function createApp(): Promise<express.Application> {
  const app = express();
  app.use(express.json());

  const server = new ApolloServer<AppContext>({
    typeDefs,
    resolvers,
    formatError,
    // Introspection lets clients (Apollo Sandbox, Postman) discover the schema.
    // Disable in production if the schema should remain private.
    introspection: config.isDevelopment,
  });

  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }): Promise<AppContext> => ({ req }),
    }),
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

/**
 * Bootstrap the HTTP server.
 * Only runs when this file is executed directly (not during tests).
 */
async function bootstrap(): Promise<void> {
  const app = await createApp();

  app.listen(config.port, () => {
    console.info(`🚀 Travel Planner API ready at http://localhost:${config.port}/graphql`);
    console.info(`❤️  Health check at http://localhost:${config.port}/health`);
  });
}

// Only start the HTTP server when this file is the entry point.
// When imported by tests, createApp() is used directly via Supertest.
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
