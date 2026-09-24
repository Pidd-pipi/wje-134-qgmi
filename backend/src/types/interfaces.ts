import { UserRole } from './enums';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  name?: string;
}

export interface RequestContext {
  requestId: string;
  ip: string;
  user?: AuthenticatedUser;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  requestId?: string;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  name?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    requestId?: string;
  }
}
