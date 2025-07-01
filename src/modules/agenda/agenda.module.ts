import { Module } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  exports: [AgendaService],
  providers: [AgendaService]
})
export class AgendaModule {}
