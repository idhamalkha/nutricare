import type { IncomingHttpHeaders } from 'node:http';
import { buildApp } from './app.js';

let appPromise: ReturnType<typeof createReadyApp> | undefined;

function createReadyApp() {
  const app = buildApp();
  return app.ready().then(() => app);
}

function getApp() {
  appPromise ??= createReadyApp();
  return appPromise;
}

export async function dispatchApiRequest(
  method: string,
  url: string,
  headers: IncomingHttpHeaders,
  payload?: string | Buffer,
) {
  if (!url.startsWith('/api/')) {
    throw new Error('Serverless handler hanya menerima path /api/.');
  }

  const requestHeaders = { ...headers };
  delete requestHeaders['content-length'];
  delete requestHeaders['transfer-encoding'];
  delete requestHeaders['accept-encoding'];
  delete requestHeaders.connection;
  delete requestHeaders.host;

  const app = await getApp();
  return app.inject({
    method: method as 'GET',
    url,
    headers: requestHeaders,
    payload,
  });
}
