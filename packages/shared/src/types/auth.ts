import type { Role } from '../constants/roles';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  siteId: string;
  corporateId: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'createdAt'>;
}

export interface TokenPayload {
  sub: string;       // user id
  email: string;
  role: Role;
  siteId: string;
  corporateId: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  siteId: string;
}
