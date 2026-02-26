import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const providers = ['github', 'gitlab', 'jenkins', 'generic'] as const;

export class CreateCiHealingWebhookDto {
  @ApiProperty({ example: 'github' })
  @IsString()
  @IsIn(providers)
  provider!: (typeof providers)[number];

  @ApiProperty({ example: 'owner/repo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  repository!: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  branch!: string;

  @ApiProperty({ example: 'abc123def456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  commitSha!: string;

  @ApiPropertyOptional({ example: 'https://github.com/org/repo/actions/runs/1' })
  @IsOptional()
  @IsUrl()
  pipelineUrl?: string;

  @ApiPropertyOptional({ example: 'type_error' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorType?: string;

  @ApiProperty({ example: "TS2339: Property 'username' does not exist on type 'CreateUserDto'" })
  @IsString()
  @IsNotEmpty()
  errorLog!: string;
}
