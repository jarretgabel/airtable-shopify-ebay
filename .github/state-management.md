# State Management Patterns

## Zustand Store Architecture

### When to Use Each
| Pattern | Use Case |
|---------|----------|
| **Zustand Store** | App-wide or feature-persistent state (approvals, listings, user data) |
| **React Hook (useState)** | Transient UI state (form inputs, dropdowns, expanded rows) |
| **Context** | Auth context, theme provider (app-level wiring) |
| **Custom Hook** | Complex state logic with side effects (data fetching, polling) |

### Store Organization
Each Zustand store lives in `src/stores/{domain}/` with three files:

```
src/stores/approval/
├── approvalStore.ts           # Main export, Zustand create() + re-exports
├── approvalStoreTypes.ts      # interface Store { ... }
├── approvalStoreConstants.ts  # CONSTANTS, fallback values
├── approvalStoreFieldUtils.ts # Pure helper functions
└── approvalStore.test.ts      # Unit tests for store logic
```

### Store File Structure

**approvalStoreTypes.ts** — Define store interface
```typescript
export interface ApprovalStore {
  records: AirtableRecord[];
  loading: boolean;
  error: string | null;
  
  setFormValue: (fieldName: string, value: string) => void;
  loadRecords: (tableRef: string) => Promise<void>;
  saveRecord: (...) => Promise<void>;
}
```

**approvalStoreConstants.ts** — Static values, defaults
```typescript
export const DEFAULT_APPROVAL_TABLE_REFERENCE = 'tableId/viewId';
export const FALLBACK_LISTING_FORMAT_OPTIONS = ['Buy It Now', 'Auction'];
export const SHIPPING_SERVICE_FIELD = 'Domestic Service 1';
```

**approvalStoreFieldUtils.ts** — Pure transformations (no Zustand)
```typescript
export function inferFieldKind(value: unknown): ApprovalFieldKind {
  // Pure computation, returns type hint
}

export function isShippingServiceField(fieldName: string): boolean {
  // Pure predicate
}

export function resolveListingFormatOptions(formats: string[]): string[] {
  // Pure transformation
}
```

**approvalStore.ts** — Zustand creation + orchestration
```typescript
import { create } from 'zustand';
import airtableService from '@/services/airtable';
import {
  FALLBACK_LISTING_FORMAT_OPTIONS,
  SHIPPING_SERVICE_FIELD,
  DEFAULT_APPROVAL_TABLE_REFERENCE,
} from '@/stores/approval/approvalStoreConstants';
import {
  inferFieldKind,
  isShippingServiceField,
  resolveListingFormatOptions,
} from '@/stores/approval/approvalStoreFieldUtils';
import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

// Re-export types and constants for public API
export {
  DEFAULT_APPROVAL_TABLE_REFERENCE,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  SHIPPING_SERVICE_FIELD,
} from '@/stores/approval/approvalStoreConstants';
export {
  inferFieldKind,
  isShippingServiceField,
} from '@/stores/approval/approvalStoreFieldUtils';
export type { ApprovalStore } from '@/stores/approval/approvalStoreTypes';

// Main store export
export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  records: [],
  loading: true,
  saving: false,
  error: null,

  setFormValue(fieldName, value) {
    set((state) => ({
      formValues: { ...state.formValues, [fieldName]: value },
    }));
  },

  async loadRecords(tableReference, fallbackTableName) {
    set({ loading: true, error: null });
    try {
      const records = await airtableService.getRecordsFromReference(
        tableReference,
        fallbackTableName
      );
      set({ records, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      });
    }
  },
}));
```

## Selector Patterns

### Rule: Keep Selectors Primitive-Safe
Avoid selectors that return fresh arrays/objects each render, as they trigger infinite `getSnapshot` warnings in React 18:

❌ **Bad** — Fresh object each call:
```typescript
const state = useApprovalStore((s) => ({ records: s.records, error: s.error }));
```

✅ **Good** — Primitive or function:
```typescript
const records = useApprovalStore((s) => s.records);
const error = useApprovalStore((s) => s.error);
const saveRecord = useApprovalStore((s) => s.saveRecord);
```

✅ **OK** — With shallow memoization (if absolutely needed):
```typescript
import { useShallow } from 'zustand/react';

const state = useApprovalStore(
  useShallow((s) => ({ records: s.records, error: s.error }))
);
```

### Derived/Computed Selectors
Place computations **outside** the store. Use hooks:

```typescript
// src/hooks/useApprovalQueueSummary.ts
export function useApprovalQueueSummary(enabled: boolean) {
  const records = useApprovalStore((s) => s.records);
  const loading = useApprovalStore((s) => s.loading);

  const pending = useMemo(() => 
    records.filter((r) => !isApprovedValue(r.fields['Approved'])).length,
    [records]
  );
  const approved = records.length - pending;

  return { pending, approved, total: records.length, loading, refetch: (...) => ... };
}
```

## Hook-Based State for Complex Logic

### Pattern: Data Fetching + Polling Hooks
Use custom hooks when state involves side effects and lifecycle:

```typescript
// src/hooks/useJotFormInquiries.ts
export function useJotFormInquiries(formId: string) {
  const [submissions, setSubmissions] = useState<JotFormSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFormSubmissions(formId);
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetch]);

  return { submissions, loading, error, refetch: fetch };
}
```

### Return Shape Standards
Keep hook return objects consistent:

```typescript
export function useFeature() {
  return {
    // Data
    data: [],
    
    // Loading states
    loading: false,
    error: null,
    
    // Actions
    refetch: async () => { ... },
    reset: () => { ... },
  };
}
```

## Auth Context Pattern

Wrap protected state in context at app root:

```typescript
// src/auth/AuthContext.tsx
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  
  // ... session restore, login, logout

  return (
    <AuthContext.Provider value={{ currentUser, users, ... }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

## Avoiding Infinite Loops and Re-renders

### Problem: Object/Array Identity
Each Zustand selector call creates new object identity → React thinks props changed → component re-renders.

### Solutions

**Option 1: Split into multiple selectors**
```typescript
// ✅ Only updates when actionA changes
const actionA = useFeatureStore((s) => s.actionA);
const actionB = useFeatureStore((s) => s.actionB);
```

**Option 2: Use `useShallow` for record/array if must select multiple**
```typescript
import { useShallow } from 'zustand/react';

// ✅ Returns same object reference if shallow values unchanged
const state = useFeatureStore(
  useShallow((s) => ({ actionA: s.actionA, actionB: s.actionB }))
);
```

**Option 3: Memoize in component**
```typescript
const state = useMemo(
  () => ({ actionA, actionB }),
  [actionA, actionB]
);
// Pass state as prop only if both actionA and actionB change together
```

## Environment Variable Defaults

Gracefully handle missing env vars in stores:

```typescript
// src/stores/approval/approvalStore.ts
const DEFAULT_TABLE_REF = (
  import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF ||
  'DEFAULT_FALLBACK_REF'
) as string;

// Or construct on demand
async loadRecords(tableReference?: string) {
  const ref = tableReference || (
    import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined
  );
  if (!ref) {
    set({ error: 'Missing table reference in env vars' });
    return;
  }
  // ... fetch
}
```

## Testing Stores

Unit test store logic separately from React:

```typescript
// src/stores/approval/approvalStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useApprovalStore } from './approvalStore';

describe('useApprovalStore', () => {
  beforeEach(() => {
    useApprovalStore.getState().reset?.(); // Reset before each test
  });

  it('should set form value', () => {
    const { result } = renderHook(() => useApprovalStore());
    
    act(() => {
      result.current.setFormValue('fieldName', 'value');
    });

    expect(result.current.formValues.fieldName).toBe('value');
  });

  it('should load records and set loading state', async () => {
    // Mock airtableService
    const { result } = renderHook(() => useApprovalStore());
    
    expect(result.current.loading).toBe(true);
    
    await act(async () => {
      await result.current.loadRecords('tableRef', 'fallback');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.records).toEqual([...]);
  });
});
```

## Checklist for New Stores

- [ ] Three-file structure: `*Store.ts`, `*StoreTypes.ts`, `*StoreConstants.ts`
- [ ] Helper functions extracted to `*StoreUtils.ts` or `*FieldUtils.ts`
- [ ] Main store re-exports types and helpers (barrel pattern)
- [ ] All side effects (API calls) wrapped in async actions
- [ ] Error states included (`error: string | null`)
- [ ] Loading states reflect async operations
- [ ] Selectors use primitives or functions (avoid object literals)
- [ ] Environment variable defaults handled gracefully
- [ ] Store tested with `renderHook` and `act`
- [ ] Hook wrapper created in `src/hooks/use{Feature}...` for consumption
