-- Add 'rejected' to repurpose_status enum so job-level rejections can be
-- persisted when all derivatives have been reviewed and at least one is rejected.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'rejected' and enumtypid = 'repurpose_status'::regtype
  ) then
    alter type repurpose_status add value 'rejected';
  end if;
end
$$;
