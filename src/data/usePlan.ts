import { useCallback, useState } from 'react';
import { repo, KEYS } from './repo';
import { PLANS, checkFiles, checkQuestion, freshUsage, planById, type Plan, type PlanId, type Usage } from './plans';

/** Plano e uso do dia da pessoa que está logada. Sem backend, vale só neste aparelho. */
export function usePlan(email: string | undefined) {
  const key = email ?? '';
  const [planId, setPlanId] = useState<PlanId>(() => repo.get<PlanId>(KEYS.plan(key), 'free'));
  const [usage, setUsage] = useState<Usage>(() => freshUsage(repo.get<Usage | undefined>(KEYS.usage(key), undefined)));
  const [waitlist, setWaitlist] = useState<PlanId[]>(() => repo.get<PlanId[]>(KEYS.waitlist(key), []));

  const plan: Plan = planById(planId);
  const current = freshUsage(usage);
  const question = checkQuestion(plan, current);

  /** Conta uma pergunta feita. Chame só depois de `question.ok`. */
  const countQuestion = useCallback(() => {
    const base = freshUsage(usage);
    const next = { ...base, questions: base.questions + 1 };
    setUsage(next);
    repo.set(KEYS.usage(key), next);
  }, [usage, key]);

  const canAddFiles = (currentFiles: number, adding: number) => checkFiles(plan, currentFiles, adding);

  const joinWaitlist = (id: PlanId) => {
    if (waitlist.includes(id)) return;
    const next = [...waitlist, id];
    setWaitlist(next);
    repo.set(KEYS.waitlist(key), next);
  };

  /** Só para testes e para quando o pagamento existir no backend. */
  const setPlan = (id: PlanId) => {
    setPlanId(id);
    repo.set(KEYS.plan(key), id);
  };

  return { plan, plans: PLANS, usage: current, question, countQuestion, canAddFiles, waitlist, joinWaitlist, setPlan };
}
