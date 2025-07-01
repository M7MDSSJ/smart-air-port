import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agenda } from 'agenda';
import { NotificationData } from 'src/modules/notification/notification.model';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AgendaService implements OnModuleInit, OnModuleDestroy {


  private agenda: Agenda;


  constructor(
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService
  ) {}




  async onModuleInit() {
    this.agenda = new Agenda({
      db: { address: this.config.get<string>('MONGO_URI') }
    });

    this.agenda.define('send-notification', async (job) => {
      const notificationData = job.attrs.data.data;
      await this.notificationService.sendNotification(notificationData);
      await this.notificationService.saveNotification(notificationData);
    });

    await this.agenda.start();
  }


  
  async scheduleNotification(data: NotificationData) {

    const targetDate = new Date(data.departureDate);
    const now = new Date();

    // Calculate the time to run: 1 day before the target date
    const runAt = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

    // Calculate the delay in minutes from now
    let delayInMinutes = Math.floor((runAt.getTime() - now.getTime()) / (1000 * 60));

    // If it's in the past or too close, fallback to 5 minutes from now
    if(delayInMinutes <= 0) delayInMinutes = 5;
    console.log(delayInMinutes)

    // Schedule the job using minutes
    await this.agenda.schedule(`${delayInMinutes} minutes`, 'send-notification', { data });

  }



  async onModuleDestroy() {
    await this.agenda.stop();
  }
  
}