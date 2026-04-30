import type { ComponentProps, ReactNode } from 'react';
import { ApprovalFormStandardField } from './ApprovalFormStandardField';

type StandardFieldSharedProps = Omit<ComponentProps<typeof ApprovalFormStandardField>, 'fieldName'>;

interface ApprovalFormFieldGridProps {
  showOnlyEbayAdvancedOptions: boolean;
  showEbayAdvancedOptions: boolean;
  ebayAdvancedOptionFieldNames: string[];
  requiredOrderedFieldNames: string[];
  optionalOrderedFieldNames: string[];
  pinnedPreDescriptionFieldName?: string;
  standardFieldProps: StandardFieldSharedProps;
  supplementalEditors: ReactNode;
}

function renderStandardField(
  fieldName: string,
  standardFieldProps: StandardFieldSharedProps,
  allowAdvancedOptionField = false,
) {
  return (
    <ApprovalFormStandardField
      key={fieldName}
      fieldName={fieldName}
      allowAdvancedOptionField={allowAdvancedOptionField}
      {...standardFieldProps}
    />
  );
}

function renderAdvancedOptionsBlock(
  showEbayAdvancedOptions: boolean,
  ebayAdvancedOptionFieldNames: string[],
  standardFieldProps: StandardFieldSharedProps,
): ReactNode {
  if (!showEbayAdvancedOptions || ebayAdvancedOptionFieldNames.length === 0) return null;

  return (
    <details className="col-span-1 rounded-lg border border-[var(--line)] bg-white/5 md:col-span-2">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[var(--ink)]">
        Advanced Options
      </summary>
      <div className="grid grid-cols-1 gap-4 border-t border-[var(--line)] px-3 py-3 md:grid-cols-2">
        {ebayAdvancedOptionFieldNames.map((fieldName) => renderStandardField(fieldName, standardFieldProps, true))}
      </div>
    </details>
  );
}

export function ApprovalFormFieldGrid({
  showOnlyEbayAdvancedOptions,
  showEbayAdvancedOptions,
  ebayAdvancedOptionFieldNames,
  requiredOrderedFieldNames,
  optionalOrderedFieldNames,
  pinnedPreDescriptionFieldName,
  standardFieldProps,
  supplementalEditors,
}: ApprovalFormFieldGridProps) {
  const advancedOptionsBlock = renderAdvancedOptionsBlock(
    showEbayAdvancedOptions,
    ebayAdvancedOptionFieldNames,
    standardFieldProps,
  );

  if (showOnlyEbayAdvancedOptions) {
    return <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{advancedOptionsBlock}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {requiredOrderedFieldNames
        .filter((fieldName) => fieldName !== pinnedPreDescriptionFieldName)
        .map((fieldName) => renderStandardField(fieldName, standardFieldProps))}

      {pinnedPreDescriptionFieldName && renderStandardField(pinnedPreDescriptionFieldName, standardFieldProps)}

      {supplementalEditors}

      {optionalOrderedFieldNames
        .filter((fieldName) => fieldName !== pinnedPreDescriptionFieldName)
        .map((fieldName) => renderStandardField(fieldName, standardFieldProps))}

      {advancedOptionsBlock}
    </div>
  );
}