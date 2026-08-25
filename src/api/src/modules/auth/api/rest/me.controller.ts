import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BearerAuthGuard, AuthenticatedUser } from '../guard/bearer-auth.guard';
import { CurrentUser } from '../decorator/current-user.decorator';

@ApiTags('auth')
@Controller('api/v1')
export class MeController {
  @Get('me')
  @UseGuards(BearerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
