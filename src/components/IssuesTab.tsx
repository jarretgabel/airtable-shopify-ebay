import { LoadingSurface } from '@/components/app/StateSurfaces';
import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { DashboardSectionPanel, StatTile } from '@/components/dashboard/dashboardPrimitives';
import { tabFormControlBaseClass } from '@/components/tabs/uiClasses';
import { PAGE_DEFINITIONS } from '@/auth/pages';
import { issuesAppApi } from '@/services/app-api';
import {
  ISSUE_KINDS, ISSUE_PRIORITIES, ISSUE_STATUSES,
  type Issue, type IssueDetail, type IssueKind, type IssueListResponse, type IssuePerson, type IssuePriority, type IssueStatus,
} from '@/services/app-api/issues';

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const STATUS_LABELS: Record<IssueStatus, string> = { open: 'Open', in_progress: 'In progress', blocked: 'Blocked', resolved: 'Resolved', closed: 'Closed', wont_fix: "Won't fix" };
const KIND_LABELS: Record<IssueKind, string> = { bug: 'Bug', feature: 'Feature request', question: 'Question' };
const PRIORITY_TONE: Record<IssuePriority, string> = { low: 'text-[var(--muted)]', normal: 'text-[var(--ink)]', high: 'text-amber-500', urgent: 'text-red-500' };
const STATUS_TONE: Record<IssueStatus, string> = { open: 'text-sky-400', in_progress: 'text-amber-500', blocked: 'text-red-500', resolved: 'text-emerald-500', closed: 'text-[var(--muted)]', wont_fix: 'text-[var(--muted)]' };
const AREA_OPTIONS = Object.values(PAGE_DEFINITIONS).map((page) => page.label);
const buttonClass = 'rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-50';
const labelClass = 'grid gap-1 text-[0.78rem] text-[var(--muted)]';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function validateImages(files: File[]): string | null {
  const bad = files.find((file) => !/^image\/(jpeg|png|gif|webp)$/.test(file.type));
  if (bad) return `${bad.name} is not a JPEG, PNG, GIF or WebP image.`;
  const big = files.find((file) => file.size > MAX_IMAGE_BYTES);
  return big ? `${big.name} is larger than 4 MB.` : null;
}

function ImagePicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <label className={labelClass}>Screenshots (optional, up to 8)
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple disabled={disabled} className={tabFormControlBaseClass} onChange={(event) => {
          const next = [...files, ...Array.from(event.target.files ?? [])].slice(0, 8);
          event.target.value = '';
          const problem = validateImages(next);
          setError(problem);
          if (!problem) onChange(next);
        }} />
      </label>
      {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
      {files.length > 0 ? (
        <ul className="m-0 flex flex-wrap gap-2 p-0 list-none">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="text-[0.78rem]">
              <img src={URL.createObjectURL(file)} alt={file.name} className="h-16 w-16 rounded object-cover" />
              <button type="button" className="underline" onClick={() => onChange(files.filter((_, i) => i !== index))}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function NewIssueForm({ onCreated }: { onCreated: () => void }) {
  const [kind, setKind] = useState<IssueKind>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('normal');
  const [area, setArea] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { issue } = await issuesAppApi.createIssue({ kind, title, description, priority, area });
      try {
        for (const file of images) await issuesAppApi.addIssueImage(issue.id, { filename: file.name, data: await fileToBase64(file) });
      } catch (reason) {
        window.alert(`Issue #${issue.id} was created, but a screenshot failed to upload: ${reason instanceof Error ? reason.message : 'unknown error'}. You can retry from the issue.`);
      }
      setImages([]);
      setTitle('');
      setDescription('');
      setArea('');
      setPriority('normal');
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit the issue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={(event) => { void submit(event); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>Type
          <select className={tabFormControlBaseClass} value={kind} onChange={(event) => setKind(event.target.value as IssueKind)}>
            {ISSUE_KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
          </select>
        </label>
        <label className={labelClass}>Priority
          <select className={tabFormControlBaseClass} value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)}>
            {ISSUE_PRIORITIES.map((value) => <option key={value} value={value}>{cap(value)}</option>)}
          </select>
        </label>
        <label className={labelClass}>Page or area (optional)
          <input className={tabFormControlBaseClass} list="issue-areas" value={area} maxLength={100} onChange={(event) => setArea(event.target.value)} />
          <datalist id="issue-areas">{AREA_OPTIONS.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
      </div>
      <label className={labelClass}>Title
        <input className={tabFormControlBaseClass} required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short summary" />
      </label>
      <label className={labelClass}>Details
        <textarea className={`${tabFormControlBaseClass} min-h-24`} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={kind === 'bug' ? 'What happened, what you expected, and the steps to reproduce it' : 'What is needed and why'} />
      </label>
      <ImagePicker files={images} onChange={setImages} disabled={saving} />
      {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
      <div><button type="submit" className={buttonClass} disabled={saving || !title.trim()}>{saving ? 'Submitting…' : 'Submit'}</button></div>
    </form>
  );
}

function IssueDetailPanel({ id, me, people, onChanged }: { id: number; me: IssuePerson; people: IssuePerson[]; onChanged: () => void }) {
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    issuesAppApi.getIssue(id).then(({ issue }) => {
      if (!active) return;
      setDetail(issue);
      setNote(issue.resolutionNote ?? '');
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load the issue.'); });
    return () => { active = false; };
  }, [id]);

  const run = async (action: () => Promise<{ issue: IssueDetail }>) => {
    setBusy(true);
    setError(null);
    try {
      const { issue } = await action();
      setDetail(issue);
      setNote(issue.resolutionNote ?? '');
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return error ? <p className="m-0 text-sm text-[var(--muted)]">{error}</p> : <LoadingSurface message="Loading issue..." />;

  const assignees = [me, ...people.filter((person) => person.email.toLowerCase() !== me.email.toLowerCase())];
  const assigneeEmail = detail.assignedTo?.email.toLowerCase() ?? '';
  const known = assignees.some((person) => person.email.toLowerCase() === assigneeEmail);

  return (
    <div className="grid gap-4">
      {detail.description ? <p className="m-0 whitespace-pre-wrap text-sm">{detail.description}</p> : <p className="m-0 text-sm text-[var(--muted)]">No details provided.</p>}
      <p className="m-0 text-[0.78rem] text-[var(--muted)]">
        Submitted by {detail.submittedBy.name} on {dateTime.format(new Date(detail.createdAt))}{detail.source === 'assistant' ? ' via the assistant' : ''}
        {detail.area ? ` · ${detail.area}` : ''}
        {detail.resolvedBy && detail.resolvedAt ? ` · ${STATUS_LABELS[detail.status]} by ${detail.resolvedBy.name} on ${dateTime.format(new Date(detail.resolvedAt))}` : ''}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>Status
          <select className={tabFormControlBaseClass} value={detail.status} disabled={busy} onChange={(event) => { void run(() => issuesAppApi.updateIssue(id, { status: event.target.value as IssueStatus })); }}>
            {ISSUE_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
        </label>
        <label className={labelClass}>Assigned to
          <select
            className={tabFormControlBaseClass}
            value={assigneeEmail}
            disabled={busy}
            onChange={(event) => {
              const person = assignees.find((candidate) => candidate.email.toLowerCase() === event.target.value);
              void run(() => issuesAppApi.updateIssue(id, { assignedTo: person ?? null }));
            }}
          >
            <option value="">Unassigned</option>
            {!known && detail.assignedTo ? <option value={assigneeEmail}>{detail.assignedTo.name}</option> : null}
            {assignees.map((person) => <option key={person.email} value={person.email.toLowerCase()}>{person.email.toLowerCase() === me.email.toLowerCase() ? `${person.name} (me)` : person.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>Priority
          <select className={tabFormControlBaseClass} value={detail.priority} disabled={busy} onChange={(event) => { void run(() => issuesAppApi.updateIssue(id, { priority: event.target.value as IssuePriority })); }}>
            {ISSUE_PRIORITIES.map((value) => <option key={value} value={value}>{cap(value)}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-2">
        <label className={labelClass}>Resolution note
          <textarea className={`${tabFormControlBaseClass} min-h-16`} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was done to resolve it" />
        </label>
        <div><button type="button" className={buttonClass} disabled={busy || note === (detail.resolutionNote ?? '')} onClick={() => { void run(() => issuesAppApi.updateIssue(id, { resolutionNote: note })); }}>Save note</button></div>
      </div>
      <div className="grid gap-2">
        <h4 className="m-0 text-[0.72rem] uppercase tracking-[0.08em] text-[var(--muted)]">Screenshots ({detail.images.length})</h4>
        {detail.images.length > 0 ? (
          <ul className="m-0 flex flex-wrap gap-2 p-0 list-none">
            {detail.images.map((image) => (
              <li key={image.id}><a href={image.url} target="_blank" rel="noreferrer"><img src={`${image.url}?w=400`} alt={image.filename} className="h-24 w-24 rounded object-cover" /></a></li>
            ))}
          </ul>
        ) : null}
        {detail.images.length < 8 ? (
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" aria-label="Add a screenshot" disabled={busy} className="text-[0.78rem]" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const problem = validateImages([file]);
            if (problem) { window.alert(problem); return; }
            void run(async () => issuesAppApi.addIssueImage(id, { filename: file.name, data: await fileToBase64(file) }));
          }} />
        ) : null}
      </div>
      <div className="grid gap-2">
        <h4 className="m-0 text-[0.72rem] uppercase tracking-[0.08em] text-[var(--muted)]">Comments</h4>
        {detail.comments.length === 0 ? <p className="m-0 text-sm text-[var(--muted)]">No comments yet.</p> : detail.comments.map((item) => (
          <p key={item.id} className="m-0 whitespace-pre-wrap text-sm"><strong>{item.author.name}</strong> <span className="text-[0.75rem] text-[var(--muted)]">{dateTime.format(new Date(item.createdAt))}</span><br />{item.body}</p>
        ))}
        <textarea className={`${tabFormControlBaseClass} min-h-16`} aria-label="Add a comment" maxLength={3000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment" />
        <div>
          <button type="button" className={buttonClass} disabled={busy || !comment.trim()} onClick={() => { const body = comment; setComment(''); void run(() => issuesAppApi.addIssueComment(id, body)); }}>Comment</button>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-[0.78rem] text-[var(--muted)]">History ({detail.events.length})</summary>
        <ul className="mt-2 grid gap-1 pl-4 text-[0.8rem]">
          {detail.events.map((event) => (
            <li key={event.id}>
              {dateTime.format(new Date(event.createdAt))}: {event.actor.name}{' '}
              {event.action === 'created' ? 'created the issue' : event.action === 'resolution note' ? 'updated the resolution note' : `changed ${event.action}${event.from || event.to ? ` from ${event.from ? (STATUS_LABELS[event.from as IssueStatus] ?? event.from) : 'none'} to ${event.to ? (STATUS_LABELS[event.to as IssueStatus] ?? event.to) : 'none'}` : ''}`}
            </li>
          ))}
        </ul>
      </details>
      {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

export function IssuesTab() {
  const [data, setData] = useState<IssueListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('open_all');
  const [kind, setKind] = useState('');
  const [scope, setScope] = useState<'all' | 'assigned' | 'submitted'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setData(await issuesAppApi.listIssues({
        status: status === 'all' ? '' : status,
        kind,
        q: query,
        assignee: scope === 'assigned' ? 'me' : '',
        submitter: scope === 'submitted' ? 'me' : '',
      }));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load issues.');
    }
  }, [status, kind, query, scope]);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary;
  const rows: Issue[] = data?.issues ?? [];

  return (
    <AppPageLayout>
      <WorkflowPageHeader eyebrow="Utilities" title="Issues" detail="Report bugs, request features and track them to resolution." />
      {error ? <p role="alert" className="m-0 text-sm text-red-500">{error}</p> : null}
      {!data && !error ? <LoadingSurface message="Loading issues..." /> : null}
      {data ? (
        <>
          <DashboardSectionPanel id="issues-overview" title="Overview">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatTile label="Open" value={summary?.open ?? 0} />
              <StatTile label="In progress" value={summary?.inProgress ?? 0} />
              <StatTile label="Blocked" value={summary?.blocked ?? 0} />
              <StatTile label="Resolved in 7 days" value={summary?.resolvedLast7Days ?? 0} />
            </div>
            {summary && summary.openByAssignee.length > 0 ? (
              <p className="m-0 text-[0.8rem] text-[var(--muted)]">
                Open by assignee: {summary.openByAssignee.map((row) => `${row.name ?? 'Unassigned'} (${row.open})`).join(', ')}
              </p>
            ) : null}
            <div>
              <button type="button" className={buttonClass} aria-expanded={showForm} onClick={() => setShowForm((value) => !value)}>{showForm ? 'Close form' : 'New issue'}</button>
            </div>
            {showForm ? <NewIssueForm onCreated={() => { setShowForm(false); void load(); }} /> : null}
          </DashboardSectionPanel>

          <DashboardSectionPanel id="issues-list" title="Issues">
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${tabFormControlBaseClass} !w-64`} placeholder="Search title, details or #" aria-label="Search issues" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className={`${tabFormControlBaseClass} !w-auto`} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="open_all">Not finished</option>
                <option value="all">All statuses</option>
                {ISSUE_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
              </select>
              <select className={`${tabFormControlBaseClass} !w-auto`} aria-label="Type" value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="">All types</option>
                {ISSUE_KINDS.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
              </select>
              <select className={`${tabFormControlBaseClass} !w-auto`} aria-label="Who" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
                <option value="all">Everyone</option>
                <option value="assigned">Assigned to me</option>
                <option value="submitted">Submitted by me</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.82rem]">
                <thead>
                  <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-1 pr-3">#</th><th className="py-1 pr-3">Title</th><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Priority</th>
                    <th className="py-1 pr-3">Submitted by</th><th className="py-1 pr-3">Assigned to</th><th className="py-1 pr-3">Resolved by</th><th className="py-1 pr-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((issue) => (
                    <Fragment key={issue.id}>
                      <tr className="cursor-pointer border-t border-[var(--line)] hover:bg-white/5" onClick={() => setOpenId(openId === issue.id ? null : issue.id)}>
                        <td className="py-1.5 pr-3">{issue.id}</td>
                        <td className="py-1.5 pr-3">
                          <button type="button" className="text-left underline-offset-2 hover:underline" aria-expanded={openId === issue.id} onClick={(event) => { event.stopPropagation(); setOpenId(openId === issue.id ? null : issue.id); }}>{issue.title}</button>{issue.imageCount > 0 ? <span className="ml-2 text-[0.72rem] text-[var(--muted)]" title="Screenshots attached">📎 {issue.imageCount}</span> : null}
                          <span className="ml-2 text-[0.7rem] uppercase text-[var(--muted)]">{KIND_LABELS[issue.kind]}</span>
                        </td>
                        <td className={`py-1.5 pr-3 font-semibold ${STATUS_TONE[issue.status]}`}>{STATUS_LABELS[issue.status]}</td>
                        <td className={`py-1.5 pr-3 ${PRIORITY_TONE[issue.priority]}`}>{cap(issue.priority)}</td>
                        <td className="py-1.5 pr-3">{issue.submittedBy.name}</td>
                        <td className="py-1.5 pr-3">{issue.assignedTo?.name ?? '–'}</td>
                        <td className="py-1.5 pr-3">{issue.resolvedBy?.name ?? '–'}</td>
                        <td className="py-1.5 pr-3">{dateTime.format(new Date(issue.updatedAt))}</td>
                      </tr>
                      {openId === issue.id ? (
                        <tr className="bg-white/5"><td colSpan={8} className="p-4"><IssueDetailPanel id={issue.id} me={data.me} people={data.people} onChanged={() => { void load(); }} /></td></tr>
                      ) : null}
                    </Fragment>
                  ))}
                  {rows.length === 0 ? <tr className="border-t border-[var(--line)]"><td colSpan={8} className="py-4 text-center text-[var(--muted)]">No issues match.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </DashboardSectionPanel>
        </>
      ) : null}
    </AppPageLayout>
  );
}
