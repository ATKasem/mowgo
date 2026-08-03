import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useRef } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { uploadJobPhoto } from '../lib/data';

/**
 * Photo upload widget for job before/after photos.
 * @param {object} props
 * @param {string} props.jobId
 * @param {'before'|'after'} props.type - photo type
 * @param {string|null} props.existingUrl - URL if photo already uploaded
 * @param {Function} props.onUploaded - callback with new URL after upload
 */
export default function PhotoUpload({ jobId, type, existingUrl, onUploaded }) {
  const { tr } = useLocalizedText('today');
  const [preview, setPreview] = useState(existingUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const label = type === 'before' ? tr('Before') : tr('After');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);
    setUploading(true);

    try {
      const url = await uploadJobPhoto(jobId, file, type);
      onUploaded?.(url);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(tr('Failed to upload photo'));
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onUploaded?.(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] uppercase tracking-wide">
        {label}
      </span>

      {preview ? (
        <div className="relative group">
          <img
            src={preview}
            alt={`${label} photo`}
            className="w-full h-28 object-cover rounded-lg border border-[var(--color-border)] dark:border-gray-700"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove ${label} photo`}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-28 rounded-lg border-2 border-dashed border-[var(--color-border)] dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:border-brand dark:hover:border-emerald-500 hover:text-brand dark:hover:text-emerald-400 transition-colors"
        >
          <Camera className="w-5 h-5" />
          <span className="text-xs font-medium">{tr('Take Photo')}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        aria-label={`${label} photo upload`}
      />

      {error && (
        <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
