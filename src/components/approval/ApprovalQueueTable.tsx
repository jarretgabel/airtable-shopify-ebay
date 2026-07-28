import { useEffect, useState } from 'react';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { SortableColumnLabel } from '@/components/app/SortableColumnLabel';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';
import { isReadyForRequiredFields } from '@/components/approval/requiredFieldStatus';

type ApprovalQueueSortMode =
	| 'default'
	| 'title-asc'
	| 'title-desc'
	| 'vendor-asc'
	| 'vendor-desc'
	| 'price-desc'
	| 'price-asc'
	| 'sku-asc'
	| 'sku-desc'
	| 'shopify-ready-asc'
	| 'shopify-ready-desc'
	| 'ebay-ready-asc'
	| 'ebay-ready-desc'
	| 'workflow-status-asc'
	| 'workflow-status-desc';

interface ApprovalReadinessColumn {
	key: string;
	label: string;
	requiredFieldNames: string[];
}

interface ApprovalQueueTableProps {
	records: AirtableRecord[];
	approvedFieldName: string;
	requiredFieldNames: string[];
	readinessColumns?: ApprovalReadinessColumn[];
	treatListedWorkflowStatusesAsApproved?: boolean;
	approvedWorkflowStatuses?: string[];
	showLiveChannelStatusForListedRows?: boolean;
	workflowStatusFieldName?: string;
	hideApprovedColumn?: boolean;
	titleFieldName: string;
	conditionFieldName: string;
	formatFieldName: string;
	priceFieldName: string;
	vendorFieldName: string;
	qtyFieldName: string;
	qtyColumnLabel?: string;
	openRecord: (record: AirtableRecord) => void;
	onSelectRecord?: (recordId: string) => void;
	onUpdateQty?: (record: AirtableRecord, nextQty: string) => Promise<void>;
	sortMode?: ApprovalQueueSortMode;
	onSortModeChange?: (nextMode: ApprovalQueueSortMode) => void;
}

const LISTED_WORKFLOW_STATUSES = new Set(['Listed, Shopify', 'Listed, eBay']);

function getListedChannelStatus(record: AirtableRecord): 'shopify' | 'ebay' | null {
	const workflowStatus = displayValue(record.fields['Workflow Status']).trim();
	if (workflowStatus === 'Listed, Shopify') return 'shopify';
	if (workflowStatus === 'Listed, eBay') return 'ebay';
	return null;
}

function isApprovedRecord(record: AirtableRecord, approvedFieldName: string, treatListedWorkflowStatusesAsApproved = false): boolean {
	if (treatListedWorkflowStatusesAsApproved) {
		const workflowStatus = displayValue(record.fields['Workflow Status']).trim();
		if (LISTED_WORKFLOW_STATUSES.has(workflowStatus)) {
			return true;
		}
	}

	const raw = record.fields[approvedFieldName];
	return raw === true || String(raw ?? '').toLowerCase() === 'true' || String(raw ?? '').toLowerCase() === 'yes';
}

function isApprovedByWorkflowStatus(record: AirtableRecord, approvedWorkflowStatuses: string[]): boolean {
	if (approvedWorkflowStatuses.length === 0) return false;
	const workflowStatus = displayValue(record.fields['Workflow Status']).trim();
	return approvedWorkflowStatuses.includes(workflowStatus);
}

function hasMissingRequiredField(record: AirtableRecord, requiredFieldNames: string[]): boolean {
	return !isReadyForRequiredFields(record.fields, requiredFieldNames);
}

function getCell(record: AirtableRecord, fieldName: string): string {
	if (!fieldName.trim()) return '';
	return displayValue(record.fields[fieldName]);
}

function getWorkflowStatusCell(record: AirtableRecord, fieldName: string): string {
	if (!fieldName.trim()) return '';
	const rawValue = record.fields[fieldName];
	if (rawValue === null || rawValue === undefined || rawValue === '') return '';
	const text = displayValue(rawValue).trim();
	return text === '—' ? '' : text;
}

function workflowStatusClasses(status: string): string {
	if (status === 'Approved for Publish') {
		return 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200';
	}

	if (LISTED_WORKFLOW_STATUSES.has(status)) {
		return 'border border-sky-400/35 bg-sky-500/20 text-sky-200';
	}

	if (status === 'Awaiting Pre-Listing Review') {
		return 'border border-amber-400/35 bg-amber-500/20 text-amber-200';
	}

	return 'border border-slate-400/25 bg-slate-500/10 text-slate-300';
}

function nextSortMode(
	currentMode: ApprovalQueueSortMode | undefined,
	ascMode: ApprovalQueueSortMode,
	descMode: ApprovalQueueSortMode,
): ApprovalQueueSortMode {
	if (currentMode === ascMode) return descMode;
	if (currentMode === descMode) return 'default';
	return ascMode;
}

export function ApprovalQueueTable({
	records,
	approvedFieldName,
	requiredFieldNames,
	readinessColumns = [],
	treatListedWorkflowStatusesAsApproved = false,
	approvedWorkflowStatuses = [],
	showLiveChannelStatusForListedRows = false,
	workflowStatusFieldName = '',
	hideApprovedColumn = false,
	titleFieldName,
	conditionFieldName,
	formatFieldName,
	priceFieldName,
	vendorFieldName,
	qtyFieldName,
	qtyColumnLabel = 'Qty',
	openRecord,
	onUpdateQty,
	sortMode,
	onSortModeChange,
}: ApprovalQueueTableProps) {
	const [page, setPage] = useState(1);
	const [editingQtyRecordId, setEditingQtyRecordId] = useState<string | null>(null);
	const [editingQtyValue, setEditingQtyValue] = useState('');
	const [updatingQtyRecordId, setUpdatingQtyRecordId] = useState<string | null>(null);
	const [qtyUpdateError, setQtyUpdateError] = useState<string | null>(null);
	useEffect(() => { setPage(1); }, [records]);
	useEffect(() => {
		if (!editingQtyRecordId) return;
		if (!records.some((record) => record.id === editingQtyRecordId)) {
			setEditingQtyRecordId(null);
			setEditingQtyValue('');
		}
	}, [editingQtyRecordId, records]);

	const startQtyEdit = (record: AirtableRecord) => {
		setQtyUpdateError(null);
		setEditingQtyRecordId(record.id);
		setEditingQtyValue(getCell(record, qtyFieldName));
	};

	const cancelQtyEdit = () => {
		if (updatingQtyRecordId) return;
		setEditingQtyRecordId(null);
		setEditingQtyValue('');
		setQtyUpdateError(null);
	};

	const saveQtyEdit = async (record: AirtableRecord) => {
		if (!onUpdateQty) return;

		setQtyUpdateError(null);
		setUpdatingQtyRecordId(record.id);
		try {
			await onUpdateQty(record, editingQtyValue.trim());
			setEditingQtyRecordId(null);
			setEditingQtyValue('');
		} catch (error) {
			setQtyUpdateError(error instanceof Error ? error.message : 'Unable to update quantity.');
		} finally {
			setUpdatingQtyRecordId(null);
		}
	};

	const totalPages = Math.ceil(records.length / 30);
	const pagedRecords = records.slice((page - 1) * 30, page * 30);

	const titleColumnLabel = onSortModeChange ? (
		<SortableColumnLabel
			label="Title"
			active={sortMode === 'title-asc' || sortMode === 'title-desc'}
			direction={sortMode === 'title-asc' ? 'asc' : sortMode === 'title-desc' ? 'desc' : null}
			onClick={() => onSortModeChange(nextSortMode(sortMode, 'title-asc', 'title-desc'))}
			ariaLabel="Sort listing directory by title"
		/>
	) : 'Title';

	const vendorColumnLabel = onSortModeChange ? (
		<SortableColumnLabel
			label="Vendor"
			active={sortMode === 'vendor-asc' || sortMode === 'vendor-desc'}
			direction={sortMode === 'vendor-asc' ? 'asc' : sortMode === 'vendor-desc' ? 'desc' : null}
			onClick={() => onSortModeChange(nextSortMode(sortMode, 'vendor-asc', 'vendor-desc'))}
			ariaLabel="Sort listing directory by vendor"
		/>
	) : 'Vendor';

	const priceColumnLabel = onSortModeChange ? (
		<SortableColumnLabel
			label="Price"
			active={sortMode === 'price-desc' || sortMode === 'price-asc'}
			direction={sortMode === 'price-asc' ? 'asc' : sortMode === 'price-desc' ? 'desc' : null}
			onClick={() => onSortModeChange(nextSortMode(sortMode, 'price-desc', 'price-asc'))}
			ariaLabel="Sort listing directory by price"
		/>
	) : 'Price';

	const qtyDisplayLabel = typeof qtyColumnLabel === 'string' ? qtyColumnLabel.trim().toLowerCase() : '';
	const skuColumnLabel = onSortModeChange && qtyDisplayLabel === 'sku' ? (
		<SortableColumnLabel
			label="SKU"
			active={sortMode === 'sku-asc' || sortMode === 'sku-desc'}
			direction={sortMode === 'sku-asc' ? 'asc' : sortMode === 'sku-desc' ? 'desc' : null}
			onClick={() => onSortModeChange(nextSortMode(sortMode, 'sku-asc', 'sku-desc'))}
			ariaLabel="Sort listing directory by SKU"
		/>
	) : qtyColumnLabel;

	const workflowStatusColumnLabel = onSortModeChange ? (
		<SortableColumnLabel
			label="Workflow Status"
			active={sortMode === 'workflow-status-asc' || sortMode === 'workflow-status-desc'}
			direction={sortMode === 'workflow-status-asc' ? 'asc' : sortMode === 'workflow-status-desc' ? 'desc' : null}
			onClick={() => onSortModeChange(nextSortMode(sortMode, 'workflow-status-asc', 'workflow-status-desc'))}
			ariaLabel="Sort listing directory by workflow status"
		/>
	) : 'Workflow Status';

	const columns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
		{
			key: 'title',
			label: titleColumnLabel,
			width: 'minmax(0,1.8fr)',
			renderCell: (record) => (
				<div className="min-w-0">
					<div className="truncate font-medium text-[var(--ink)]">{getCell(record, titleFieldName) || '(Untitled)'}</div>
				</div>
			),
		},
		...(
			conditionFieldName
				? [{
					key: 'condition',
					label: 'Condition',
					width: '10rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, conditionFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			formatFieldName
				? [{
					key: 'format',
					label: 'Format',
					width: '9rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, formatFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			priceFieldName
				? [{
					key: 'price',
					label: priceColumnLabel,
					width: '8rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, priceFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			vendorFieldName
				? [{
					key: 'vendor',
					label: vendorColumnLabel,
					width: '10rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, vendorFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			qtyFieldName
				? [{
					key: 'qty',
					label: skuColumnLabel,
					width: '7rem',
					align: 'center',
					renderCell: (record: AirtableRecord) => {
						const isEditing = editingQtyRecordId === record.id;
						const isSavingQty = updatingQtyRecordId === record.id;

						if (isEditing && onUpdateQty) {
							return (
								<div className="flex min-w-[8rem] items-center justify-center gap-2">
									<input
										type="number"
										min="0"
										step="1"
										value={editingQtyValue}
										onChange={(event) => setEditingQtyValue(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												void saveQtyEdit(record);
											}
											if (event.key === 'Escape') {
												event.preventDefault();
												cancelQtyEdit();
											}
										}}
										disabled={isSavingQty}
										className="w-16 rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-center text-sm text-[var(--ink)]"
									/>
									<button
										type="button"
										onClick={() => { void saveQtyEdit(record); }}
										disabled={isSavingQty}
										className="rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-100 disabled:opacity-60"
									>
										{isSavingQty ? '...' : 'Save'}
									</button>
									<button
										type="button"
										onClick={cancelQtyEdit}
										disabled={isSavingQty}
										className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs font-semibold text-[var(--muted)] disabled:opacity-60"
									>
										Cancel
									</button>
								</div>
							);
						}

						return (
							<div className="flex min-w-[7rem] items-center justify-center gap-2">
								<span className="text-[var(--muted)]">{getCell(record, qtyFieldName)}</span>
								{onUpdateQty ? (
									<button
										type="button"
										onClick={() => startQtyEdit(record)}
										className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
									>
										Edit
									</button>
								) : null}
							</div>
						);
					},
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...readinessColumns.map((column) => ({
			key: column.key,
			label: onSortModeChange && (column.key === 'shopify' || column.key === 'ebay')
				? (
					<SortableColumnLabel
						label={column.label}
						active={
							(column.key === 'shopify' && (sortMode === 'shopify-ready-asc' || sortMode === 'shopify-ready-desc'))
							|| (column.key === 'ebay' && (sortMode === 'ebay-ready-asc' || sortMode === 'ebay-ready-desc'))
						}
						direction={
							column.key === 'shopify'
								? (sortMode === 'shopify-ready-asc' ? 'asc' : sortMode === 'shopify-ready-desc' ? 'desc' : null)
								: (sortMode === 'ebay-ready-asc' ? 'asc' : sortMode === 'ebay-ready-desc' ? 'desc' : null)
						}
						onClick={() => onSortModeChange(
							column.key === 'shopify'
								? nextSortMode(sortMode, 'shopify-ready-asc', 'shopify-ready-desc')
								: nextSortMode(sortMode, 'ebay-ready-asc', 'ebay-ready-desc'),
						)}
						ariaLabel={`Sort listing directory by ${column.label}`}
					/>
				)
				: column.label,
			width: '11rem',
			renderCell: (record: AirtableRecord) => {
				const listedChannelStatus = showLiveChannelStatusForListedRows ? getListedChannelStatus(record) : null;
				if (listedChannelStatus) {
					const isLiveChannel = listedChannelStatus === column.key;
					return (
						<span
							className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
								isLiveChannel
									? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
									: 'border border-slate-400/25 bg-slate-500/10 text-slate-300'
							}`}
						>
							{isLiveChannel ? 'Live' : 'Not Live'}
						</span>
					);
				}

				const ready = isReadyForRequiredFields(record.fields, column.requiredFieldNames);
				return (
					<span
						className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
							ready
								? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
								: 'border border-rose-400/35 bg-rose-500/20 text-rose-200'
						}`}
					>
						{ready ? 'Ready' : 'Needs Fields'}
					</span>
				);
			},
		} satisfies IntakeItemsMatrixColumn<AirtableRecord>)),
		...(
			workflowStatusFieldName
				? [{
					key: 'workflow-status',
					label: workflowStatusColumnLabel,
					width: '14rem',
					renderCell: (record: AirtableRecord) => {
						const status = getWorkflowStatusCell(record, workflowStatusFieldName);
						return status
							? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${workflowStatusClasses(status)}`}>{status}</span>
							: <span className="inline-flex rounded-full border border-slate-400/25 bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-300">Not Set</span>;
					},
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			hideApprovedColumn
				? []
				: [{
					key: 'approved',
					label: 'Approved',
					width: '11rem',
					renderCell: (record: AirtableRecord) => {
						const approved = approvedWorkflowStatuses.length > 0
							? isApprovedByWorkflowStatus(record, approvedWorkflowStatuses)
							: isApprovedRecord(record, approvedFieldName, treatListedWorkflowStatusesAsApproved);
						const missingRequired = hasMissingRequiredField(record, requiredFieldNames);

						return (
							<span
								className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
									approved
										? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
										: missingRequired
											? 'border border-rose-400/35 bg-rose-500/20 text-rose-200'
											: 'border border-amber-400/35 bg-amber-500/20 text-amber-200'
								}`}
							>
								{approved ? 'Approved' : missingRequired ? 'Needs Fields' : 'Pending'}
							</span>
						);
					},
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
		),
		{
			key: 'actions',
			label: 'Actions',
			width: '10rem',
			align: 'center',
			headerClassName: 'border-l border-[var(--line)]/60',
			cellClassName: 'border-l border-[var(--line)]/60',
			renderCell: (record) => (
				<div className="flex min-h-[3rem] items-center justify-center gap-1.5">
					<CompactIconActionButton
						label="View Listing"
						variant="small-secondary"
						icon="edit"
						onClick={() => openRecord(record)}
					/>
				</div>
			),
		},
	];

	return (
		<>
			{qtyUpdateError ? (
				<div className="mb-3 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
					{qtyUpdateError}
				</div>
			) : null}
			<IntakeItemsMatrix
				items={pagedRecords}
				columns={columns}
				getItemKey={(record) => record.id}
			/>
			{totalPages > 1 ? (
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-[var(--muted)]">
						Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, records.length)} of {records.length}
					</p>
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => setPage((p) => p - 1)}
							className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--line)] disabled:cursor-not-allowed disabled:opacity-40"
						>
							← Prev
						</button>
						<span className="min-w-[6rem] text-center text-sm text-[var(--muted)]">
							Page {page} of {totalPages}
						</span>
						<button
							type="button"
							disabled={page >= totalPages}
							onClick={() => setPage((p) => p + 1)}
							className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--line)] disabled:cursor-not-allowed disabled:opacity-40"
						>
							Next →
						</button>
					</div>
				</div>
			) : null}
		</>
	);
}
