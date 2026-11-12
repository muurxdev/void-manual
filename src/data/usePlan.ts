import { useCallback, useEffect, useState } from 'react';
import { repo, KEYS } from './repo';
import { supabase } from './supabase';
import { PLANS, checkFiles, checkQuestion, freshUsage, planById, today, type Plan, type PlanId, type Usage } from './plans';

/**
 * Plano e uso do dia da pessoa logada.
 * O servidor é quem manda (plano e limite vivem no banco); o aparelho guarda uma cópia para funcionar sem internet.
 */
export function usePlan(email: string | undefined) {
  const key = email ?? '';
  const [planId, setPlanId] = useState<PlanId>(() => repo.get<PlanId>(KEYS.plan(key), 'free'));
  const [usage, setUsage] = useState<Usage>(() => freshUsage(repo.get<Usage | undefined>(KEYS.usage(key), undefined)));
  const [waitlist, setWaitlist] = useState<PlanId[]>(() => repo.get<PlanId[]>(KEYS.waitlist(key), []));

  const plan: Plan = planById(planId);
  const current = freshUsage(usage);
  const question = checkQuestion(plan, current);

  const save = useCallback(
    (p: PlanId, u: Usage) => {
      setPlanId(p);
      setUsage(u);
      repo.set(KEYS.plan(key), p);
      repo.set(KEYS.usage(key), u);
    },
    [key]
  );

  // ao entrar, traz do servidor o plano e quantas perguntas já foram feitas hoje
  useEffect(() => {
    if (!email) return;
    let live = true;
    (async () => {
      try {
        const [{ data: p }, { data: u }] = await Promise.all([
          supabase.rpc('plano_atual'),
          supabase.from('usage_daily').select('questions').eq('day', today()).maybeSingle(),
        ]);
        if (!live) return;
        const id = (PLANS.some((x) => x.id === p) ? p : 'free') as PlanId;
        save(id, { day: today(), questions: u?.questions ?? 0 });
      } catch {
        /* sem internet: fica com a cópia do aparelho */
      }
    })();
    return () => {
      live = false;
    };
  }, [email, save]);

  /** Conta uma pergunta feita só no aparelho (quando o servidor não respondeu). */
  const countQuestion = useCallback(() => {
    const base = freshUsage(usage);
    save(planId, { ...base, questions: base.questions + 1 });
  }, [usage, planId, save]);

  /** Guarda o que o servidor informou depois de uma pergunta (plano e quantas restam). */
  const applyServer = useCallback(
    (id: string, left: number | null) => {
      const pid = (PLANS.some((x) => x.id === id) ? id : 'free') as PlanId;
      const max = planById(pid).limits.questionsPerDay;
      save(pid, { day: today(), questions: left === null || max === null ? freshUsage(usage).questions : Math.max(0, max - left) });
    },
    [save, usage]
  );

  const canAddFiles = (currentFiles: number, adding: number) => checkFiles(plan, currentFiles, adding);

  const joinWaitlist = (id: PlanId) => {
    if (waitlist.includes(id)) return;
    const next = [...waitlist, id];
    setWaitlist(next);
    repo.set(KEYS.waitlist(key), next);
    // também no servidor, para você ver quem quer assinar
    void supabase.from('waitlist').insert({ plan: id }).then(() => undefined);
  };

  /** Só para testes e para quando o pagamento existir no backend. */
  const setPlan = (id: PlanId) => save(id, usage);

  return { plan, plans: PLANS, usage: current, question, countQuestion, applyServer, canAddFiles, waitlist, joinWaitlist, setPlan };
}
