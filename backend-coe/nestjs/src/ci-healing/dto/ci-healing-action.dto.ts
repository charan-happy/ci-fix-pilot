import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CiHealingActionDto {
  @ApiPropertyOptional({
    description: 'Optional note for approve/deny/abort/human-fix action',
    example: 'Approved after manual verification of generated patch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
