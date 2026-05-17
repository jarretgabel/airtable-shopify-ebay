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
	titleFieldName: string;
	conditionFieldName: string;
	formatFieldName: string;
	priceFieldName: string;
	vendorFieldName: string;
	qtyFieldName: string;
	openRecord: (record: AirtableRecord) => void;
	onSelectRecord?: (recordId: string) => void;
}

function isApprovedRecord(record: AirtableRecord, approvedFieldName: string): boolean {
	const raw = record.fields[approvedFieldName];
	return raw === true || String(raw ?? '').toLowerCase() === 'true' || String(raw ?? '').toLowerCase() === 'yes';
}

function hasMissingRequiredField(record: AirtableRecord, requiredFieldNames: string[]): boolean {
	return !isReadyForRequiredFields(record.fields, requiredFieldNames);
}

function getCell(record: AirtableRecord, fieldName: string): string {
	if (!fieldName.trim()) return '';
	return displayValue(record.fields[fieldName]);
}

export function ApprovalQueueTable({
	records,
	approvedFieldName,
	requiredFieldNames,
	readinessColumns = [],
	titleFieldName,
	conditionFieldName,
	formatFieldName,
	priceFieldName,
	vendorFieldName,
	qtyFieldName,
	openRecord,
}: ApprovalQueueTableProps) {
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
		{
			key: 'approved',
			label: 'Approved',
			width: '11rem',
			renderCell: (record) => {
				const approved = isApprovedRecord(record, approvedFieldName);
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
		},
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
						onClick={() => openRecord(record)}
					/>
				</div>
			),
		},
	];

	return (
		<IntakeItemsMatrix
			items={records}
			columns={columns}
			getItemKey={(record) => record.id}
		/>
	);
}
