import React, { useRef, useState } from 'react';
import { Camera, X, ZoomIn, Plus } from 'lucide-react';
import { DailyReportPhoto } from '../../types/domain';

interface ReportPhotoCaptureProps {
  reportDate: string; // YYYY-MM-DD
  photos: DailyReportPhoto[];
  onAddPhoto: (photo: DailyReportPhoto) => void;
  onRemovePhoto: (photoId: string) => void;
  currentUserId: string;
  currentUserName: string;
  readOnly?: boolean;
}

// Compress image to WebP, max 900px, quality 0.72
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.72));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ReportPhotoCapture: React.FC<ReportPhotoCaptureProps> = ({
  reportDate,
  photos,
  onAddPhoto,
  onRemovePhoto,
  currentUserId,
  currentUserName,
  readOnly = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<DailyReportPhoto | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsCompressing(true);
    try {
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const base64 = await compressImage(file);
          return {
            id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            base64,
            takenAt: new Date().toISOString(),
            takenBy: currentUserId,
            takenByName: currentUserName
          };
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          onAddPhoto(r.value);
        }
      });
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxPhoto(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxPhoto]);

  const formattedDate = new Date(reportDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <>
      <div style={{
        padding: '1rem 1.35rem',
        backgroundColor: photos.length > 0 ? '#f0fdf4' : '#fafafa',
        border: `1px solid ${photos.length > 0 ? '#bbf7d0' : '#e2e8f0'}`,
        borderRadius: 'var(--radius-lg)',
        marginBottom: '0'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: photos.length > 0 ? '0.85rem' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={17} color={photos.length > 0 ? '#059669' : '#64748b'} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: photos.length > 0 ? '#059669' : '#475569' }}>
              Photos du rapport — {formattedDate}
            </span>
            {photos.length > 0 && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#059669',
                color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '999px'
              }}>
                {photos.length} photo{photos.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                backgroundColor: '#10b981', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '0.4rem 0.85rem',
                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                opacity: isCompressing ? 0.6 : 1
              }}
            >
              <Plus size={14} />
              {isCompressing ? 'Compression...' : 'Ajouter une photo'}
            </button>
          )}
        </div>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {photos.map(photo => (
              <div
                key={photo.id}
                style={{ position: 'relative', width: '80px', height: '80px' }}
              >
                <button
                  type="button"
                  aria-label="Agrandir la photo"
                  onClick={() => setLightboxPhoto(photo)}
                  style={{
                    padding: 0, border: 'none', background: 'none', cursor: 'zoom-in',
                    display: 'block', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden'
                  }}
                >
                  <img
                    src={photo.base64}
                    alt="Rapport signé"
                    style={{
                      width: '80px', height: '80px', objectFit: 'cover',
                      border: '2px solid #bbf7d0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                    }}
                  />
                  {/* Zoom icon */}
                  <div style={{
                    position: 'absolute', bottom: '4px', left: '4px',
                    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '6px',
                    padding: '2px', display: 'flex', alignItems: 'center'
                  }}>
                    <ZoomIn size={11} color="#fff" />
                  </div>
                </button>
                {/* Delete button */}
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Supprimer la photo"
                    onClick={() => onRemovePhoto(photo.id)}
                    style={{
                      position: 'absolute', top: '-6px', right: '-6px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      backgroundColor: '#ef4444', border: '2px solid #fff',
                      color: '#fff', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: 0
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && !readOnly && (
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.5rem 0 0', fontStyle: 'italic' }}>
            Aucune photo — ajoutez la photo du rapport signé de la journée
          </p>
        )}
        {photos.length === 0 && readOnly && (
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.5rem 0 0', fontStyle: 'italic' }}>
            Aucune photo de rapport disponible pour cette journée
          </p>
        )}

        {/* Hidden file input — accepts multiple */}
        <input
          id="report-photo-input"
          aria-label="Sélectionner une ou plusieurs photos du rapport"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Agrandissement de la photo"
          onClick={() => setLightboxPhoto(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setLightboxPhoto(null); }}
          tabIndex={-1}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.88)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '95vw', maxHeight: '92vh' }}>
            <img
              src={lightboxPhoto.base64}
              alt="Rapport signé agrandi"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }}
            />
            <div style={{
              marginTop: '0.6rem', textAlign: 'center',
              color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem'
            }}>
              📷 Prise par <strong style={{ color: '#fff' }}>{lightboxPhoto.takenByName}</strong> — {new Date(lightboxPhoto.takenAt).toLocaleString('fr-FR')}
            </div>
            <button
              type="button"
              aria-label="Fermer l'aperçu"
              onClick={() => setLightboxPhoto(null)}
              style={{
                position: 'absolute', top: '-14px', right: '-14px',
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: '#ef4444', border: '2px solid #fff',
                color: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
