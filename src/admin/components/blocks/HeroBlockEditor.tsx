import type { BlockEditorProps, HeroBlockData } from '../../lib/page-blocks';
import ImagePickerField from '../ImagePickerField';
import BlockChrome from './BlockChrome';

export default function HeroBlockEditor({
  data,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  disabled = false,
  errors = {},
  idPrefix = 'hero',
}: BlockEditorProps<HeroBlockData>) {
  const hasCta = Boolean(data.cta);

  return (
    <BlockChrome
      title="Hero"
      isFirst={isFirst}
      isLast={isLast}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      disabled={disabled}
    >
      <div class="admin-field">
        <label htmlFor={`${idPrefix}-heading`}>Título</label>
        <input
          id={`${idPrefix}-heading`}
          type="text"
          value={data.heading}
          onInput={(event) => onChange({ ...data, heading: (event.target as HTMLInputElement).value })}
          disabled={disabled}
          required
        />
        {errors.heading ? <p class="admin-field__error">{errors.heading}</p> : null}
      </div>

      <div class="admin-field">
        <label htmlFor={`${idPrefix}-subheading`}>Subtítulo (opcional)</label>
        <input
          id={`${idPrefix}-subheading`}
          type="text"
          value={data.subheading ?? ''}
          onInput={(event) => {
            const value = (event.target as HTMLInputElement).value;
            onChange({ ...data, subheading: value || undefined });
          }}
          disabled={disabled}
        />
      </div>

      <ImagePickerField
        label="Imagem"
        value={data.image}
        altValue=""
        showAlt={false}
        required
        disabled={disabled}
        error={errors.image}
        onChange={({ url }) => onChange({ ...data, image: url })}
      />

      <label class="admin-checkbox">
        <input
          type="checkbox"
          checked={hasCta}
          disabled={disabled}
          onChange={(event) => {
            const checked = (event.target as HTMLInputElement).checked;
            onChange({
              ...data,
              cta: checked ? data.cta ?? { label: '', href: '' } : undefined,
            });
          }}
        />
        Incluir botão de ação
      </label>

      {hasCta && data.cta ? (
        <>
          <div class="admin-field">
            <label htmlFor={`${idPrefix}-cta-label`}>Rótulo do botão</label>
            <input
              id={`${idPrefix}-cta-label`}
              type="text"
              value={data.cta.label}
              onInput={(event) =>
                onChange({
                  ...data,
                  cta: { ...data.cta!, label: (event.target as HTMLInputElement).value },
                })
              }
              disabled={disabled}
              required
            />
            {errors['cta.label'] ? <p class="admin-field__error">{errors['cta.label']}</p> : null}
          </div>
          <div class="admin-field">
            <label htmlFor={`${idPrefix}-cta-href`}>Link do botão</label>
            <input
              id={`${idPrefix}-cta-href`}
              type="text"
              value={data.cta.href}
              onInput={(event) =>
                onChange({
                  ...data,
                  cta: { ...data.cta!, href: (event.target as HTMLInputElement).value },
                })
              }
              disabled={disabled}
              required
              spellCheck={false}
            />
            {errors['cta.href'] ? <p class="admin-field__error">{errors['cta.href']}</p> : null}
          </div>
        </>
      ) : null}
    </BlockChrome>
  );
}
