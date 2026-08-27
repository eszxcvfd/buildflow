export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginViewState {
  loading: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
}
