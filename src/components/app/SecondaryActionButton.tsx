import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';

interface SecondaryActionButtonBaseProps {
  children: React.ReactNode;
  className?: string;
}

interface SecondaryActionButtonLinkProps extends SecondaryActionButtonBaseProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  href: string;
}

interface SecondaryActionButtonButtonProps extends SecondaryActionButtonBaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  href?: undefined;
}

export type SecondaryActionButtonProps = SecondaryActionButtonLinkProps | SecondaryActionButtonButtonProps;

export const SecondaryActionButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, SecondaryActionButtonProps>(function SecondaryActionButton(
  { children, className, ...props },
  ref,
) {
  const composedClassName = [secondaryActionButtonClass, className ?? ''].join(' ').trim();

  if ('href' in props && typeof props.href === 'string') {
    return (
      <a
        {...props}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        className={composedClassName}
      >
        {children}
      </a>
    );
  }

  const { type = 'button', ...buttonProps } = props;

  return (
    <button
      {...buttonProps}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type={type}
      className={composedClassName}
    >
      {children}
    </button>
  );
});