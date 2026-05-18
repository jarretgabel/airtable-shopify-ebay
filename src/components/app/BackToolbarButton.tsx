import type { ButtonHTMLAttributes } from 'react';
import { BackToolbarIcon } from '@/components/app/BackToolbarIcon';
import { ToolbarIconButton } from '@/components/app/ToolbarIconButton';

interface BackToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
}

export function BackToolbarButton({ label, ...buttonProps }: BackToolbarButtonProps) {
  return <ToolbarIconButton {...buttonProps} label={label} icon={<BackToolbarIcon />} />;
}