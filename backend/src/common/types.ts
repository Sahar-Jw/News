import { Request } from 'express';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  roleId: number;
  permissions: Set<string>;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
