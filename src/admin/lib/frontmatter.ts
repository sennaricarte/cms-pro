/**
 * Frontmatter YAML no browser.
 *
 * Usa js-yaml 4 (não a 5): `load`/`dump` são JS puro, sem fs/Buffer, e a v4
 * ainda expõe quotingType / flowLevel para arrays em bloco e strings com `:`.
 */
import { dump, load } from 'js-yaml';

export interface FrontmatterDocument {
  data: Record<string, unknown>;
  body: string;
}

function normalizeNewlines(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function toIsoDate(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const iso = value.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
}

function normalizeYamlValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return toIsoDate(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeYamlValue(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) {
        continue;
      }

      output[key] = normalizeYamlValue(nested);
    }

    return output;
  }

  return value;
}

export function parseFrontmatter(raw: string): FrontmatterDocument {
  const text = normalizeNewlines(raw);

  if (!text.startsWith('---\n') && text !== '---') {
    return { data: {}, body: text };
  }

  const rest = text.startsWith('---\n') ? text.slice(4) : '';
  const closer = rest.indexOf('\n---');

  if (closer === -1) {
    return { data: {}, body: text };
  }

  const yamlBlock = rest.slice(0, closer);
  let body = rest.slice(closer + 4);

  if (body.startsWith('\n')) {
    body = body.slice(1);
  }

  if (!yamlBlock.trim()) {
    return { data: {}, body };
  }

  const parsed = load(yamlBlock);

  if (parsed == null) {
    return { data: {}, body };
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('O frontmatter precisa ser um objeto YAML.');
  }

  return {
    data: parsed as Record<string, unknown>,
    body,
  };
}

export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  const prepared = normalizeYamlValue(data) as Record<string, unknown>;
  const yaml = dump(prepared, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    noCompatMode: true,
    quotingType: '"',
    forceQuotes: false,
    flowLevel: -1,
  }).trimEnd();

  const bodyText = normalizeNewlines(body).replace(/^\n+/, '');
  return `---\n${yaml}\n---\n\n${bodyText}`;
}
