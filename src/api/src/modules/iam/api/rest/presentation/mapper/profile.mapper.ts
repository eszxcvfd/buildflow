import { UserEntity } from '../../../../domain/entity/user.entity';
import { ProfileResponseDto } from '../dto/profile.dto';

export function toProfileResponse(entity: UserEntity): ProfileResponseDto {
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
