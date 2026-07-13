import { useEffect, useRef, useState } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { resizeImageFile, resizeImageFileToThumb, buildBeforeAfterCollage } from '@/lib/progress-photos';

interface PhotoMeta {
  id: string;
  thumb_data: string;
  taken_at: string;
}

const MAX_PHOTOS = 20;

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function ProgressPhotosSection() {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]); // до двух id для сравнения
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  const [buildingCollage, setBuildingCollage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ photos: PhotoMeta[] }>('/profile-photos');
      setPhotos(res.photos || []);
    } catch {
      setError('Не удалось загрузить фото');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPhotos(); }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      setError(`Можно хранить не больше ${MAX_PHOTOS} фото`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const [image_data, thumb_data] = await Promise.all([
        resizeImageFile(file),
        resizeImageFileToThumb(file),
      ]);
      await apiFetch('/profile-photos', { method: 'POST', body: { image_data, thumb_data } });
      await loadPhotos();
    } catch {
      setError('Не получилось загрузить фото, попробуйте ещё раз');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (id: string) => {
    try {
      await apiFetch(`/profile-photos/${id}`, { method: 'DELETE' });
      setSelected(sel => sel.filter(s => s !== id));
      setPhotos(prev => prev.filter(p => p.id !== id));
    } catch {
      setError('Не получилось удалить фото');
    }
  };

  const toggleSelect = (id: string) => {
    setCollageUrl(null);
    setSelected(sel => {
      if (sel.includes(id)) return sel.filter(s => s !== id);
      if (sel.length >= 2) return [sel[1], id];
      return [...sel, id];
    });
  };

  const makeCollage = async () => {
    if (selected.length !== 2) return;
    setBuildingCollage(true);
    setError(null);
    try {
      // сравнение всегда идёт в хронологическом порядке — раньше выбранное слева
      const sorted = [...photos].filter(p => selected.includes(p.id));
      const [first, second] = sorted; // photos уже отсортированы по дате по возрастанию
      const [fullFirst, fullSecond] = await Promise.all([
        apiFetch<{ image_data: string }>(`/profile-photos/${first.id}/image`),
        apiFetch<{ image_data: string }>(`/profile-photos/${second.id}/image`),
      ]);
      const url = await buildBeforeAfterCollage(
        fullFirst.image_data,
        fullSecond.image_data,
        fmtDate(first.taken_at),
        fmtDate(second.taken_at)
      );
      setCollageUrl(url);
    } catch {
      setError('Не получилось собрать коллаж, попробуйте ещё раз');
    } finally {
      setBuildingCollage(false);
    }
  };

  return (
    <div className="inga-card mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-muted-foreground">Фото прогресса</div>
        <span className="text-[11px] text-muted-foreground">{photos.length}/{MAX_PHOTOS}</span>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Загрузка…</div>
      ) : (
        <>
          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground mb-3">
              Загружайте фото время от времени — потом сможете собрать коллаж «было / стало».
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Выберите два фото, чтобы сравнить — {selected.length}/2
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {photos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className="relative rounded-xl overflow-hidden aspect-square"
                    style={{
                      outline: selected.includes(p.id) ? '3px solid var(--primary, #FF6200)' : 'none',
                      outlineOffset: '-3px',
                    }}
                  >
                    <img src={p.thumb_data} alt={fmtDate(p.taken_at)} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] py-0.5 text-center">
                      {fmtDate(p.taken_at)}
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); deletePhoto(p.id); }}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center"
                    >
                      <X size={10} className="text-white" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {selected.length === 2 && (
            <button
              onClick={makeCollage}
              disabled={buildingCollage}
              className="inga-btn-secondary w-full mb-3 flex items-center justify-center gap-2"
            >
              <ImageIcon size={14} />
              {buildingCollage ? 'Собираю коллаж…' : 'Собрать коллаж «было / стало»'}
            </button>
          )}

          {collageUrl && (
            <div className="mb-3">
              <img src={collageUrl} alt="Коллаж до и после" className="w-full rounded-xl mb-2" />
              <a
                href={collageUrl}
                download="progress-collage.jpg"
                className="inga-btn-primary w-full block text-center"
              >
                Скачать коллаж
              </a>
            </div>
          )}

          {error && <p className="text-xs text-destructive mb-2">{error}</p>}

          <label className="flex items-center justify-center gap-2 cursor-pointer inga-btn-secondary w-full">
            <Camera size={14} />
            {uploading ? 'Загружаю…' : 'Добавить фото'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
              disabled={uploading || photos.length >= MAX_PHOTOS}
            />
          </label>
        </>
      )}
    </div>
  );
}
