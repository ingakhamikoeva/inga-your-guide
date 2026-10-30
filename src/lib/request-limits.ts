import { ApiError } from './api-client';

export const DIARY_AI_LIMIT_MESSAGE = 'Достигнут лимит запросов к ИИ. Попробуйте позже. Ваши записи сохранены.';
export const RESET_LIMIT_MESSAGE = 'Слишком много запросов на восстановление пароля. Попробуйте позже. Если письмо уже пришло, воспользуйтесь ссылкой в нём.';

export function isAiLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429 &&
    typeof error.body === 'object' && error.body !== null &&
    'error' in error.body && error.body.error === 'ai_limit';
}
