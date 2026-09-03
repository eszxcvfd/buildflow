import type { LoginOutput } from '../../../../application/use-case/login.use-case';

export function toLoginResponse(output: LoginOutput) {
  return {
    accessToken: output.accessToken,
    expiresAt: output.expiresAt.toISOString(),
    user: output.user,
    roles: output.roles,
    projectIds: output.projectIds,
  };
}
