export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  projectIds: string[];
}

export interface TokenPort {
  sign(payload: TokenPayload): Promise<{ token: string; expiresAt: Date }>;
}

export const TOKEN_PORT = Symbol('TOKEN_PORT');
