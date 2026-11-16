import { dispatchApiRequest } from '../../server/dist/src/serverless-adapter.js';

function apiUrl(event) {
  const requestUrl = new URL(event.rawUrl || event.path || '/api/', 'https://nutricare.invalid');
  let pathname = requestUrl.pathname;
  const functionPrefix = '/.netlify/functions/api';

  if (pathname.startsWith(functionPrefix)) {
    pathname = `/api${pathname.slice(functionPrefix.length)}`;
  } else if (!pathname.startsWith('/api/')) {
    pathname = `/api/${pathname.replace(/^\/+/, '')}`;
  }

  return `${pathname}${requestUrl.search}`;
}

function isTextResponse(contentType = '') {
  return contentType.startsWith('text/')
    || contentType.includes('json')
    || contentType.includes('javascript')
    || contentType.includes('xml');
}

export async function handler(event) {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const payload = event.body
    ? (event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body)
    : undefined;
  const response = await dispatchApiRequest(
    event.httpMethod || 'GET',
    apiUrl(event),
    headers,
    payload,
  );
  const responseHeaders = {};
  const multiValueHeaders = {};

  for (const [name, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) multiValueHeaders[name] = value;
    else if (value !== undefined) responseHeaders[name] = String(value);
  }

  const contentType = String(response.headers['content-type'] || '');
  const rawBody = response.rawPayload;
  const binary = rawBody.length > 0 && !isTextResponse(contentType);

  return {
    statusCode: response.statusCode,
    headers: responseHeaders,
    multiValueHeaders,
    body: binary ? rawBody.toString('base64') : rawBody.toString('utf8'),
    isBase64Encoded: binary,
  };
}
