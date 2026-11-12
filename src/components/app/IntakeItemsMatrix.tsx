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
  label: ReactNode;
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
  groupColumnLabel?: ReactNode;
  renderGroupCell?: (group: IntakeItemsMatrixGroup<TItem>) => ReactNode;
  groupActionColumnLabel?: ReactNode;
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse table-fixed">
        <colgroup>
          {showGroupColumn ? <col style={{ width: '3.5rem' }} /> : null}
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
          {showGroupActionColumn ? <col style={{ width: '4.75rem' }} /> : null}
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--line)]">
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
            const rowClassName = isStripedGroup ? 'bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]' : 'bg-transparent';
            const groupCellClassName = '';
            const groupActionCellClassName = '';
            const groupStartRowClassName = isNewGroupStart ? 'border-t border-[var(--line)]' : '';
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
                    className={`px-2 py-2.5 align-middle text-center ${groupCellClassName} ${isNewGroupStart ? 'border-t border-t-[var(--line)]' : ''}`}
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
                    className={`px-2 py-2.5 align-middle text-center ${groupActionCellClassName} ${isNewGroupStart ? 'border-t border-t-[var(--line)]' : ''}`}
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