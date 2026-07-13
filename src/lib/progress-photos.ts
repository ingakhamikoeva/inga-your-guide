// Утилиты для раздела «Фото» в профиле: сжатие перед загрузкой и коллаж «до / после».

// Сжимает выбранное фото до разумного размера перед отправкой на сервер
// (храним base64 в Postgres, поэтому важно не грузить мегабайты).
export function resizeImageFile(file: File, maxSide = 1000, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else if (height >= width && height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas_failed'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// Отдельная маленькая версия для галереи (генерируется из уже загруженного File, параллельно с полной).
export function resizeImageFileToThumb(file: File, maxSide = 220, quality = 0.75): Promise<string> {
  return resizeImageFile(file, maxSide, quality);
}

// Собирает коллаж «Было / Стало» из двух фото (data URL) в одну картинку рядом, с подписями и датами.
export function buildBeforeAfterCollage(
  beforeSrc: string,
  afterSrc: string,
  beforeLabel: string,
  afterLabel: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('collage_decode_failed'));
        im.src = src;
      });

    Promise.all([loadImg(beforeSrc), loadImg(afterSrc)])
      .then(([imgBefore, imgAfter]) => {
        const panelW = 480;
        const panelH = 640;
        const labelH = 64;
        const gap = 4;
        const canvas = document.createElement('canvas');
        canvas.width = panelW * 2 + gap;
        canvas.height = panelH + labelH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas_failed'));

        ctx.fillStyle = '#FAF5F0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const drawCover = (img: HTMLImageElement, x: number) => {
          const scale = Math.max(panelW / img.width, panelH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const dx = x + (panelW - w) / 2;
          const dy = labelH + (panelH - h) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, labelH, panelW, panelH);
          ctx.clip();
          ctx.drawImage(img, dx, dy, w, h);
          ctx.restore();
        };

        drawCover(imgBefore, 0);
        drawCover(imgAfter, panelW + gap);

        ctx.fillStyle = '#2C1A0E';
        ctx.font = '600 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(beforeLabel, panelW / 2, 42);
        ctx.fillText(afterLabel, panelW + gap + panelW / 2, 42);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      })
      .catch(reject);
  });
}
