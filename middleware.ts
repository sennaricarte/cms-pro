export const config = {
  matcher: '/admin/:path*',
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (await isAuthorized(request)) {
    // Sem Response: o Edge da Vercel segue e serve o estático de /admin.
    return;
  }

  return new Response('Autenticação necessária.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin"',
      'Cache-Control': 'no-store',
    },
  });
}

function readServerEnv(name: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[name] ?? '';
}

async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;

  for (let i = 0; i < leftBytes.length; i++) {
    mismatch |= leftBytes[i] ^ rightBytes[i];
  }

  return mismatch === 0;
}

function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header) {
    return null;
  }

  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    return null;
  }

  let decoded: string;

  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(':');

  if (separator === -1) {
    return null;
  }

  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

async function isAuthorized(request: Request): Promise<boolean> {
  const expectedUser = readServerEnv('ADMIN_BASIC_AUTH_USER');
  const expectedPassword = readServerEnv('ADMIN_BASIC_AUTH_PASSWORD');
  const parsed = parseBasicAuth(request.headers.get('Authorization'));

  const providedUser = parsed?.user ?? '';
  const providedPassword = parsed?.password ?? '';

  const userOk = await timingSafeEqual(providedUser, expectedUser);
  const passwordOk = await timingSafeEqual(providedPassword, expectedPassword);

  return Boolean(expectedUser && expectedPassword && userOk && passwordOk);
}
