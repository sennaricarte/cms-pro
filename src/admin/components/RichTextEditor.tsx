import { useEffect, useRef, useState } from 'preact/hooks';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

function toMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return storage.markdown?.getMarkdown?.() ?? '';
}

function normalizeMarkdown(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  id,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const [tick, setTick] = useState(0);

  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const bump = () => setTick((current) => current + 1);

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        }),
        Markdown,
      ],
      content: '',
      editorProps: {
        attributes: {
          class: 'admin-rte__content',
          ...(id ? { id } : {}),
          role: 'textbox',
          'aria-multiline': 'true',
          ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
        },
      },
    });

    editor.commands.setContent(value);
    editorRef.current = editor;
    bump();

    editor.on('update', ({ editor: instance }) => {
      onChangeRef.current(toMarkdown(instance));
    });
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    if (normalizeMarkdown(toMarkdown(editor)) !== normalizeMarkdown(value)) {
      editor.commands.setContent(value);
    }
  }, [value]);

  useEffect(() => {
    editorRef.current?.setEditable(!disabled);
  }, [disabled]);

  const editor = editorRef.current;
  void tick;

  const empty = editor?.isEmpty ?? true;

  function applyLink() {
    if (!editor || disabled) {
      return;
    }

    const previous = String(editor.getAttributes('link').href ?? '');
    const next = window.prompt('URL do link', previous || 'https://');

    if (next === null) {
      return;
    }

    const trimmed = next.trim();

    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  }

  return (
    <div class={`admin-rte${disabled ? ' admin-rte--disabled' : ''}`}>
      <div class="admin-rte__toolbar" role="toolbar" aria-label="Formatação do texto">
        <ToolbarButton
          label="Negrito"
          active={editor?.isActive('bold') ?? false}
          disabled={disabled || !editor?.can().toggleBold()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Itálico"
          active={editor?.isActive('italic') ?? false}
          disabled={disabled || !editor?.can().toggleItalic()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="H2"
          title="Título H2"
          active={editor?.isActive('heading', { level: 2 }) ?? false}
          disabled={disabled || !editor?.can().toggleHeading({ level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          title="Título H3"
          active={editor?.isActive('heading', { level: 3 }) ?? false}
          disabled={disabled || !editor?.can().toggleHeading({ level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="H4"
          title="Título H4"
          active={editor?.isActive('heading', { level: 4 }) ?? false}
          disabled={disabled || !editor?.can().toggleHeading({ level: 4 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
        />
        <ToolbarButton
          label="Parágrafo"
          active={editor?.isActive('paragraph') ?? false}
          disabled={disabled || !editor?.can().setParagraph()}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          label="Lista"
          title="Lista com marcadores"
          active={editor?.isActive('bulletList') ?? false}
          disabled={disabled || !editor?.can().toggleBulletList()}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numerada"
          title="Lista numerada"
          active={editor?.isActive('orderedList') ?? false}
          disabled={disabled || !editor?.can().toggleOrderedList()}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Citação"
          active={editor?.isActive('blockquote') ?? false}
          disabled={disabled || !editor?.can().toggleBlockquote()}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Link"
          active={editor?.isActive('link') ?? false}
          disabled={disabled || !editor}
          onClick={applyLink}
        />
        <ToolbarButton
          label="Desfazer"
          disabled={disabled || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Refazer"
          disabled={disabled || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        />
      </div>
      <div class="admin-rte__surface-wrap">
        {placeholder && empty ? (
          <p class="admin-rte__placeholder" aria-hidden="true">
            {placeholder}
          </p>
        ) : null}
        <div ref={hostRef} class="admin-rte__surface" />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class={`admin-rte__btn${active ? ' is-active' : ''}`}
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
