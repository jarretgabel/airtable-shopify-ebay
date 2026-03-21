export interface LoginResult {
  success: boolean;
  message: string;
}

export interface PasswordResetRequestResult {
  sent: boolean;
  message: string;
  resetLink?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
}

export interface CreateUserResult {
  success: boolean;
  message: string;
}
