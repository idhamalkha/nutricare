import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchApiRequest } from '../server/dist/src/serverless-adapter.js';

type VercelRequest = IncomingMessage & { body?: unknown };
type VercelResponse = ServerResponse;

async function getPayload(req: VercelRequest): Promise<string | Buffer | undefined> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
    return JSON.stringify(req.body);
  }

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await dispatchApiRequest(
      req.method || 'GET',
      req.url || '/api/',
      req.headers,
      await getPayload(req),
    );

    res.statusCode = response.statusCode;
    for (const [name, value] of Object.entries(response.headers)) {
      if (value !== undefined) res.setHeader(name, value as string | number | readonly string[]);
    }
    res.end(response.rawPayload);
  } catch (error) {
    console.error('Kesalahan fungsi API NutriCare:', error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ message: 'Terjadi kesalahan pada server.' }));
  }
}
