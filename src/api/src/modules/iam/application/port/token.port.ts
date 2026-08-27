export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  projectIds?: string[];
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPort {
  sign(payload: TokenPayload): Promise<{ token: string; expiresAt: Date }>;
  verify(token: string): Promise<TokenPayload>;
}

export const TOKEN_PORT = Symbol('TOKEN_PORT');
