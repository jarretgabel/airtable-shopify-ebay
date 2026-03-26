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
	return (
		<div className="overflow-hidden rounded-lg border border-[var(--line)]">
			<table className="w-full border-collapse text-left text-sm text-[var(--ink)]">
				<thead className="bg-white/5 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
					<tr>
						<th className="px-3 py-2">Title</th>
						{!!conditionFieldName && <th className="px-3 py-2">Condition</th>}
						{!!formatFieldName && <th className="px-3 py-2">Format</th>}
						{!!priceFieldName && <th className="px-3 py-2">Price</th>}
						{!!vendorFieldName && <th className="px-3 py-2">Vendor</th>}
						{!!qtyFieldName && <th className="px-3 py-2">Qty</th>}
						{readinessColumns.map((column) => <th key={column.key} className="px-3 py-2">{column.label}</th>)}
						<th className="px-3 py-2">Approved</th>
						<th className="px-3 py-2 text-right">Action</th>
					</tr>
				</thead>
				<tbody>
					{records.map((record) => {
						const approved = isApprovedRecord(record, approvedFieldName);
						const missingRequired = hasMissingRequiredField(record, requiredFieldNames);

						return (
							<tr
								key={record.id}
								className="cursor-pointer border-t border-[var(--line)] hover:bg-white/5"
								onClick={() => openRecord(record)}
							>
								<td className="px-3 py-2 font-medium">{getCell(record, titleFieldName) || '(Untitled)'}</td>
								{!!conditionFieldName && <td className="px-3 py-2">{getCell(record, conditionFieldName)}</td>}
								{!!formatFieldName && <td className="px-3 py-2">{getCell(record, formatFieldName)}</td>}
								{!!priceFieldName && <td className="px-3 py-2">{getCell(record, priceFieldName)}</td>}
								{!!vendorFieldName && <td className="px-3 py-2">{getCell(record, vendorFieldName)}</td>}
								{!!qtyFieldName && <td className="px-3 py-2">{getCell(record, qtyFieldName)}</td>}
								{readinessColumns.map((column) => {
									const ready = isReadyForRequiredFields(record.fields, column.requiredFieldNames);
									return (
										<td key={column.key} className="px-3 py-2">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
													ready
														? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-200'
														: 'border border-rose-400/35 bg-rose-500/20 text-rose-200'
												}`}
											>
												{ready ? 'Ready' : 'Needs Fields'}
											</span>
										</td>
									);
								})}
								<td className="px-3 py-2">
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
								</td>
								<td className="px-3 py-2 text-right">
									<button
										type="button"
										className="inline-flex items-center rounded-md border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25"
										onClick={(event) => {
											event.stopPropagation();
											openRecord(record);
										}}
									>
										View Listing
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
