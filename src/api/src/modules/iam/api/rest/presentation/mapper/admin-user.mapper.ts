import { UserEntity } from '../../../../domain/entity/user.entity';
import { AdminUserResponseDto } from '../dto/admin-user.dto';

export function toAdminUserResponse(entity: UserEntity): AdminUserResponseDto {
  const pub = entity.toPublicProfile();
  return {
    id: pub.id,
    email: pub.email,
    fullName: pub.fullName,
    phone: pub.phone,
    avatarUrl: pub.avatarUrl,
    employeeCode: pub.employeeCode,
    userType: pub.userType,
    contractorId: pub.contractorId,
    status: pub.status,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
}

export function toAdminUserListResponse(entities: UserEntity[]): AdminUserResponseDto[] {
  return entities.map(toAdminUserResponse);
}
