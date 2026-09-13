import { useId, useState } from 'preact/hooks';
import MediaAuthGate from './MediaAuthGate';
import MediaLibrary from './MediaLibrary';

export interface ImagePickerChange {
  url: string;
  alt: string;
}

interface Props {
  label: string;
  value: string;
  altValue: string;
  onChange: (next: ImagePickerChange) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  showAlt?: boolean;
}

export default function ImagePickerField({
  label,
  value,
  altValue,
  onChange,
  required = false,
  error,
  disabled = false,
  showAlt = true,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fieldId = useId();
  const invalid = Boolean(error);

  return (
    <div class={`admin-field admin-image-picker${invalid ? ' admin-field--invalid' : ''}`}>
      <span id={`${fieldId}-label`}>
        {label}
        {required ? ' *' : ''}
      </span>

      {value ? (
        <div class="admin-media-picked">
          <img src={value} alt={altValue || 'Imagem selecionada'} />
          <p class="admin-field__hint">{value}</p>
        </div>
      ) : (
        <p class="admin-field__hint">Nenhuma imagem selecionada.</p>
      )}

      <div class="admin-list__actions">
        <button
          type="button"
          class="admin-button admin-button--ghost"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          aria-labelledby={`${fieldId}-label`}
        >
          Escolher da Biblioteca
        </button>
        {value || altValue ? (
          <button
            type="button"
            class="admin-button admin-button--ghost"
            onClick={() => onChange({ url: '', alt: '' })}
            disabled={disabled}
          >
            Remover imagem
          </button>
        ) : null}
      </div>

      {showAlt ? (
        <>
          <label htmlFor={`${fieldId}-alt`}>Texto alternativo{required ? ' *' : ''}</label>
          <input
            id={`${fieldId}-alt`}
            type="text"
            value={altValue}
            onInput={(event) => onChange({ url: value, alt: (event.target as HTMLInputElement).value })}
            disabled={disabled}
            required={required}
          />
        </>
      ) : null}

      {error ? <p class="admin-field__error">{error}</p> : null}

      {pickerOpen ? (
        <div class="admin-media-picker" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-picker-title`}>
          <div class="admin-media-picker__panel">
            <div class="admin-editor__header">
              <h2 id={`${fieldId}-picker-title`}>Biblioteca de mídia</h2>
              <button type="button" class="admin-button admin-button--ghost" onClick={() => setPickerOpen(false)}>
                Fechar
              </button>
            </div>
            <MediaAuthGate>
              <MediaLibrary
                selectMode
                onSelect={(item) => {
                  onChange({
                    url: item.url,
                    alt: altValue.trim() ? altValue : item.alt,
                  });
                  setPickerOpen(false);
                }}
              />
            </MediaAuthGate>
          </div>
        </div>
      ) : null}
    </div>
  );
}
