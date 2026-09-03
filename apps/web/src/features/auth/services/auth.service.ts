"use client";

import { loginRequest, type LoginError } from '@/lib/api/auth';
import { saveAuth, type StoredAuth } from '@/lib/auth/storage';

export async function loginAndPersist(email: string, password: string): Promise<StoredAuth> {
  try {
    const result = await loginRequest({ email: email.trim(), password });
    saveAuth(result);
    return result;
  } catch (e) {
    throw e as LoginError;
  }
}
