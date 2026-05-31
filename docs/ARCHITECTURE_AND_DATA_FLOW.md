# Architecture & Data Flow Diagrams

Below are Mermaid diagrams illustrating the high-level architecture and data flow for the Airtable-Shopify-eBay Sync app.

## App Architecture

```mermaid
graph TD
    A[Frontend (React)] -->|REST| B(Airtable API)
    A -->|REST| C(Shopify API)
    A -->|REST| D(eBay API)
    A -->|Webhooks| E(Node.js/Express Backend)
    E -->|DB| F[(SQLite/PostgreSQL)]
    E -->|Sync| B
    E -->|Sync| C
    E -->|Sync| D
```

## Workflow Image Metadata Flow

```mermaid
graph TD
    U[User Uploads Image] --> F[Form UI]
    F --> A[Images Attachment Field]
    F --> M[Workflow Image Metadata JSON]
    A & M --> L[Listing/Workflow UI]
    L -->|Display| U
```

## Listing Sync Flow

```mermaid
graph TD
    AT[Airtable Record] <--> SYNC[Sync Orchestrator]
    SYNC <--> SH[Shopify Product]
    SYNC <--> EB[eBay Listing]
    SYNC --> LOG[Activity Log]
```
```
