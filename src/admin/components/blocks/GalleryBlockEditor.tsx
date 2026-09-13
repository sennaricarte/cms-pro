import type { BlockEditorProps, GalleryBlockData } from '../../lib/page-blocks';
import ImagePickerField from '../ImagePickerField';
import BlockChrome from './BlockChrome';

export default function GalleryBlockEditor({
  token,
  data,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  disabled = false,
  errors = {},
}: BlockEditorProps<GalleryBlockData>) {
  function updateImage(index: number, src: string, alt: string) {
    onChange({
      ...data,
      images: data.images.map((image, current) => (current === index ? { src, alt } : image)),
    });
  }

  function removeImage(index: number) {
    onChange({
      ...data,
      images: data.images.filter((_, current) => current !== index),
    });
  }

  return (
    <BlockChrome
      title="Galeria"
      isFirst={isFirst}
      isLast={isLast}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      disabled={disabled}
    >
      {errors.images ? <p class="admin-field__error">{errors.images}</p> : null}

      <ul class="admin-gallery-list">
        {data.images.map((image, index) => (
          <li key={`gallery-image-${index}`} class="admin-gallery-item">
            <ImagePickerField
              token={token}
              label={`Imagem ${index + 1}`}
              value={image.src}
              altValue={image.alt}
              required
              disabled={disabled}
              error={errors[`images.${index}`]}
              onChange={({ path, alt }) => updateImage(index, path, alt)}
            />
            <button
              type="button"
              class="admin-button admin-button--ghost"
              disabled={disabled}
              onClick={() => removeImage(index)}
            >
              Remover imagem
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        class="admin-button admin-button--ghost"
        disabled={disabled}
        onClick={() => onChange({ ...data, images: [...data.images, { src: '', alt: '' }] })}
      >
        Adicionar imagem
      </button>
    </BlockChrome>
  );
}
