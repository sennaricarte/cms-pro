import { useEffect, useId, useState } from 'preact/hooks';
import { createOrUpdateFile, getFileContent } from '../lib/github-client';
import ImagePickerField from './ImagePickerField';

interface Props {
  token: string;
}

interface SocialLinkRow {
  uid: string;
  platform: string;
  customPlatform: string;
  url: string;
}

interface SameAsRow {
  uid: string;
  url: string;
}

interface FormState {
  siteName: string;
  siteUrl: string;
  logoPath: string;
  logoAlt: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  primaryFamily: string;
  primaryWeights: number[];
  secondaryFamily: string;
  secondaryWeights: number[];
  socialLinks: SocialLinkRow[];
  legalName: string;
  organizationLogo: string;
  sameAs: SameAsRow[];
}

type ColorKey = keyof FormState['colors'];
type FieldErrors = Partial<Record<string, string>>;

const SETTINGS_PATH = 'src/data/site-settings.json';
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];
const KNOWN_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'whatsapp'] as const;

const SOCIAL_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Outro' },
] as const;

const COLOR_FIELDS: Array<{ key: ColorKey; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
];

const emptyForm = (): FormState => ({
  siteName: '',
  siteUrl: '',
  logoPath: '',
  logoAlt: '',
  colors: {
    primary: '#1F2937',
    secondary: '#4B5563',
    accent: '#2563EB',
    background: '#FFFFFF',
    text: '#111827',
  },
  primaryFamily: '',
  primaryWeights: [400],
  secondaryFamily: '',
  secondaryWeights: [400],
  socialLinks: [],
  legalName: '',
  organizationLogo: '',
  sameAs: [],
});

function newUid(): string {
  return crypto.randomUUID();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number' && FONT_WEIGHTS.includes(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function platformSelectValue(platform: string): string {
  const key = platform.trim().toLowerCase();
  return (KNOWN_PLATFORMS as readonly string[]).includes(key) ? key : 'other';
}

function toColorInput(hex: string): string {
  const short = hex.match(/^#([0-9a-fA-F]{3})$/);

  if (short) {
    const [red, green, blue] = short[1];
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000';
}

function toggleWeight(weights: number[], weight: number): number[] {
  const next = weights.includes(weight) ? weights.filter((item) => item !== weight) : [...weights, weight];
  return next.sort((left, right) => left - right);
}

function parseSettings(raw: string): FormState {
  const parsed = JSON.parse(raw) as unknown;
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!isRecord(entry)) {
    throw new Error('JSON inválido');
  }

  const logo = isRecord(entry.logo) ? entry.logo : {};
  const colors = isRecord(entry.colors) ? entry.colors : {};
  const fonts = isRecord(entry.fonts) ? entry.fonts : {};
  const organization = isRecord(entry.organization) ? entry.organization : {};
  const defaults = emptyForm();

  const socialLinks = Array.isArray(entry.socialLinks)
    ? entry.socialLinks.filter(isRecord).map((link) => {
        const platform = asString(link.platform);
        const selected = platformSelectValue(platform);

        return {
          uid: newUid(),
          platform: selected,
          customPlatform: selected === 'other' ? platform : '',
          url: asString(link.url),
        };
      })
    : [];

  const sameAs = Array.isArray(organization.sameAs)
    ? organization.sameAs.filter((item): item is string => typeof item === 'string').map((url) => ({
        uid: newUid(),
        url,
      }))
    : [];

  return {
    siteName: asString(entry.siteName),
    siteUrl: asString(entry.siteUrl),
    logoPath: asString(logo.path),
    logoAlt: asString(logo.alt),
    colors: {
      primary: asString(colors.primary) || defaults.colors.primary,
      secondary: asString(colors.secondary) || defaults.colors.secondary,
      accent: asString(colors.accent) || defaults.colors.accent,
      background: asString(colors.background) || defaults.colors.background,
      text: asString(colors.text) || defaults.colors.text,
    },
    primaryFamily: asString(fonts.primaryFamily),
    primaryWeights: asNumberArray(fonts.primaryWeights),
    secondaryFamily: asString(fonts.secondaryFamily),
    secondaryWeights: asNumberArray(fonts.secondaryWeights),
    socialLinks,
    legalName: asString(organization.legalName),
    organizationLogo: asString(organization.logo),
    sameAs,
  };
}

function validateSettings(form: FormState): { messages: string[]; fields: FieldErrors } {
  const messages: string[] = [];
  const fields: FieldErrors = {};

  if (!form.siteName.trim()) {
    messages.push('Informe o nome do site.');
    fields.siteName = 'Informe o nome do site.';
  }

  if (!form.siteUrl.trim()) {
    messages.push('Informe a URL do site.');
    fields.siteUrl = 'Informe a URL do site.';
  } else if (!isValidUrl(form.siteUrl.trim())) {
    messages.push('A URL do site precisa ser válida.');
    fields.siteUrl = 'Informe uma URL válida, com https://.';
  }

  if (!form.logoPath.trim()) {
    messages.push('Escolha o logo do site.');
    fields.logo = 'Escolha o logo na biblioteca ou informe um path.';
  }

  if (!form.logoAlt.trim()) {
    messages.push('Informe o texto alternativo do logo.');
    fields.logo = fields.logo ?? 'Informe o texto alternativo do logo.';
  }

  for (const { key, label } of COLOR_FIELDS) {
    if (!HEX_COLOR.test(form.colors[key].trim())) {
      messages.push(`A cor ${label} precisa ser um hex válido (#RGB ou #RRGGBB).`);
      fields[`colors.${key}`] = 'Informe um hex válido (#RGB ou #RRGGBB).';
    }
  }

  if (!form.primaryFamily.trim()) {
    messages.push('Informe a família tipográfica principal.');
    fields.primaryFamily = 'Informe a família tipográfica principal.';
  }

  if (form.primaryWeights.length === 0) {
    messages.push('Escolha pelo menos um peso da fonte principal.');
    fields.primaryWeights = 'Escolha pelo menos um peso.';
  }

  form.socialLinks.forEach((link, index) => {
    const platform = link.platform === 'other' ? link.customPlatform.trim() : link.platform;

    if (!platform) {
      messages.push(`Rede social ${index + 1}: informe a plataforma.`);
      fields[`social.${link.uid}.platform`] = 'Informe a plataforma.';
    }

    if (!link.url.trim()) {
      messages.push(`Rede social ${index + 1}: informe a URL.`);
      fields[`social.${link.uid}.url`] = 'Informe a URL.';
    } else if (!isValidUrl(link.url.trim())) {
      messages.push(`Rede social ${index + 1}: a URL precisa ser válida.`);
      fields[`social.${link.uid}.url`] = 'Informe uma URL válida.';
    }
  });

  if (form.organizationLogo.trim() && !isValidUrl(form.organizationLogo.trim()) && !form.organizationLogo.startsWith('/')) {
    messages.push('O logo da organização precisa ser uma URL ou um caminho público.');
    fields.organizationLogo = 'Use uma URL ou um caminho que comece com /.';
  }

  form.sameAs.forEach((row, index) => {
    if (!row.url.trim()) {
      messages.push(`sameAs ${index + 1}: informe a URL.`);
      fields[`sameAs.${row.uid}`] = 'Informe a URL.';
    } else if (!isValidUrl(row.url.trim())) {
      messages.push(`sameAs ${index + 1}: a URL precisa ser válida.`);
      fields[`sameAs.${row.uid}`] = 'Informe uma URL válida.';
    }
  });

  return { messages, fields };
}

function toSettingsPayload(form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: 'default',
    siteName: form.siteName.trim(),
    siteUrl: form.siteUrl.trim(),
    logo: {
      path: form.logoPath.trim(),
      alt: form.logoAlt.trim(),
    },
    colors: {
      primary: form.colors.primary.trim(),
      secondary: form.colors.secondary.trim(),
      accent: form.colors.accent.trim(),
      background: form.colors.background.trim(),
      text: form.colors.text.trim(),
    },
    fonts: {
      primaryFamily: form.primaryFamily.trim(),
      primaryWeights: form.primaryWeights,
    },
  };

  if (form.secondaryFamily.trim()) {
    (payload.fonts as Record<string, unknown>).secondaryFamily = form.secondaryFamily.trim();
    (payload.fonts as Record<string, unknown>).secondaryWeights = form.secondaryWeights;
  }

  const socialLinks = form.socialLinks
    .map((link) => ({
      platform: (link.platform === 'other' ? link.customPlatform : link.platform).trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.platform && link.url);

  if (socialLinks.length > 0) {
    payload.socialLinks = socialLinks;
  }

  const organization: Record<string, unknown> = {};

  if (form.legalName.trim()) {
    organization.legalName = form.legalName.trim();
  }

  if (form.organizationLogo.trim()) {
    organization.logo = form.organizationLogo.trim();
  }

  const sameAs = form.sameAs.map((row) => row.url.trim()).filter(Boolean);

  if (sameAs.length > 0) {
    organization.sameAs = sameAs;
  }

  payload.organization = organization;

  return payload;
}

export default function SiteSettingsEditor({ token }: Props) {
  const previewId = useId();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sha, setSha] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setFormError('');
      setRateLimitMessage('');

      const result = await getFileContent(token, SETTINGS_PATH);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setLoading(false);

        if (result.code === 'RATE_LIMIT') {
          setRateLimitMessage(result.error);
        }

        setFormError(result.error);
        return;
      }

      try {
        setSha(result.sha);
        setForm(parseSettings(result.content));
      } catch {
        setFormError('Não foi possível ler o JSON de configurações. O arquivo pode estar malformado.');
      }

      setLoading(false);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateColor(key: ColorKey, value: string) {
    setForm((current) => ({
      ...current,
      colors: { ...current.colors, [key]: value },
    }));
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setFormError('');
    setRateLimitMessage('');
    setActionMessage('');

    const { messages, fields } = validateSettings(form);
    setFieldErrors(fields);
    setFormErrors(messages);

    if (messages.length > 0) {
      return;
    }

    setSaving(true);

    // JSON.stringify emite Unicode (inclui acentos). O encodeBase64Utf8 do
    // github-client transforma essa string em bytes UTF-8 antes do Base64.
    const content = `${JSON.stringify([toSettingsPayload(form)], null, 2)}\n`;
    const result = await createOrUpdateFile(
      token,
      SETTINGS_PATH,
      content,
      'cms: atualizar configurações do site',
      sha,
    );

    if (!result.ok) {
      setSaving(false);

      if (result.code === 'RATE_LIMIT') {
        setRateLimitMessage(result.error);
      }

      if (result.code === 'CONFLICT') {
        setFormError(
          'Estas configurações foram alteradas por outro processo desde que você abriu — recarregue antes de salvar',
        );
        return;
      }

      setFormError(result.error);
      return;
    }

    const refreshed = await getFileContent(token, SETTINGS_PATH);

    if (refreshed.ok) {
      setSha(refreshed.sha);
    }

    setSaving(false);
    setActionMessage(result.deployWarning ?? 'Configurações salvas.');
  }

  if (loading) {
    return (
      <section class="admin-card" aria-busy="true">
        <div class="admin-skeleton" aria-label="Carregando configurações">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  return (
    <div class="admin-settings">
      {rateLimitMessage ? (
        <p class="admin-banner" role="alert">
          {rateLimitMessage}
        </p>
      ) : null}

      {formError ? (
        <p class="admin-error" role="alert">
          {formError}
        </p>
      ) : null}

      {actionMessage ? (
        <p class="admin-banner admin-banner--info" role="status">
          {actionMessage}
        </p>
      ) : null}

      {formErrors.length > 0 ? (
        <div class="admin-card" role="alert">
          <p class="admin-error">Corrija os itens abaixo antes de salvar:</p>
          <ul class="admin-error-list">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div class="admin-settings__layout">
        <aside
          class="admin-theme-preview"
          style={{
            background: form.colors.background,
            color: form.colors.text,
            fontFamily: form.primaryFamily.trim()
              ? `${form.primaryFamily.trim()}, system-ui, sans-serif`
              : 'system-ui, sans-serif',
          }}
          aria-labelledby={`${previewId}-title`}
        >
          <p class="admin-theme-preview__label" id={`${previewId}-title`}>
            Prévia ao vivo
          </p>
          {form.logoPath ? (
            <img src={form.logoPath} alt={form.logoAlt || 'Logo do site'} />
          ) : (
            <p class="admin-theme-preview__placeholder">Sem logo</p>
          )}
          <p class="admin-theme-preview__name">{form.siteName.trim() || 'Nome do site'}</p>
          <p>Texto de exemplo na cor e no fundo atuais do tema.</p>
          <button type="button" style={{ background: form.colors.primary, color: form.colors.background }}>
            Botão de exemplo
          </button>
        </aside>

        <form class="admin-card admin-form" onSubmit={handleSubmit} noValidate>
          <div class="admin-field">
            <label htmlFor="settings-name">Nome do site</label>
            <input
              id="settings-name"
              type="text"
              value={form.siteName}
              onInput={(event) => update('siteName', (event.target as HTMLInputElement).value)}
              disabled={saving}
              required
            />
            {fieldErrors.siteName ? <p class="admin-field__error">{fieldErrors.siteName}</p> : null}
          </div>

          <div class="admin-field">
            <label htmlFor="settings-url">URL do site</label>
            <input
              id="settings-url"
              type="url"
              value={form.siteUrl}
              onInput={(event) => update('siteUrl', (event.target as HTMLInputElement).value)}
              disabled={saving}
              required
              spellCheck={false}
              placeholder="https://exemplo.com.br"
            />
            {fieldErrors.siteUrl ? <p class="admin-field__error">{fieldErrors.siteUrl}</p> : null}
          </div>

          <ImagePickerField
            label="Logo"
            value={form.logoPath}
            altValue={form.logoAlt}
            required
            disabled={saving}
            error={fieldErrors.logo}
            onChange={({ url, alt }) => {
              setForm((current) => ({
                ...current,
                logoPath: url,
                logoAlt: alt,
              }));
            }}
          />

          <fieldset class="admin-fieldset">
            <legend>Cores</legend>
            <div class="admin-color-grid">
              {COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} class={`admin-field${fieldErrors[`colors.${key}`] ? ' admin-field--invalid' : ''}`}>
                  <label htmlFor={`settings-color-${key}`}>{label}</label>
                  <div class="admin-color-row">
                    <input
                      id={`settings-color-${key}-picker`}
                      type="color"
                      value={toColorInput(form.colors[key])}
                      onInput={(event) =>
                        updateColor(key, (event.target as HTMLInputElement).value.toUpperCase())
                      }
                      disabled={saving}
                      aria-label={`Seletor visual de ${label}`}
                    />
                    <input
                      id={`settings-color-${key}`}
                      type="text"
                      value={form.colors[key]}
                      onInput={(event) => updateColor(key, (event.target as HTMLInputElement).value)}
                      disabled={saving}
                      spellCheck={false}
                    />
                  </div>
                  {fieldErrors[`colors.${key}`] ? (
                    <p class="admin-field__error">{fieldErrors[`colors.${key}`]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset class="admin-fieldset">
            <legend>Tipografia</legend>
            <div class="admin-field">
              <label htmlFor="settings-font-primary">Família principal</label>
              <input
                id="settings-font-primary"
                type="text"
                value={form.primaryFamily}
                onInput={(event) => update('primaryFamily', (event.target as HTMLInputElement).value)}
                disabled={saving}
                required
                placeholder="Inter"
              />
              {fieldErrors.primaryFamily ? <p class="admin-field__error">{fieldErrors.primaryFamily}</p> : null}
            </div>
            <fieldset class="admin-fieldset admin-fieldset--plain">
              <legend>Pesos da família principal</legend>
              <div class="admin-weight-list">
                {FONT_WEIGHTS.map((weight) => (
                  <label key={`primary-${weight}`} class="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={form.primaryWeights.includes(weight)}
                      disabled={saving}
                      onChange={() => update('primaryWeights', toggleWeight(form.primaryWeights, weight))}
                    />
                    {weight}
                  </label>
                ))}
              </div>
              {fieldErrors.primaryWeights ? <p class="admin-field__error">{fieldErrors.primaryWeights}</p> : null}
            </fieldset>
            <div class="admin-field">
              <label htmlFor="settings-font-secondary">Família secundária (opcional)</label>
              <input
                id="settings-font-secondary"
                type="text"
                value={form.secondaryFamily}
                onInput={(event) => update('secondaryFamily', (event.target as HTMLInputElement).value)}
                disabled={saving}
                placeholder="Source Serif 4"
              />
            </div>
            {form.secondaryFamily.trim() ? (
              <fieldset class="admin-fieldset admin-fieldset--plain">
                <legend>Pesos da família secundária</legend>
                <div class="admin-weight-list">
                  {FONT_WEIGHTS.map((weight) => (
                    <label key={`secondary-${weight}`} class="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={form.secondaryWeights.includes(weight)}
                        disabled={saving}
                        onChange={() => update('secondaryWeights', toggleWeight(form.secondaryWeights, weight))}
                      />
                      {weight}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </fieldset>

          <fieldset class="admin-fieldset">
            <legend>Redes sociais</legend>
            {form.socialLinks.length === 0 ? (
              <p class="admin-empty">Nenhuma rede ainda.</p>
            ) : (
              <ul class="admin-repeat-list">
                {form.socialLinks.map((link) => (
                  <li key={link.uid} class="admin-repeat-row">
                    <div class="admin-field">
                      <label htmlFor={`social-platform-${link.uid}`}>Plataforma</label>
                      <select
                        id={`social-platform-${link.uid}`}
                        value={link.platform}
                        disabled={saving}
                        onChange={(event) => {
                          const platform = (event.target as HTMLSelectElement).value;
                          update(
                            'socialLinks',
                            form.socialLinks.map((row) =>
                              row.uid === link.uid ? { ...row, platform } : row,
                            ),
                          );
                        }}
                      >
                        {SOCIAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {link.platform === 'other' ? (
                      <div class="admin-field">
                        <label htmlFor={`social-custom-${link.uid}`}>Nome da plataforma</label>
                        <input
                          id={`social-custom-${link.uid}`}
                          type="text"
                          value={link.customPlatform}
                          onInput={(event) =>
                            update(
                              'socialLinks',
                              form.socialLinks.map((row) =>
                                row.uid === link.uid
                                  ? { ...row, customPlatform: (event.target as HTMLInputElement).value }
                                  : row,
                              ),
                            )
                          }
                          disabled={saving}
                        />
                        {fieldErrors[`social.${link.uid}.platform`] ? (
                          <p class="admin-field__error">{fieldErrors[`social.${link.uid}.platform`]}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div class="admin-field">
                      <label htmlFor={`social-url-${link.uid}`}>URL</label>
                      <input
                        id={`social-url-${link.uid}`}
                        type="url"
                        value={link.url}
                        onInput={(event) =>
                          update(
                            'socialLinks',
                            form.socialLinks.map((row) =>
                              row.uid === link.uid ? { ...row, url: (event.target as HTMLInputElement).value } : row,
                            ),
                          )
                        }
                        disabled={saving}
                        spellCheck={false}
                      />
                      {fieldErrors[`social.${link.uid}.url`] ? (
                        <p class="admin-field__error">{fieldErrors[`social.${link.uid}.url`]}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      class="admin-button admin-button--ghost"
                      disabled={saving}
                      onClick={() =>
                        update(
                          'socialLinks',
                          form.socialLinks.filter((row) => row.uid !== link.uid),
                        )
                      }
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              class="admin-button admin-button--ghost"
              disabled={saving}
              onClick={() =>
                update('socialLinks', [
                  ...form.socialLinks,
                  { uid: newUid(), platform: 'instagram', customPlatform: '', url: '' },
                ])
              }
            >
              Adicionar rede
            </button>
          </fieldset>

          <fieldset class="admin-fieldset">
            <legend>Organização</legend>
            <div class="admin-field">
              <label htmlFor="settings-legal-name">Razão social (opcional)</label>
              <input
                id="settings-legal-name"
                type="text"
                value={form.legalName}
                onInput={(event) => update('legalName', (event.target as HTMLInputElement).value)}
                disabled={saving}
              />
            </div>
            <div class="admin-field">
              <label htmlFor="settings-org-logo">Logo da organização (opcional)</label>
              <input
                id="settings-org-logo"
                type="text"
                value={form.organizationLogo}
                onInput={(event) => update('organizationLogo', (event.target as HTMLInputElement).value)}
                disabled={saving}
                spellCheck={false}
                placeholder={form.logoPath || 'https://exemplo.com.br/uploads/logo.svg'}
              />
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={saving || !form.logoPath.trim()}
                onClick={() => update('organizationLogo', form.logoPath.trim())}
              >
                Usar o path do logo do site
              </button>
              {fieldErrors.organizationLogo ? (
                <p class="admin-field__error">{fieldErrors.organizationLogo}</p>
              ) : null}
            </div>
            <div class="admin-field">
              <span>sameAs</span>
              {form.sameAs.length === 0 ? (
                <p class="admin-empty">Nenhuma URL ainda.</p>
              ) : (
                <ul class="admin-repeat-list">
                  {form.sameAs.map((row) => (
                    <li key={row.uid} class="admin-repeat-row">
                      <div class="admin-field">
                        <label htmlFor={`sameas-${row.uid}`}>URL</label>
                        <input
                          id={`sameas-${row.uid}`}
                          type="url"
                          value={row.url}
                          onInput={(event) =>
                            update(
                              'sameAs',
                              form.sameAs.map((item) =>
                                item.uid === row.uid
                                  ? { ...item, url: (event.target as HTMLInputElement).value }
                                  : item,
                              ),
                            )
                          }
                          disabled={saving}
                          spellCheck={false}
                        />
                        {fieldErrors[`sameAs.${row.uid}`] ? (
                          <p class="admin-field__error">{fieldErrors[`sameAs.${row.uid}`]}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        class="admin-button admin-button--ghost"
                        disabled={saving}
                        onClick={() => update('sameAs', form.sameAs.filter((item) => item.uid !== row.uid))}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                class="admin-button admin-button--ghost"
                disabled={saving}
                onClick={() => update('sameAs', [...form.sameAs, { uid: newUid(), url: '' }])}
              >
                Adicionar URL
              </button>
            </div>
          </fieldset>

          <div class="admin-editor__actions">
            <button type="submit" class="admin-button" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
