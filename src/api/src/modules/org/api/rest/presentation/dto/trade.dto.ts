import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export type TradeStatusValue = 'ACTIVE' | 'INACTIVE';
export type TradeStatusFilterValue = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface TradeWriteFields {
  code: string;
  name: string;
  description?: string | null;
  status: TradeStatusValue;
}

export interface TradeResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: TradeStatusValue;
  assignable: boolean;
  createdAt: string;
  updatedAt: string;
  warning?: string;
}

export class CreateTradeDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã ngành nghề không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên ngành nghề không được để trống' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status?: TradeStatusValue;
}

export class UpdateTradeDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status?: TradeStatusValue;
}

export class ChangeTradeStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status!: TradeStatusValue;
}
