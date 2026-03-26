import type { ChangeEventHandler, ReactNode } from 'react';

interface ApprovalSelectProps {
	children: ReactNode;
	selectClassName: string;
	value: string;
	onChange: ChangeEventHandler<HTMLSelectElement>;
	disabled?: boolean;
}

export function ApprovalSelect({ children, selectClassName, value, onChange, disabled = false }: ApprovalSelectProps) {
	return (
		<div className="relative">
			<select className={selectClassName} value={value} onChange={onChange} disabled={disabled}>
				{children}
			</select>
			<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--muted)]" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
					<path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.144l3.71-3.914a.75.75 0 1 1 1.08 1.04l-4.25 4.484a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
				</svg>
			</span>
		</div>
	);
}
