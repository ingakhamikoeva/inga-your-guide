// Ловим UTM-метки, если пользователь пришёл по ссылке с лендинга
// (app.legche.online/register?utm_source=vk&...), и сохраняем их до
// момента регистрации — пользователь может полистать приложение до того,
// как заполнит форму.

const STORAGE_KEY = 'inga_utm';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type UtmData = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

// Вызывать один раз при загрузке приложения (см. main.tsx).
// Если в URL есть хотя бы одна utm_-метка — перезаписывает то, что было
// сохранено раньше (последний переход считается актуальным источником).
export function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const data: UtmData = {};
    let found = false;
    for (const key of UTM_PARAMS) {
      const value = params.get(key);
      if (value) {
        data[key] = value;
        found = true;
      }
    }
    if (found) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично
  }
}

// Вызывать при отправке формы регистрации.
export function getStoredUtm(): UtmData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Вызывать после успешной регистрации, чтобы метка не «прилипла»
// к следующему пользователю на этом же устройстве.
export function clearStoredUtm(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
