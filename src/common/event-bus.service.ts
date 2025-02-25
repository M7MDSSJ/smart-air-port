import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class EventBus implements OnModuleInit {
  private eventEmitter = new EventEmitter();

  publish(event: string, data: any): void {
    this.eventEmitter.emit(event, data);
  }

  subscribe(event: string, listener: (data: any) => void): void {
    this.eventEmitter.on(event, listener);
  }

  onModuleInit() {
    // Optionally, configure event emitter (max listeners, etc.)
    this.eventEmitter.setMaxListeners(20);
  }
}
