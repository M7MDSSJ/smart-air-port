import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './schemas/notification.schema';
import { AuthGuard } from '@nestjs/passport';
import { Role } from 'src/common/enums/role.enum';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@UseGuards(AuthGuard('jwt'))
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get('')
  async getNotifications(@User() user: JwtUser): Promise<Notification[]> {

    const topic = Array.isArray(user.roles) && user.roles.includes(Role.Admin)? 'admin' : user.id;

    return await this.notificationService.getNotifications(topic);
  }

  @Get('count')
  async getNotificationCount(@User() user: JwtUser): Promise<{ count: number }> {

    const topic = Array.isArray(user.roles) && user.roles.includes(Role.Admin)? 'admin' : user.id;

    return await this.notificationService.getNotificationsCount(topic);
  }
}
