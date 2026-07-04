These scripts were pasted directly into the Supabase SQL editor at some point
(not applied via `supabase db push`), so they never matched the
`<timestamp>_name.sql` pattern the CLI expects and were being skipped by
`supabase migration list`/`db push` anyway, causing drift between this repo
and the actual database.

They are already applied to the database — moved here for reference only,
not for re-execution. Do not run these against the database again.
