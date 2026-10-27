-- Query statistics for finding slow queries (pg_stat_statements is already preloaded on RDS).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
