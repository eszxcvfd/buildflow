// Public feature interface per docs/architecture/WEB.md §5
export { LoginForm } from './components/LoginForm';
export { validateLogin } from './schemas/login.schema';
export { loginAndPersist, logoutAndClear } from './services/auth.service';
export type { LoginFormValues } from './types/auth';
