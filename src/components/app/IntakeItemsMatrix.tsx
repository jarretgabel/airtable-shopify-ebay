import type { ReactNode } from 'react';

type IntakeItemsMatrixAlign = 'left' | 'center' | 'right';

export interface IntakeItemsMatrixCellContext<TItem> {
  group: IntakeItemsMatrixGroup<TItem>;
  groupItemIndex: number;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  isGrouped: boolean;
}

export interface IntakeItemsMatrixColumn<TItem> {
  key: string;
  label: string;
  width?: string;
  align?: IntakeItemsMatrixAlign;
  headerClassName?: string;
  cellClassName?: string;
  renderCell: (item: TItem, context: IntakeItemsMatrixCellContext<TItem>) => ReactNode;
}

export interface IntakeItemsMatrixGroup<TItem> {
  id: string;
  label: string;
  description: string;
  items: TItem[];
}

interface IntakeItemsMatrixProps<TItem> {
  items?: TItem[];
  groups?: IntakeItemsMatrixGroup<TItem>[];
  columns: IntakeItemsMatrixColumn<TItem>[];
  getItemKey: (item: TItem) => string;
  groupColumnLabel?: string;
  renderGroupCell?: (group: IntakeItemsMatrixGroup<TItem>) => ReactNode;
  groupActionColumnLabel?: string;
  renderGroupActionCell?: (group: IntakeItemsMatrixGroup<TItem>) => ReactNode;
}

const alignClassNames: Record<IntakeItemsMatrixAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function IntakeItemsMatrix<TItem>({
  items,
  groups,
  columns,
  getItemKey,
  groupColumnLabel = 'Group',
  renderGroupCell,
  groupActionColumnLabel = 'Batch',
  renderGroupActionCell,
}: IntakeItemsMatrixProps<TItem>) {
  const resolvedGroups = groups ?? [{ id: '__default', label: '', description: 'Single record', items: items ?? [] }];
  const showGroupColumn = Boolean(renderGroupCell && groups);
  const showGroupActionColumn = Boolean(renderGroupActionCell && groups);
  const totalRowCount = resolvedGroups.reduce((count, group) => count + group.items.length, 0);
  let renderedRowCount = 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <table className="w-full min-w-[760px] border-collapse table-fixed">
        <colgroup>
          {showGroupColumn ? <col style={{ width: '3.5rem' }} /> : null}
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
          {showGroupActionColumn ? <col style={{ width: '4.75rem' }} /> : null}
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--line)] bg-[var(--panel)]/80">
            {showGroupColumn ? (
              <th
                scope="col"
                className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
              >
                {groupColumnLabel}
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)] ${alignClassNames[column.align ?? 'left']} ${column.headerClassName ?? ''}`}
              >
                {column.label}
              </th>
            ))}
            {showGroupActionColumn ? (
              <th
                scope="col"
                className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
              >
                {groupActionColumnLabel}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {resolvedGroups.flatMap((group, groupIndex) => group.items.map((item, groupItemIndex) => {
            renderedRowCount += 1;
            const isLastRow = renderedRowCount === totalRowCount;
            const isStripedGroup = groupIndex % 2 === 1;
            const isNewGroupStart = groupItemIndex === 0 && groupIndex > 0;
            const rowClassName = isStripedGroup ? 'bg-[color-mix(in_srgb,var(--panel)_28%,transparent)]' : 'bg-transparent';
            const groupCellClassName = isStripedGroup
              ? 'bg-[color-mix(in_srgb,var(--panel)_42%,transparent)]'
              : 'bg-[var(--panel)]/35';
            const groupActionCellClassName = isStripedGroup
              ? 'bg-[color-mix(in_srgb,var(--panel)_24%,transparent)]'
              : 'bg-[var(--panel)]/20';
            const groupStartRowClassName = isNewGroupStart ? 'border-t-2 border-[var(--line)]/90' : '';
            const cellContext: IntakeItemsMatrixCellContext<TItem> = {
              group,
              groupItemIndex,
              isGroupStart: groupItemIndex === 0,
              isGroupEnd: groupItemIndex === group.items.length - 1,
              isGrouped: group.items.length > 1,
            };

            return (
              <tr
                key={getItemKey(item)}
                className={isLastRow ? `align-top ${rowClassName} ${groupStartRowClassName}` : `align-top border-b border-[var(--line)]/70 ${rowClassName} ${groupStartRowClassName}`}
              >
                {showGroupColumn && groupItemIndex === 0 ? (
                  <td
                    rowSpan={group.items.length}
                    className={`border-r border-[var(--line)]/60 px-2 py-2.5 align-middle text-center ${groupCellClassName} ${isNewGroupStart ? 'border-t-2 border-t-[var(--line)]/90' : ''}`}
                  >
                    {renderGroupCell?.(group)}
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2.5 text-sm text-[var(--ink)] ${alignClassNames[column.align ?? 'left']} ${column.cellClassName ?? ''}`}
                  >
                    {column.renderCell(item, cellContext)}
                  </td>
                ))}
                {showGroupActionColumn && groupItemIndex === 0 ? (
                  <td
                    rowSpan={group.items.length}
                    className={`border-l border-[var(--line)]/60 px-2 py-2.5 align-middle text-center ${groupActionCellClassName} ${isNewGroupStart ? 'border-t-2 border-t-[var(--line)]/90' : ''}`}
                  >
                    {renderGroupActionCell?.(group)}
                  </td>
                ) : null}
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}