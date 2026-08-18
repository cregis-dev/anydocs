import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@anydocs/cloud-core/auth';

// Better Auth server handler for the Cloud Team Edition.
// getAuth() is called PER REQUEST (not at module load) so importing this route does not
// open a DB connection or require DATABASE_URL at build time — the lazy contract from c1-0.
export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
