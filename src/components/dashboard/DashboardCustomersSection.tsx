import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { CrmContactDetail, CrmContactRow, CrmDueFollowUp, InteractionKind } from '@/services/app-api/dashboard';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { tabFormControlBaseClass } from '@/components/tabs/uiClasses';
import { DashboardSectionPanel, DashboardSourceWarning, DashboardSubPanel } from './dashboardPrimitives';

type CustomersApi = Pick<typeof dashboardAppApi,
  'searchCrmContacts' | 'getCrmContact' | 'getCrmDueFollowUps' | 'addCrmInteraction' | 'addCrmFollowUp' | 'closeCrmFollowUp'>;

interface DashboardCustomersSectionProps {
  showWarnings?: boolean;
  api?: CustomersApi;
}

const KINDS: InteractionKind[] = ['note', 'call', 'email', 'text', 'visit', 'other'];
const formatDate = (value: string) => new Date(value).toLocaleDateString();

export function DashboardCustomersSection({ showWarnings = false, api = dashboardAppApi }: DashboardCustomersSectionProps) {
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<CrmContactRow[] | null>(null);
  const [due, setDue] = useState<CrmDueFollowUp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [kind, setKind] = useState<InteractionKind>('note');
  const [summary, setSummary] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  const refreshLists = useCallback(async () => {
    const [rows, dueRows] = await Promise.all([api.searchCrmContacts(search.trim()), api.getCrmDueFollowUps()]);
    setContacts(rows);
    setDue(dueRows);
  }, [api, search]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      refreshLists().catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load customers.'); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refreshLists]);

  const openContact = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setActionError(null);
    try {
      setDetail(await api.getCrmContact(id));
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Could not load the customer.');
    }
  }, [api]);

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
      if (selectedId) setDetail(await api.getCrmContact(selectedId));
      await refreshLists();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Could not save.');
    }
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !summary.trim()) return;
    void run(async () => { await api.addCrmInteraction(selectedId, kind, summary.trim()); setSummary(''); });
  };

  const submitFollowUp = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !dueDate || !followUpNote.trim()) return;
    void run(async () => {
      await api.addCrmFollowUp(selectedId, new Date(`${dueDate}T09:00:00`).toISOString(), followUpNote.trim());
      setDueDate('');
      setFollowUpNote('');
    });
  };

  // Customer data comes from the Postgres database, so quietly omit the card when it is unavailable.
  if (error) {
    return showWarnings ? (
      <DashboardSectionPanel id="customers" title="Customers">
        <DashboardSourceWarning title="Customers unavailable" message={error} />
      </DashboardSectionPanel>
    ) : null;
  }
  if (!contacts) return null;

  return (
    <DashboardSectionPanel id="customers" title="Customers">
      {due.length > 0 ? (
        <DashboardSubPanel title={`Follow-ups due (${due.length})`}>
          <ul className="space-y-1 text-[0.82rem] text-[var(--ink)]">
            {due.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <button type="button" className="text-left underline" onClick={() => void openContact(item.contactId)}>{item.contactEmail}</button>
                <span className="flex-1 truncate text-[var(--muted)]">{formatDate(item.dueAt)} · {item.note ?? ''}</span>
                <button type="button" className={smallSecondaryActionButtonClass} onClick={() => void run(() => api.closeCrmFollowUp(item.id, 'done'))}>Done</button>
              </li>
            ))}
          </ul>
        </DashboardSubPanel>
      ) : null}

      <input
        type="search"
        aria-label="Search customers"
        placeholder="Search customers by email, name or phone"
        className={tabFormControlBaseClass}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <table className="mt-3 w-full text-left text-[0.82rem] text-[var(--ink)]">
        <thead>
          <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">
            <th className="py-1 pr-3">Customer</th><th className="py-1 pr-3">Location</th><th className="py-1 pr-3">Items</th><th className="py-1">Open follow-ups</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-t border-[var(--line)]">
              <td className="py-1.5 pr-3">
                <button type="button" className="text-left underline" onClick={() => void openContact(contact.id)}>{contact.name || contact.email}</button>
              </td>
              <td className="py-1.5 pr-3">{contact.location ?? '—'}</td>
              <td className="py-1.5 pr-3">{contact.itemCount}</td>
              <td className="py-1.5">{contact.openFollowUps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {contacts.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No customers match.</p> : null}

      {selectedId ? (
        <DashboardSubPanel title={detail ? `${detail.contact.name || detail.contact.email}` : 'Customer'}>
          {actionError ? <p role="alert" className="mb-2 text-sm">{actionError}</p> : null}
          {!detail && !actionError ? <p>Loading customer…</p> : null}
          {detail ? (
            <div className="space-y-4 text-[0.82rem] text-[var(--ink)]">
              <p>{[detail.contact.email, detail.contact.phone, detail.contact.location].filter(Boolean).join(' · ')}</p>

              <div>
                <h4 className="font-semibold">Items ({detail.items.length})</h4>
                <ul>{detail.items.map((item, index) => (
                  <li key={item.recordId ?? index}>{[item.sku, item.make, item.model].filter(Boolean).join(' ')} — {item.status ?? 'No status'}</li>
                ))}</ul>
              </div>

              <div>
                <h4 className="font-semibold">Notes</h4>
                <form onSubmit={submitNote} className="my-2 flex flex-wrap gap-2">
                  <select aria-label="Kind" className={`${tabFormControlBaseClass} !w-auto`} value={kind} onChange={(event) => setKind(event.target.value as InteractionKind)}>
                    {KINDS.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <input aria-label="Note" className={`${tabFormControlBaseClass} !w-auto flex-1`} placeholder="What happened?" value={summary} onChange={(event) => setSummary(event.target.value)} />
                  <button type="submit" className={smallPrimaryActionButtonClass}>Add note</button>
                </form>
                <ul>{detail.interactions.map((entry) => (
                  <li key={entry.id}>{formatDate(entry.occurredAt)} · {entry.kind} · {entry.summary}{entry.createdBy ? ` (${entry.createdBy})` : ''}</li>
                ))}</ul>
              </div>

              <div>
                <h4 className="font-semibold">Follow-ups</h4>
                <form onSubmit={submitFollowUp} className="my-2 flex flex-wrap gap-2">
                  <input aria-label="Due date" type="date" className={`${tabFormControlBaseClass} !w-auto`} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  <input aria-label="Follow-up note" className={`${tabFormControlBaseClass} !w-auto flex-1`} placeholder="What to follow up on" value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} />
                  <button type="submit" className={smallPrimaryActionButtonClass}>Add follow-up</button>
                </form>
                <ul>{detail.followUps.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2">
                    <span>{formatDate(entry.dueAt)} · {entry.status} · {entry.note}</span>
                    {entry.status === 'open' ? (
                      <>
                        <button type="button" className={smallSecondaryActionButtonClass} onClick={() => void run(() => api.closeCrmFollowUp(entry.id, 'done'))}>Done</button>
                        <button type="button" className={smallSecondaryActionButtonClass} onClick={() => void run(() => api.closeCrmFollowUp(entry.id, 'cancelled'))}>Cancel</button>
                      </>
                    ) : null}
                  </li>
                ))}</ul>
              </div>
            </div>
          ) : null}
        </DashboardSubPanel>
      ) : null}
    </DashboardSectionPanel>
  );
}
