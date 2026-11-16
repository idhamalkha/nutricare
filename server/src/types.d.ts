// Type definitions untuk Fastify
import 'fastify';
import { AuthUser } from './auth/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}
