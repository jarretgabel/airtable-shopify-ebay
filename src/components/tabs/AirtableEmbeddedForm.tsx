import { EmptySurface, PanelSurface } from '@/components/app/StateSurfaces';

const REQUEST_FORM_ENV_KEYS = ['VITE_AIRTABLE_REQUEST_FORM_EMBED_URL', 'VITE_AIRTABLE_REQUEST_FORM_URL'] as const;

function getRequestFormUrl(): string | null {
  const rawUrl = REQUEST_FORM_ENV_KEYS
    .map((key) => import.meta.env[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim();

  if (!rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function AirtableEmbeddedForm() {
  const requestFormUrl = getRequestFormUrl();

  if (!requestFormUrl) {
    return (
      <EmptySurface
        title="Request form is not configured"
        message="Set VITE_AIRTABLE_REQUEST_FORM_EMBED_URL or VITE_AIRTABLE_REQUEST_FORM_URL in your environment to render the embedded Airtable form."
      />
    );
  }

  return (
    <PanelSurface>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Airtable</p>
            <h2 className="m-0 text-xl font-semibold text-[var(--ink)]">Request Form</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Complete the Airtable form directly here, or open it in a separate tab if you need the full-screen experience.</p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] no-underline transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            href={requestFormUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in new tab
          </a>
        </div>

        <iframe
          title="Airtable Request Form"
          src={requestFormUrl}
          className="min-h-[72vh] w-full rounded-xl border border-[var(--line)] bg-[var(--bg)]"
        />
      </div>
    </PanelSurface>
  );
}