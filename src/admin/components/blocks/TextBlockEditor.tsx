import type { BlockEditorProps, TextBlockData } from '../../lib/page-blocks';
import BlockChrome from './BlockChrome';

export default function TextBlockEditor({
  data,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  disabled = false,
  errors = {},
  idPrefix = 'text',
}: BlockEditorProps<TextBlockData>) {
  return (
    <BlockChrome
      title="Texto"
      isFirst={isFirst}
      isLast={isLast}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      disabled={disabled}
    >
      <div class="admin-field">
        <label htmlFor={`${idPrefix}-heading`}>Título (opcional)</label>
        <input
          id={`${idPrefix}-heading`}
          type="text"
          value={data.heading ?? ''}
          onInput={(event) => {
            const value = (event.target as HTMLInputElement).value;
            onChange({ ...data, heading: value || undefined });
          }}
          disabled={disabled}
        />
      </div>

      <div class="admin-field">
        <label htmlFor={`${idPrefix}-body`}>Corpo (Markdown)</label>
        <textarea
          id={`${idPrefix}-body`}
          class="admin-textarea"
          rows={8}
          value={data.body}
          onInput={(event) => onChange({ ...data, body: (event.target as HTMLTextAreaElement).value })}
          disabled={disabled}
          required
        />
        {errors.body ? <p class="admin-field__error">{errors.body}</p> : null}
      </div>
    </BlockChrome>
  );
}
