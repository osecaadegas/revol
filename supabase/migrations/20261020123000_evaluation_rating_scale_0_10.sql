alter table public.meo_evaluation_answers
  drop constraint if exists meo_evaluation_answers_score_check,
  drop constraint if exists meo_evaluation_answers_check1;

alter table public.meo_evaluation_answers
  add constraint meo_evaluation_answers_score_0_10_check
  check (score is null or score between 0 and 10);

alter table public.meo_evaluation_criteria
  drop constraint if exists meo_evaluation_criteria_rating_check;

alter table public.meo_evaluation_criteria
  add constraint meo_evaluation_criteria_rating_0_10_check
  check (rating between 0 and 10);

comment on constraint meo_evaluation_answers_score_0_10_check on public.meo_evaluation_answers is
  'New evaluation answers use an integer rating from 0 to 10. Historical question versions retain their submitted scoring definition.';
