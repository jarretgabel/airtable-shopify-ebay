import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { primaryActionButtonClass } from '@/components/app/buttonStyles';

export interface PrimaryActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ButtonHTMLAttributes<HTMLButtonElement>['children'];
}

export const PrimaryActionButton = forwardRef<HTMLButtonElement, PrimaryActionButtonProps>(function PrimaryActionButton(
  { children, className, type = 'button', ...buttonProps },
  ref,
) {
  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      className={[primaryActionButtonClass, className ?? ''].join(' ').trim()}
    >
      {children}
    </button>
  );
});