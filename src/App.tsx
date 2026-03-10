import { useState } from 'react';
import { useListings } from '@/hooks/useListings';
import './App.css';

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function hasNonEmptyFields(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => hasValue(value));
}

function recordTitle(fields: Record<string, unknown>): string {
  return displayValue(fields.Brand ?? fields.Name ?? fields.Model ?? 'Untitled Listing');
}

function App() {
  const tableName = import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'tblgA8olAJtkRNZvK';
  const viewId = import.meta.env.VITE_AIRTABLE_VIEW_ID || 'viwPeDA36r1zyeZbU';
  const { listings, loading, error, refetch } = useListings(tableName, viewId);
  const nonEmptyListings = listings.filter((listing) => hasNonEmptyFields(listing.fields));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-container">
        <header className="dashboard-hero">
          <div>
            <p className="hero-kicker">Inventory Operations</p>
            <h1 className="hero-title">Airtable Sync Dashboard</h1>
            <p className="hero-subtitle">Monitor synchronized listing data and review structured records from your configured view.</p>
          </div>
          <div className="hero-meta">
            <p>Table: <code>{tableName}</code></p>
            <p>View: <code>{viewId}</code></p>
          </div>
        </header>

        <section className="stats-row">
          <article className="stat-card">
            <p className="stat-label">Rows Loaded</p>
            <p className="stat-value">{listings.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Rows With Data</p>
            <p className="stat-value">{nonEmptyListings.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Source</p>
            <p className="stat-value stat-value-small">Airtable API</p>
          </article>
        </section>

        <div className="action-row">
          <button
            onClick={refetch}
            disabled={loading}
            className="refresh-button"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {error && (
          <section className="panel error-panel">
            <p className="error-title">Error loading listings</p>
            <p className="error-message">{error.message}</p>
          </section>
        )}

        {loading && !nonEmptyListings.length && (
          <section className="panel loading-panel">
            <div className="loader" />
            <p>Loading records from Airtable...</p>
          </section>
        )}

        {!loading && nonEmptyListings.length > 0 && (
          <section className="panel listings-panel">
            <p className="listings-summary">
              Showing <strong>{nonEmptyListings.length}</strong> rows with meaningful data.
            </p>

            {nonEmptyListings.map((listing) => (
              <article
                key={listing.id}
                className="listing-card"
              >
                <button
                  onClick={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
                  className="listing-toggle"
                >
                  <div className="listing-main">
                    <div>
                      <h3 className="listing-title">{recordTitle(listing.fields)}</h3>
                      <p className="listing-subtitle">
                        Model: <code>{displayValue(listing.fields.Model)}</code>
                      </p>
                    </div>
                    <div className="listing-side">
                      <p className="listing-price">{displayValue(listing.fields.Price)}</p>
                      <p className="listing-meta">
                        Distributor: {displayValue(listing.fields.Distributor)}
                      </p>
                    </div>
                  </div>
                </button>

                {expandedId === listing.id && (
                  <div className="listing-details">
                    <h4>Record Details</h4>
                    <div className="details-grid">
                      <p>
                        <strong>ID:</strong> <code>{listing.id}</code>
                      </p>
                      <p>
                        <strong>Created:</strong>{' '}
                        {new Date(listing.createdTime).toLocaleString()}
                      </p>
                      {hasValue(listing.fields.Component ?? listing.fields['Component Type']) && (
                        <p>
                          <strong>Component:</strong>{' '}
                          {displayValue(listing.fields.Component ?? listing.fields['Component Type'])}
                        </p>
                      )}
                      {hasValue(listing.fields.Status) && (
                        <p>
                          <strong>Status:</strong> {displayValue(listing.fields.Status)}
                        </p>
                      )}
                      <div className="json-block">
                        <p>
                          {JSON.stringify(listing.fields, null, 2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {!loading && nonEmptyListings.length === 0 && !error && (
          <section className="panel empty-panel">
            <p className="empty-title">No non-empty rows found</p>
            <p>Rows with empty field payloads are currently hidden.</p>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
