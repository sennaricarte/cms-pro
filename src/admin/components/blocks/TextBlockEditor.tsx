import type { BlockEditorProps, TextBlockData } from '../../lib/page-blocks';
import RichTextEditor from '../RichTextEditor';
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
        <label htmlFor={`${idPrefix}-body`}>Corpo</label>
        <RichTextEditor
          id={`${idPrefix}-body`}
          value={data.body}
          onChange={(body) => onChange({ ...data, body })}
          placeholder="Escreva o bloco. Você pode colar conteúdo do Google Docs ou do Word."
          disabled={disabled}
        />
        {errors.body ? <p class="admin-field__error">{errors.body}</p> : null}
      </div>
    </BlockChrome>
  );
}
