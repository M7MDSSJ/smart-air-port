import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';

Public()
@Controller('health')
export class HealthController {
  @Get()
  testApp(){

    return 'GG Got Hacked'
  }
}
