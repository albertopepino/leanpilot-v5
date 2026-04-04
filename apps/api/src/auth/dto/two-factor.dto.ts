import { IsString, Length } from 'class-validator';

export class TwoFactorTokenDto {
  @IsString()
  @Length(6, 6, { message: '2FA token must be exactly 6 digits' })
  token: string;
}

export class TwoFactorVerifyDto {
  @IsString()
  tempToken: string;

  @IsString()
  @Length(6, 6, { message: '2FA token must be exactly 6 digits' })
  token: string;
}
