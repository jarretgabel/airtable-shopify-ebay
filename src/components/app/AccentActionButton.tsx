import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { accentActionButtonClass } from '@/components/app/buttonStyles';

export interface AccentActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ButtonHTMLAttributes<HTMLButtonElement>['children'];
}

export const AccentActionButton = forwardRef<HTMLButtonElement, AccentActionButtonProps>(function AccentActionButton(
  { children, className, type = 'button', ...buttonProps },
  ref,
) {
  return (
    <button
      {...buttonProps}
      ref={ref}
      type={type}
      className={[accentActionButtonClass, className ?? ''].join(' ').trim()}
    >
      {children}
    </button>
  );
});