import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':address')
  async getUserByAddress(@Param('address') address: string) {
    return this.userService.findByKaspaAddress(address);
  }

  @Get(':id/stats')
  async getUserStats(@Param('id') id: string) {
    return this.userService.getUserStats(id);
  }
}
