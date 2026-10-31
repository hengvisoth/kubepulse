import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Replaces a next.config.js rewrite: rewrites are frozen into the image at build time,
// so the INTERNAL_BACKEND_URL set by Kubernetes/Compose at runtime would be ignored.
async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://localhost:5000';
  const target = new URL(`${backendUrl}/${params.path.join('/')}`);
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  headers.delete('host');

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    });

    // fetch already decoded the body, so these would no longer match it
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (err) {
    return Response.json(
      { error: 'Backend unreachable', target: target.origin, message: (err as Error).message },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
