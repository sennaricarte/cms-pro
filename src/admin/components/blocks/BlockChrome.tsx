import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

interface Props {
  title: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  disabled?: boolean;
  children: ComponentChildren;
}

export default function BlockChrome({
  title,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled = false,
  children,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <section class="admin-block">
      <header class="admin-block__header">
        <h3>Bloco: {title}</h3>
        <div class="admin-list__actions">
          {confirmRemove ? (
            <>
              <span class="admin-list__confirm">Remover este bloco?</span>
              <button
                type="button"
                class="admin-button admin-button--danger"
                disabled={disabled}
                onClick={onRemove}
              >
                Confirmar
              </button>
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={disabled}
                onClick={() => setConfirmRemove(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={disabled || isFirst}
                onClick={onMoveUp}
                aria-label="Mover bloco para cima"
              >
                ▲
              </button>
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={disabled || isLast}
                onClick={onMoveDown}
                aria-label="Mover bloco para baixo"
              >
                ▼
              </button>
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={disabled}
                onClick={() => setConfirmRemove(true)}
              >
                Remover bloco
              </button>
            </>
          )}
        </div>
      </header>
      <div class="admin-block__body">{children}</div>
    </section>
  );
}
