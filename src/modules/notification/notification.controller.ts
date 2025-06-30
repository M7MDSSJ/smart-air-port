<<<<<<< HEAD
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Request } from 'express';
import { Notification } from './schemas/notification.schema';
import { AuthGuard } from '@nestjs/passport';
import { RequestUser } from 'src/common/interfaces/request-user.interface';
import { Role } from 'src/common/enums/role.enum';
=======
import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './schemas/notification.schema';
import { AuthGuard } from '@nestjs/passport';
import { Role } from 'src/common/enums/role.enum';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53

@UseGuards(AuthGuard('jwt'))
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get('')
<<<<<<< HEAD
  async getNotifications(@Req() req: Request): Promise<Notification[]> {
    const user = req.user as RequestUser;

    const topic =
      Array.isArray(user.roles) && user.roles.includes(Role.Admin)
        ? 'admin'
        : user.id;
=======
  async getNotifications(@User() user: JwtUser): Promise<Notification[]> {

    const topic = Array.isArray(user.roles) && user.roles.includes(Role.Admin)? 'admin' : user.id;
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53

    return await this.notificationService.getNotifications(topic);
  }

  @Get('count')
<<<<<<< HEAD
  async getNotificationCount(@Req() req: Request): Promise<{ count: number }> {
    const user = req.user as RequestUser;

    const topic =
      Array.isArray(user.roles) && user.roles.includes(Role.Admin)
        ? 'admin'
        : user.id;
=======
  async getNotificationCount(@User() user: JwtUser): Promise<{ count: number }> {

    const topic = Array.isArray(user.roles) && user.roles.includes(Role.Admin)? 'admin' : user.id;
>>>>>>> deed8c1292e66803a57ad369fda12775a2f8ee53

    return await this.notificationService.getNotificationsCount(topic);
  }
}
