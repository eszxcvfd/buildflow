export interface HasherPort {
  compare(plain: string, hash: string): Promise<boolean>;
}

export const HASHER_PORT = Symbol('HASHER_PORT');
