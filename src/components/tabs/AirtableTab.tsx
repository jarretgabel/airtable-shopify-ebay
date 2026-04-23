import { useEffect, useMemo, useState } from 'react';
import type { AirtableTabViewModel } from '@/app/appTabViewModels';
import { EmptySurface, ErrorSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';
import { loadInventoryDirectory } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

interface AirtableTabProps {
  viewModel: AirtableTabViewModel;
  onAddNewRecord: () => void;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

export function AirtableTab({
  viewModel,
  onAddNewRecord,
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onSelectRecord,
}: AirtableTabProps) {
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(viewModel.error?.message ?? null);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryRefreshing, setDirectoryRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    const loadDirectoryData = async () => {
      setDirectoryLoading(true);
      setDirectoryError(null);

      try {
        const data = await loadInventoryDirectory();
        if (cancelled) return;
        setRecords(data.records);
      } catch (error) {
        if (cancelled) return;
        setDirectoryError(error instanceof Error ? error.message : 'Unable to load SB Inventory directory.');
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    };

    void loadDirectoryData();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusOptions = useMemo(
    () => Array.from(new Set(records
      .map((record) => record.fields.Status)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))
      .sort((left, right) => left.localeCompare(right)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const status = typeof record.fields.Status === 'string' ? record.fields.Status : '';
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        record.fields.SKU,
        record.fields.Make,
        record.fields.Model,
        record.fields['Component Type'],
        record.fields.Status,
      ]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [records, searchTerm, statusFilter]);

  const loadDirectoryData = async () => {
    setDirectoryRefreshing(true);
    setDirectoryError(null);

    try {
      const data = await loadInventoryDirectory();
      setRecords(data.records);
    } catch (error) {
      setDirectoryError(error instanceof Error ? error.message : 'Unable to refresh SB Inventory directory.');
    } finally {
      setDirectoryRefreshing(false);
    }
  };

  if (directoryError && records.length === 0) {
    return <ErrorSurface title="Error loading Airtable records" message={directoryError} />;
  }

  if (directoryLoading && records.length === 0) {
    return <PanelSurface><div className="px-4 py-10 text-center text-sm text-[var(--muted)]">Loading SB Inventory directory...</div></PanelSurface>;
  }

  if (!directoryLoading && records.length === 0) {
    return <EmptySurface title="No inventory rows found" message="SB Inventory currently has no editable rows in this table." />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SB Inventory</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Directory</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Browse existing SB Inventory records, filter the table, and jump directly into the Incoming Gear, Testing, Photos, or full record editor flows.</p>
        </div>

        {directoryError ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {directoryError}
          </div>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Find a Record</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Use search and status filters to find a row, then choose Edit Record to move into the dedicated inventory form page.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={onAddNewRecord}
              >
                Add New
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void loadDirectoryData();
                }}
                disabled={directoryRefreshing}
              >
                {directoryRefreshing ? 'Refreshing...' : 'Refresh Directory'}
              </button>
            </div>
          </div>

          <InventoryDirectoryListSection
            records={filteredRecords}
            totalCount={records.length}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            statusOptions={statusOptions}
            onSearchTermChange={setSearchTerm}
            onStatusFilterChange={setStatusFilter}
            onOpenIncomingGearForm={onOpenIncomingGearForm}
            onOpenTestingForm={onOpenTestingForm}
            onOpenPhotosForm={onOpenPhotosForm}
            onSelectRecord={onSelectRecord}
          />
        </section>
      </div>
    </PanelSurface>
  );
}
