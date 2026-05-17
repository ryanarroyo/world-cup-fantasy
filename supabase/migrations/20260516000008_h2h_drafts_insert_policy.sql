-- H2H Draft Mode — fix: allow the league owner to create the initial
-- h2h_drafts row at league creation time.
--
-- Phase 1 only added a SELECT policy and assumed all writes would go
-- through SECURITY DEFINER functions, but the create-league client flow
-- in src/app/leagues/create/page.tsx does a direct INSERT, which RLS was
-- denying. Subsequent state changes (auto-start trigger, picks, cancel,
-- expiry) all happen in SECURITY DEFINER paths and continue to bypass RLS.
-- The (league_id) primary key on h2h_drafts caps inserts at one per league.

begin;

create policy h2h_drafts_insert_owner on h2h_drafts
  for insert
  with check (
    exists (
      select 1 from leagues
      where leagues.id = h2h_drafts.league_id
        and leagues.owner_id = auth.uid()
        and leagues.mode = 'H2H_DRAFT'
    )
  );

commit;
