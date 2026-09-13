import { parseCmsUsers, timingSafeEqual, verifyPassword } from './src/admin/lib/password-hash.js';
import usersJson from './src/data/users.json';

export const config = {
  matcher: '/admin/:path*',
};

const cmsUsers = parseCmsUsers(usersJson);

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

async function matchesMaster(user: string, password: string): Promise<boolean> {
  const expectedUser = readServerEnv('ADMIN_BASIC_AUTH_USER');
  const expectedPassword = readServerEnv('ADMIN_BASIC_AUTH_PASSWORD');

  if (!expectedUser || !expectedPassword) {
    return false;
  }

  const userOk = await timingSafeEqual(user, expectedUser);
  const passwordOk = await timingSafeEqual(password, expectedPassword);

  return userOk && passwordOk;
}

async function matchesCmsUser(user: string, password: string): Promise<boolean> {
  const record = cmsUsers.find((entry) => entry.username === user);

  if (!record) {
    return false;
  }

  try {
    return await verifyPassword(password, record.salt, record.hash);
  } catch {
    return false;
  }
}

async function isAuthorized(request: Request): Promise<boolean> {
  const parsed = parseBasicAuth(request.headers.get('Authorization'));
  const providedUser = parsed?.user ?? '';
  const providedPassword = parsed?.password ?? '';

  if (await matchesMaster(providedUser, providedPassword)) {
    return true;
  }

  return matchesCmsUser(providedUser, providedPassword);
}
