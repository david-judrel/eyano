export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role?: string;
  status?: string;
  createdAt?: Date;
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
}
