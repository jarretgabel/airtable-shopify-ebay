const WORKFLOW_STATUS_CHIP_BASE_CLASS_NAME = 'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold leading-none text-center whitespace-nowrap';

export function getWorkflowStatusChipClassName(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'shipped') {
    return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  }

  if (normalizedStatus === 'sold - ready to ship' || normalizedStatus === 'approved for publish') {
    return 'border-sky-400/35 bg-sky-500/15 text-sky-100';
  }

  if (normalizedStatus.includes('listed')) {
    return 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100';
  }

  if (normalizedStatus.includes('stale')) {
    return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
  }

  if (normalizedStatus === 'testing and photography in progress' || normalizedStatus === 'awaiting pre-listing review') {
    return 'border-sky-400/35 bg-sky-500/15 text-sky-100';
  }

  if (normalizedStatus === 'pending review') {
    return 'border-slate-300/20 bg-white/8 text-slate-100';
  }

  if (normalizedStatus.startsWith('accepted - ')) {
    return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
  }

  if (normalizedStatus === 'unqualified') {
    return 'border-rose-400/35 bg-rose-500/15 text-rose-100';
  }

  return 'border-slate-300/15 bg-white/5 text-slate-100';
}

export function getWorkflowStatusChipClasses(status: string): string {
  return `${WORKFLOW_STATUS_CHIP_BASE_CLASS_NAME} ${getWorkflowStatusChipClassName(status)}`;
}