import { Fragment, type ComponentProps, type ReactNode } from 'react';
import { ApprovalFormStandardField } from './ApprovalFormStandardField';
import {
  detailDisclosureBodyClass,
  detailDisclosureClass,
  detailDisclosureSummaryClass,
} from '@/components/tabs/uiClasses';

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
  inlineAfterFieldNames?: string[];
  inlineAfterFieldContent?: ReactNode;
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
    <details className={`${detailDisclosureClass} col-span-1 md:col-span-2`}>
      <summary className={detailDisclosureSummaryClass}>
        Advanced Options
      </summary>
      <div className={`${detailDisclosureBodyClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
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
  inlineAfterFieldNames = [],
  inlineAfterFieldContent,
}: ApprovalFormFieldGridProps) {
  const advancedOptionsBlock = renderAdvancedOptionsBlock(
    showEbayAdvancedOptions,
    ebayAdvancedOptionFieldNames,
    standardFieldProps,
  );
  let hasRenderedInlineAfterFieldContent = false;

  const renderFieldSequence = (fieldNames: string[]) => fieldNames
    .filter((fieldName) => fieldName !== pinnedPreDescriptionFieldName)
    .map((fieldName) => {
      const shouldRenderInlineAfterField = !hasRenderedInlineAfterFieldContent
        && inlineAfterFieldContent
        && inlineAfterFieldNames.some((candidate) => candidate.trim().toLowerCase() === fieldName.trim().toLowerCase());

      if (shouldRenderInlineAfterField) {
        hasRenderedInlineAfterFieldContent = true;
      }

      return (
        <Fragment key={fieldName}>
          {renderStandardField(fieldName, standardFieldProps)}
          {shouldRenderInlineAfterField ? inlineAfterFieldContent : null}
        </Fragment>
      );
    });

  if (showOnlyEbayAdvancedOptions) {
    return <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{advancedOptionsBlock}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {renderFieldSequence(requiredOrderedFieldNames)}

      {pinnedPreDescriptionFieldName && (
        <Fragment key={pinnedPreDescriptionFieldName}>
          {renderStandardField(pinnedPreDescriptionFieldName, standardFieldProps)}
          {!hasRenderedInlineAfterFieldContent
            && inlineAfterFieldContent
            && inlineAfterFieldNames.some((candidate) => candidate.trim().toLowerCase() === pinnedPreDescriptionFieldName.trim().toLowerCase())
            ? (() => {
              hasRenderedInlineAfterFieldContent = true;
              return inlineAfterFieldContent;
            })()
            : null}
        </Fragment>
      )}

      {supplementalEditors}

      {renderFieldSequence(optionalOrderedFieldNames)}

      {!hasRenderedInlineAfterFieldContent ? inlineAfterFieldContent : null}

      {advancedOptionsBlock}
    </div>
  );
}