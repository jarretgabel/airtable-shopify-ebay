import { useEffect, useState } from 'react';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';
import { isReadyForRequiredFields } from '@/components/approval/requiredFieldStatus';

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
	openRecord: (record: AirtableRecord) => void;
	onSelectRecord?: (recordId: string) => void;
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
	openRecord,
}: ApprovalQueueTableProps) {
	const [page, setPage] = useState(1);
	useEffect(() => { setPage(1); }, [records]);
	const totalPages = Math.ceil(records.length / 30);
	const pagedRecords = records.slice((page - 1) * 30, page * 30);

	const columns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
		{
			key: 'title',
			label: 'Title',
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
					label: 'Price',
					width: '8rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, priceFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			vendorFieldName
				? [{
					key: 'vendor',
					label: 'Vendor',
					width: '10rem',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, vendorFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...(
			qtyFieldName
				? [{
					key: 'qty',
					label: 'Qty',
					width: '7rem',
					align: 'center',
					renderCell: (record: AirtableRecord) => <span className="text-[var(--muted)]">{getCell(record, qtyFieldName)}</span>,
				} satisfies IntakeItemsMatrixColumn<AirtableRecord>]
				: []
		),
		...readinessColumns.map((column) => ({
			key: column.key,
			label: column.label,
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
					label: 'Workflow Status',
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
