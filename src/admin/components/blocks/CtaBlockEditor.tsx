import type { BlockEditorProps, CtaBlockData } from '../../lib/page-blocks';
import BlockChrome from './BlockChrome';

export default function CtaBlockEditor({
  data,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  disabled = false,
  errors = {},
  idPrefix = 'cta',
}: BlockEditorProps<CtaBlockData>) {
  return (
    <BlockChrome
      title="CTA"
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
        <label htmlFor={`${idPrefix}-body`}>Texto (opcional)</label>
        <textarea
          id={`${idPrefix}-body`}
          class="admin-textarea"
          rows={3}
          value={data.body ?? ''}
          onInput={(event) => {
            const value = (event.target as HTMLTextAreaElement).value;
            onChange({ ...data, body: value || undefined });
          }}
          disabled={disabled}
        />
      </div>

      <div class="admin-field">
        <label htmlFor={`${idPrefix}-button-label`}>Rótulo do botão</label>
        <input
          id={`${idPrefix}-button-label`}
          type="text"
          value={data.buttonLabel}
          onInput={(event) => onChange({ ...data, buttonLabel: (event.target as HTMLInputElement).value })}
          disabled={disabled}
          required
        />
        {errors.buttonLabel ? <p class="admin-field__error">{errors.buttonLabel}</p> : null}
      </div>

      <div class="admin-field">
        <label htmlFor={`${idPrefix}-button-href`}>Link do botão</label>
        <input
          id={`${idPrefix}-button-href`}
          type="text"
          value={data.buttonHref}
          onInput={(event) => onChange({ ...data, buttonHref: (event.target as HTMLInputElement).value })}
          disabled={disabled}
          required
          spellCheck={false}
        />
        {errors.buttonHref ? <p class="admin-field__error">{errors.buttonHref}</p> : null}
      </div>
    </BlockChrome>
  );
}
