import { SectionPillNav } from '@/components/app/SectionPillNav';

interface MainPageSectionNavItem<T extends string> {
  key: T;
  label: string;
}

interface MainPageSectionNavProps<T extends string> {
  ariaLabel: string;
  items: MainPageSectionNavItem<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  className?: string;
}

export function MainPageSectionNav<T extends string>({
  ariaLabel,
  items,
  activeKey,
  onSelect,
  className,
}: MainPageSectionNavProps<T>) {
  return (
    <SectionPillNav
      ariaLabel={ariaLabel}
      items={items}
      activeKey={activeKey}
      onSelect={onSelect}
      className={[
        'sticky top-3 z-20',
        className ?? '',
      ].join(' ').trim()}
    />
  );
}