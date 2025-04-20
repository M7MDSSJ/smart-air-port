import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';

export class BaggageSelectionDto {
  @ApiProperty({ 
    enum: ['CARRY_ON', 'CHECKED', 'PERSONAL_ITEM'],
    example: 'CHECKED'
  })
  @IsIn(['CARRY_ON', 'CHECKED', 'PERSONAL_ITEM'])
  type: 'CARRY_ON' | 'CHECKED' | 'PERSONAL_ITEM';

  @ApiProperty({ 
    minimum: 1,
    example: 1
  })
  @IsInt()
  @Min(1)
  quantity: number = 1;
}
