import { LoginOutput } from '../../../../application/use-case/login.use-case';
import { LoginResponseDto } from '../dto/login.dto';

export function toLoginResponse(output: LoginOutput): LoginResponseDto {
  return {
    accessToken: output.accessToken,
    expiresAt: output.expiresAt.toISOString(),
    user: output.user,
    roles: output.roles,
    projectIds: output.projectIds,
  };
}
