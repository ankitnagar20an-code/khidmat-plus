import { createUserClient } from './supabase-client.ts';

export interface AuthUser {
  id: string;
  role: string;
  email?: string;
  phone?: string;
}

/**
 * Extract and verify the authenticated user from the request.
 * Returns the user info or throws.
 */
export async function requireAuth(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('Missing Authorization header', 401);
  }

  const supabase = createUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Invalid or expired token', 401);
  }

  return {
    id: user.id,
    role: user.app_metadata?.role ?? 'customer',
    email: user.email,
    phone: user.phone,
  };
}

/**
 * Require the user to have a specific role.
 */
export async function requireRole(req: Request, ...roles: string[]): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new AuthError(`Requires role: ${roles.join(' or ')}`, 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
