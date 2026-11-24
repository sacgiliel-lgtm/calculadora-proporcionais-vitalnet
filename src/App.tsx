import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "reativacao" | "vencimento" | "upgrade";
type UnlockCount = "0" | "1" | "2" | "3";
type Saved = { id: string; mode: Mode; title: string; total: number; date: string; details: string };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateFrom = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, days: number) => {
  const d = dateFrom(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};
const dayDiff = (a: string, b: string) => Math.round((dateFrom(b).getTime() - dateFrom(a).getTime()) / 86400000);
const dateBR = (s: string) => (s ? dateFrom(s).toLocaleDateString("pt-BR") : "—");
const moneyNumber = (s: string) => Number(s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
const round5 = (n: number) => Math.round(n / 5) * 5;
const safe = (n: number) => Number(n.toFixed(2));

// Feriados nacionais fixos (MM-DD)
const FIXED_HOLIDAYS_MMDD = new Set([
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência do Brasil
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
]);

const parseCustomHolidays = (raw: string): Set<string> => {
  const set = new Set<string>();
  raw
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(item)) {
        set.add(item);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(item)) {
        const [d, m, y] = item.split("/");
        set.add(`${y}-${m}-${d}`);
      } else if (/^\d{2}\/\d{2}$/.test(item)) {
        const [d, m] = item.split("/");
        set.add(`MM-DD:${m}-${d}`);
      }
    });
  return set;
};

const isNonBlockingDay = (isoDate: string, customHolidays: Set<string>): boolean => {
  const d = dateFrom(isoDate);
  const dow = d.getDay(); // 0 = Domingo, 6 = Sábado
  if (dow === 0 || dow === 6) return true;
  const mmdd = isoDate.slice(5);
  if (FIXED_HOLIDAYS_MMDD.has(mmdd)) return true;
  if (customHolidays.has(isoDate) || customHolidays.has(`MM-DD:${mmdd}`)) return true;
  return false;
};

/**
 * Calcula a data efetiva de bloqueio a partir da data da solicitação do desbloqueio:
 * - O desbloqueio vale até a meia-noite do dia solicitado (a data efetiva base é o próprio dia solicitado).
 * - Se o dia seguinte (virada da meia-noite) cair em sábado, domingo ou feriado, não bloqueia
 *   e o uso se estende até o último dia não útil consecutivo antes do próximo dia útil.
 */
const resolveEffectiveBlockDate = (
  unlockRequestDate: string,
  customHolidaysRaw: string
): { effectiveDate: string; extendedDays: number; nextBusinessDay: string } => {
  if (!unlockRequestDate) {
    return { effectiveDate: "", extendedDays: 0, nextBusinessDay: "" };
  }
  const customHolidays = parseCustomHolidays(customHolidaysRaw);
  let cursor = unlockRequestDate;
  let extendedDays = 0;

  while (true) {
    const nextDay = addDays(cursor, 1);
    if (isNonBlockingDay(nextDay, customHolidays)) {
      cursor = nextDay;
      extendedDays += 1;
    } else {
      return {
        effectiveDate: cursor,
        extendedDays,
        nextBusinessDay: nextDay,
      };
    }
  }
};

const DEFAULTS = {
  monthly: "80,00",
  due: "2026-10-29",
  blocked: "2026-11-06",
  unlockCount: "0" as UnlockCount,
  unlockRequestDate: "",
  customHolidays: "",
  nextDue: "2026-11-29",
  oldDue: "2026-11-25",
  newDue: "2026-12-10",
  oldPlan: "100,00",
  newPlan: "160,00",
  upgradeDue: "2026-12-10",
};

const modes: { id: Mode; label: string; short: string; badge: string; icon: JSX.Element }[] = [
  {
    id: "reativacao",
    label: "Reativação",
    short: "Regularização e retorno da conexão",
    badge: "REGULARIZAÇÃO",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    ),
  },
  {
    id: "vencimento",
    label: "Troca de vencimento",
    short: "Ajuste entre duas datas de cobrança",
    badge: "ALTERAÇÃO DE DATA",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    id: "upgrade",
    label: "Upgrade de plano",
    short: "Diferença proporcional entre planos",
    badge: "MUDANÇA DE PLANO",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
];

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  placeholder,
  prefix,
  required = true,
  isSample = false,
  warning,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date";
  hint?: string;
  placeholder?: string;
  prefix?: string;
  required?: boolean;
  isSample?: boolean;
  warning?: string;
  readOnly?: boolean;
}) {
  const isEmpty = required && value.trim() === "";
  const hasWarning = !isEmpty && !!warning;
  return (
    <label
      className={`field ${isEmpty ? "is-empty" : ""} ${hasWarning ? "has-warning" : ""} ${!isEmpty && !hasWarning && isSample ? "is-sample" : ""}`}
    >
      <div className="field-label-row">
        <span>{label}</span>
        {isEmpty ? (
          <span className="empty-badge">Campo vazio</span>
        ) : hasWarning ? (
          <span className="warn-badge">Confira</span>
        ) : (
          isSample && <span className="sample-badge">Exemplo</span>
        )}
      </div>
      <div className={`input-wrap ${prefix ? "has-prefix" : ""} ${isEmpty ? "invalid" : ""} ${hasWarning ? "warn" : ""}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={isEmpty}
          readOnly={readOnly}
        />
      </div>
      {isEmpty ? (
        <small className="error-text">Preencha este campo para calcular corretamente.</small>
      ) : hasWarning ? (
        <small className="warn-text">{warning}</small>
      ) : (
        hint && <small>{hint}</small>
      )}
    </label>
  );
}

function ResultLine({
  label,
  value,
  muted = false,
  highlight = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`result-line ${muted ? "muted" : ""} ${highlight ? "highlight" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("reativacao");
  const [monthly, setMonthly] = useState(DEFAULTS.monthly);
  const [due, setDue] = useState(DEFAULTS.due);
  const [blocked, setBlocked] = useState(DEFAULTS.blocked);
  const [unlockCount, setUnlockCount] = useState<UnlockCount>(DEFAULTS.unlockCount);
  const [unlockRequestDate, setUnlockRequestDate] = useState(DEFAULTS.unlockRequestDate);
  const [customHolidays, setCustomHolidays] = useState(DEFAULTS.customHolidays);
  const [reactivation, setReactivation] = useState(() => today());
  const [nextDue, setNextDue] = useState(DEFAULTS.nextDue);
  const [oldDue, setOldDue] = useState(DEFAULTS.oldDue);
  const [newDue, setNewDue] = useState(DEFAULTS.newDue);
  const [oldPlan, setOldPlan] = useState(DEFAULTS.oldPlan);
  const [newPlan, setNewPlan] = useState(DEFAULTS.newPlan);
  const [equipmentDate, setEquipmentDate] = useState("");
  const [upgradeDue, setUpgradeDue] = useState(DEFAULTS.upgradeDue);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Saved[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vitalnet-proportional-history") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("vitalnet-proportional-history", JSON.stringify(history));
    } catch {
      /* armazenamento indisponível (ex.: aba privada): segue sem persistir */
    }
  }, [history]);

  useEffect(() => {
    if (!showHowItWorks && !showHistory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShowHowItWorks(false);
      setShowHistory(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHowItWorks, showHistory]);

  // Ao abrir a gaveta do histórico, leva o foco para o botão de fechar e dispensa avisos pendentes
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showHistory) return;
    drawerCloseRef.current?.focus();
    setToast("");
  }, [showHistory]);

  // Avisos somem sozinhos após alguns segundos
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const m = moneyNumber(monthly),
    oldM = moneyNumber(oldPlan),
    newM = moneyNumber(newPlan);

  const hasUnlock = unlockCount !== "0";

  const unlockResolution = useMemo(() => {
    if (!hasUnlock || !unlockRequestDate) {
      return { effectiveDate: "", extendedDays: 0, nextBusinessDay: "" };
    }
    return resolveEffectiveBlockDate(unlockRequestDate, customHolidays);
  }, [hasUnlock, unlockRequestDate, customHolidays]);

  const effectiveBlockedDate = useMemo(() => {
    if (hasUnlock && unlockResolution.effectiveDate) {
      return unlockResolution.effectiveDate;
    }
    return blocked;
  }, [hasUnlock, unlockResolution.effectiveDate, blocked]);

  const hasSampleValues = useMemo(() => {
    if (mode === "reativacao") {
      return (
        monthly === DEFAULTS.monthly ||
        due === DEFAULTS.due ||
        (!hasUnlock && blocked === DEFAULTS.blocked) ||
        nextDue === DEFAULTS.nextDue
      );
    }
    if (mode === "vencimento") {
      return monthly === DEFAULTS.monthly || oldDue === DEFAULTS.oldDue || newDue === DEFAULTS.newDue;
    }
    return oldPlan === DEFAULTS.oldPlan || newPlan === DEFAULTS.newPlan || upgradeDue === DEFAULTS.upgradeDue;
  }, [mode, monthly, due, hasUnlock, blocked, nextDue, oldDue, newDue, oldPlan, newPlan, upgradeDue]);

  // Avisos (não bloqueiam o cálculo): datas que contradizem o fluxo normal da reativação
  const dateWarnings = useMemo(() => {
    const w: { blocked?: string; reactivation?: string } = {};
    if (mode !== "reativacao") return w;
    if (due && effectiveBlockedDate && dayDiff(due, effectiveBlockedDate) < 0)
      w.blocked = "O bloqueio está antes do vencimento: nenhum dia de uso após o vencimento será contado.";
    if (reactivation && nextDue && dayDiff(reactivation, nextDue) < 0)
      w.reactivation = "A reativação está depois do próximo vencimento: nenhum dia futuro será contado.";
    return w;
  }, [mode, due, effectiveBlockedDate, reactivation, nextDue]);
  const hasDateWarnings = Object.keys(dateWarnings).length > 0;

  const calc = useMemo(() => {
    if (mode === "reativacao") {
      const daily = safe(m / 30);
      const usedDays = due && effectiveBlockedDate ? Math.max(0, dayDiff(due, effectiveBlockedDate)) : 0;
      const futureDays = reactivation && nextDue ? Math.max(0, dayDiff(reactivation, nextDue) + 1) : 0;
      const used = safe(daily * usedDays),
        future = safe(daily * futureDays),
        raw = safe(used + future),
        rounded = round5(raw);
      const unlockValid = !hasUnlock || !!unlockRequestDate;
      return {
        daily,
        usedDays,
        futureDays,
        used,
        future,
        raw,
        rounded,
        total: rounded,
        effectiveBlockedDate,
        extendedDays: unlockResolution.extendedDays,
        nextBusinessDay: unlockResolution.nextBusinessDay,
        valid:
          m > 0 &&
          usedDays >= 0 &&
          futureDays >= 0 &&
          !!due &&
          !!effectiveBlockedDate &&
          !!reactivation &&
          !!nextDue &&
          unlockValid,
      };
    }
    if (mode === "vencimento") {
      const daily = safe(m / 30),
        days = oldDue && newDue ? Math.max(0, dayDiff(oldDue, newDue)) : 0;
      const raw = safe(daily * days),
        rounded = round5(raw),
        fee = 1.2,
        total = safe(m + rounded + fee);
      return { daily, days, raw, rounded, fee, total, valid: m > 0 && !!oldDue && !!newDue && dayDiff(oldDue, newDue) > 0 };
    }
    const difference = safe(newM - oldM),
      daily = safe(difference / 30),
      start = equipmentDate || today();
    const days = upgradeDue && start ? Math.max(0, dayDiff(start, upgradeDue)) : 0;
    const raw = safe(daily * days),
      rounded = round5(raw),
      total = safe(newM + rounded);
    return { difference, daily, days, start, raw, rounded, total, valid: oldM >= 0 && newM > oldM && !!upgradeDue && days > 0 };
  }, [
    mode,
    m,
    due,
    effectiveBlockedDate,
    reactivation,
    nextDue,
    hasUnlock,
    unlockRequestDate,
    unlockResolution.extendedDays,
    unlockResolution.nextBusinessDay,
    oldDue,
    newDue,
    oldM,
    newM,
    equipmentDate,
    upgradeDue,
  ]);

  const message = useMemo(() => {
    // Sem dados válidos não existe mensagem: evita copiar um texto com "R$ 0,00" e datas "—"
    if (!(calc as any).valid) return "";
    if (mode === "reativacao") {
      const c = calc as any;
      const unlockNote =
        hasUnlock && unlockRequestDate
          ? ` (considerando o ${unlockCount}º desbloqueio solicitado em ${dateBR(unlockRequestDate)}${
              c.extendedDays > 0
                ? `, estendido até ${dateBR(c.effectiveBlockedDate)} por fim de semana/feriado`
                : ""
            })`
          : "";
      return `Verifiquei que sua mensalidade é no valor de ${brl(m)}.\n\nPara regularizar e reativar a conexão, precisamos considerar os dias em que o serviço foi utilizado após o vencimento do primeiro boleto.\n\nA sua conexão continuou funcionando até o dia ${dateBR(c.effectiveBlockedDate)}${unlockNote}, ou seja, foram ${c.usedDays} dias de uso após o vencimento de ${dateBR(due)}.\nTambém estamos considerando a ativação da conexão de ${dateBR(reactivation)} até o próximo vencimento, que será em ${dateBR(nextDue)}, totalizando ${c.futureDays} dias de uso.\n\nFizemos o cálculo proporcional da seguinte forma:\n\n📌 ${brl(m)} / 30 dias = ${brl(c.daily)} por dia de uso\n\n${c.usedDays} dias usados após o vencimento de ${dateBR(due)}\n→ ${c.usedDays} x ${brl(c.daily)} = ${brl(c.used)}\n\n${c.futureDays} dias de hoje até o próximo vencimento (${dateBR(nextDue)})\n→ ${c.futureDays} x ${brl(c.daily)} = ${brl(c.future)}\n\n✅ Valor total calculado: ${brl(c.used)} + ${brl(c.future)} = ${brl(c.raw)}\n\nPorém, iremos arredondar o valor para ${brl(c.rounded)}.\n\nEsse valor cobre o período em que o serviço foi utilizado e o período que será utilizado até o próximo vencimento.`;
    }
    if (mode === "vencimento") {
      const c = calc as any;
      return `Quando um cliente solicita a mudança da data de vencimento da fatura, é necessário fazer um ajuste proporcional no valor da mensalidade para cobrir os dias a mais entre o vencimento atual e o novo vencimento.\n\nNo seu caso, o vencimento atual é ${dateBR(oldDue)}, e será alterado para ${dateBR(newDue)}. Como a mensalidade é de ${brl(m)}, dividimos esse valor por 30 para obter o valor diário:\n\n${brl(m)} ÷ 30 = ${brl(c.daily)} por dia\n\nDepois, calculamos a diferença entre o vencimento antigo e o novo vencimento, o que dá ${c.days} dias.\n\nAgora, multiplicamos o valor diário pela quantidade de dias adicionais:\n\n${brl(c.daily)} × ${c.days} = ${brl(c.raw)}\n\nO proporcional será arredondado para ${brl(c.rounded)}. Também será acrescentada a taxa de geração de boleto de R$ 1,20.\n\nSeu próximo pagamento será no dia ${dateBR(newDue)} e o valor será de ${brl(c.total)} (mensalidade de ${brl(m)} + proporcional de ${brl(c.rounded)} + taxa de R$ 1,20).\n\nApós esse ajuste, você seguirá normalmente pagando a mensalidade de ${brl(m)} todo mês, no novo dia de vencimento.\n\nEsse ajuste é necessário para garantir que o serviço continue ativo e corretamente coberto durante esse intervalo de dias a mais.\n\nSe estiver de acordo, me confirme e o procedimento será realizado.`;
    }
    const c = calc as any;
    return `Gostaríamos de informar que, ao aceitar o upgrade, a vigência contratual será renovada por mais um ano. Dessa forma, o contrato não poderá ser rescindido antes deste prazo, pois estará sujeito a multa rescisória.\n\nComo o seu plano é pré-pago, ao realizar uma mudança de plano, é necessário calcular um valor proporcional referente aos dias restantes do plano anterior até o início do novo plano.\n\nNesse caso, será feita a mudança e o valor proporcional será de ${brl(c.rounded)}, que será cobrado junto com o valor do novo plano no próximo vencimento, no dia ${dateBR(upgradeDue)}.\n\nOu seja, neste pagamento você irá pagar:\n\n${brl(newM)} referente ao novo plano mensal\n${brl(c.rounded)} referente ao proporcional da mudança de plano\n\nTotal da próxima cobrança: ${brl(c.total)}.\n\n*Importante:* essa cobrança proporcional acontece somente uma vez, por conta da troca de plano. A partir do mês seguinte, você pagará apenas o valor fixo da nova mensalidade, sem adicionais.\n\nSe estiver de acordo, forneça uma foto do documento de identidade com foto e assinatura do titular (CNH aberta ou RG frente e verso, juntamente com o CPF) para poder fazer o link de assinatura que estarei te enviando junto com o passo a passo de como assinar. Assim que tiver assinado, eu já vejo um horário disponível na agenda e confirmo com você.`;
  }, [mode, calc, m, due, hasUnlock, unlockCount, unlockRequestDate, reactivation, nextDue, oldDue, newDue, newM, upgradeDue]);

  const save = () => {
    if (!(calc as any).valid) {
      setToast("Preencha os campos obrigatórios e confira as datas.");
      return;
    }
    const c = calc as any;
    const item: Saved = {
      id: String(Date.now()),
      mode,
      title: modes.find((x) => x.id === mode)!.label,
      total: c.total,
      date: today(),
      details:
        mode === "reativacao"
          ? `${c.usedDays} + ${c.futureDays} dias${
              hasUnlock ? ` (${unlockCount}º desbl.)` : ""
            } · proporcional ${brl(c.raw)} → ${brl(c.rounded)}`
          : mode === "vencimento"
            ? `${c.days} dias · proporcional ${brl(c.rounded)} + taxa R$ 1,20`
            : `${c.days} dias · proporcional ${brl(c.rounded)}`,
    };
    setHistory((h) => [item, ...h].slice(0, 60));
    setToast("Cálculo salvo no histórico deste dispositivo.");
  };

  const copy = async () => {
    if (!message) {
      setToast("Preencha os campos obrigatórios para gerar a mensagem.");
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setToast("Mensagem copiada para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast("Não foi possível copiar automaticamente. Selecione o texto e copie.");
    }
  };

  const clearFields = () => {
    if (mode === "reativacao") {
      setMonthly("");
      setDue("");
      setBlocked("");
      setUnlockCount("0");
      setUnlockRequestDate("");
      setCustomHolidays("");
      setReactivation(today()); // a reativação normalmente é hoje: já vem preenchida, sem marcar como exemplo
      setNextDue("");
    } else if (mode === "vencimento") {
      setMonthly("");
      setOldDue("");
      setNewDue("");
    } else {
      setOldPlan("");
      setNewPlan("");
      setEquipmentDate("");
      setUpgradeDue("");
    }
    setToast("Campos limpos. Preencha os dados do cliente.");
  };

  const resetFields = () => {
    setMonthly(DEFAULTS.monthly);
    setDue(DEFAULTS.due);
    setBlocked(DEFAULTS.blocked);
    setUnlockCount(DEFAULTS.unlockCount);
    setUnlockRequestDate(DEFAULTS.unlockRequestDate);
    setCustomHolidays(DEFAULTS.customHolidays);
    setReactivation(today());
    setNextDue(DEFAULTS.nextDue);
    setOldDue(DEFAULTS.oldDue);
    setNewDue(DEFAULTS.newDue);
    setOldPlan(DEFAULTS.oldPlan);
    setNewPlan(DEFAULTS.newPlan);
    setEquipmentDate("");
    setUpgradeDue(DEFAULTS.upgradeDue);
    setToast("Valores de exemplo restaurados.");
  };

  const inputFields = () => {
    if (mode === "reativacao") {
      const unlockOptions: { value: UnlockCount; label: string; sub: string }[] = [
        { value: "0", label: "Sem desbloqueio", sub: "Bloqueio direto" },
        { value: "1", label: "1º desbloqueio", sub: "1 de 3 usados" },
        { value: "2", label: "2º desbloqueio", sub: "2 de 3 usados" },
        { value: "3", label: "3º desbloqueio", sub: "Limite (3 de 3)" },
      ];

      return (
        <>
          <div className="field-grid">
            <Field
              label="Valor da mensalidade"
              prefix="R$"
              value={monthly}
              onChange={setMonthly}
              placeholder="80,00"
              isSample={monthly === DEFAULTS.monthly}
            />
            <Field
              label="Vencimento do boleto considerado"
              value={due}
              onChange={setDue}
              type="date"
              isSample={due === DEFAULTS.due}
            />
          </div>

          <div className="unlock-box">
            <div className="unlock-box-header">
              <div>
                <strong>Desbloqueio em confiança após o bloqueio</strong>
                <p>
                  Cada cliente tem direito a até 3 desbloqueios, válidos até a meia-noite do dia solicitado (sem bloqueio em fins de semana e feriados).
                </p>
              </div>
              <span className="unlock-limit-tag">Máx. 3 desbloqueios</span>
            </div>

            <div className="unlock-pills" role="group" aria-label="Quantidade de desbloqueios utilizados">
              {unlockOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`unlock-pill ${unlockCount === opt.value ? "active" : ""}`}
                  onClick={() => setUnlockCount(opt.value)}
                >
                  <strong>{opt.label}</strong>
                  <small>{opt.sub}</small>
                </button>
              ))}
            </div>

            {hasUnlock && (
              <div className="unlock-fields">
                <div className="field-grid">
                  <Field
                    label={`Data da solicitação (${unlockCount}º desbloqueio)`}
                    value={unlockRequestDate}
                    onChange={setUnlockRequestDate}
                    type="date"
                    hint="A data efetiva do bloqueio considera o dia da solicitação (válido até a meia-noite)."
                  />
                  <Field
                    label="Feriados locais/móveis (opcional)"
                    value={customHolidays}
                    onChange={setCustomHolidays}
                    type="text"
                    required={false}
                    placeholder="Ex.: 20/11 ou 25/12/2026"
                    hint="Feriados nacionais fixos já são considerados. Separe datas extras por vírgula."
                  />
                </div>

                {unlockRequestDate && (
                  <div className="unlock-summary">
                    <span>
                      📅 Data efetiva apurada: <strong>{dateBR(unlockResolution.effectiveDate)}</strong>
                      {unlockResolution.extendedDays > 0 ? (
                        <>
                          {" "}
                          (estendida em <strong>+{unlockResolution.extendedDays} dia(s)</strong> por fim de semana/feriado; bloqueio na virada para{" "}
                          <strong>{dateBR(unlockResolution.nextBusinessDay)}</strong>)
                        </>
                      ) : (
                        <>
                          {" "}
                          (bloqueio na virada da meia-noite para <strong>{dateBR(unlockResolution.nextBusinessDay)}</strong>)
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="field-grid">
            {hasUnlock ? (
              <Field
                label="Data efetiva do bloqueio (calculada)"
                value={effectiveBlockedDate}
                onChange={() => {}}
                type="date"
                readOnly
                warning={dateWarnings.blocked}
                hint="Calculada automaticamente pela data da solicitação + regra de fins de semana/feriados."
              />
            ) : (
              <Field
                label="Data efetiva do bloqueio"
                value={blocked}
                onChange={setBlocked}
                type="date"
                isSample={blocked === DEFAULTS.blocked}
                warning={dateWarnings.blocked}
                hint="Data em que o sistema bloqueou a conexão (considerando feriados/finais de semana)."
              />
            )}
            <Field
              label="Data da reativação"
              value={reactivation}
              onChange={setReactivation}
              type="date"
              warning={dateWarnings.reactivation}
            />
          </div>
          <Field
            label="Próximo vencimento"
            value={nextDue}
            onChange={setNextDue}
            type="date"
            isSample={nextDue === DEFAULTS.nextDue}
          />
          <div className="notice">
            <span className="notice-icon">ℹ</span>
            <div>
              A contagem futura inclui o dia da reativação e o próximo vencimento. O período em atraso conta a partir do dia seguinte ao vencimento até a data efetiva do bloqueio.
            </div>
          </div>
        </>
      );
    }
    if (mode === "vencimento") {
      return (
        <>
          <div className="field-grid">
            <Field
              label="Valor da mensalidade"
              prefix="R$"
              value={monthly}
              onChange={setMonthly}
              placeholder="80,00"
              isSample={monthly === DEFAULTS.monthly}
            />
            <Field
              label="Vencimento atual"
              value={oldDue}
              onChange={setOldDue}
              type="date"
              isSample={oldDue === DEFAULTS.oldDue}
            />
          </div>
          <Field
            label="Novo vencimento"
            value={newDue}
            onChange={setNewDue}
            type="date"
            isSample={newDue === DEFAULTS.newDue}
          />
          <div className="notice">
            <span className="notice-icon">ℹ</span>
            <div>
              A taxa de geração de boleto de <strong>R$ 1,20</strong> é somada após o arredondamento do proporcional calculado entre as duas datas.
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="field-grid">
          <Field
            label="Mensalidade atual"
            prefix="R$"
            value={oldPlan}
            onChange={setOldPlan}
            placeholder="100,00"
            isSample={oldPlan === DEFAULTS.oldPlan}
          />
          <Field
            label="Nova mensalidade"
            prefix="R$"
            value={newPlan}
            onChange={setNewPlan}
            placeholder="160,00"
            isSample={newPlan === DEFAULTS.newPlan}
          />
        </div>
        <div className="field-grid">
          <Field
            label="Data da troca do equipamento (opcional)"
            value={equipmentDate}
            onChange={setEquipmentDate}
            type="date"
            required={false}
            hint="Campo opcional: se ficar em branco, será usada a data de hoje."
          />
          <Field
            label="Próximo vencimento"
            value={upgradeDue}
            onChange={setUpgradeDue}
            type="date"
            isSample={upgradeDue === DEFAULTS.upgradeDue}
          />
        </div>
        <div className="notice">
          <span className="notice-icon">ℹ</span>
          <div>
            O proporcional incide apenas sobre a diferença entre os planos e é cobrado uma única vez junto à próxima mensalidade.
          </div>
        </div>
      </>
    );
  };

  const c = calc as any;
  const activeModeObj = modes.find((x) => x.id === mode)!;

  const renderHowItWorksSteps = () => {
    if (mode === "reativacao") {
      return (
        <div className="how-steps">
          <div className="how-step">
            <span className="how-num">1</span>
            <div>
              <strong>Valor diário da mensalidade (÷ 30)</strong>
              <p>
                Dividimos a mensalidade de <b>{brl(m)}</b> por <b>30 dias</b> (base padrão do cálculo) para encontrar o custo diário do serviço.
              </p>
              <code>
                {brl(m)} ÷ 30 = {brl(c.daily)} por dia
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">2</span>
            <div>
              <strong>Regra dos desbloqueios (até 3) e data efetiva do bloqueio</strong>
              <p>
                Cada cliente tem direito a até <b>3 desbloqueios</b> após o bloqueio, válidos até a meia-noite do dia solicitado. Quando o dia seguinte cai em <b>sábado, domingo ou feriado</b>, o bloqueio não ocorre e o uso se estende até o próximo dia útil.
              </p>
              <code>
                {hasUnlock && unlockRequestDate
                  ? `${unlockCount}º desbloqueio em ${dateBR(unlockRequestDate)} → Data efetiva: ${dateBR(c.effectiveBlockedDate)}`
                  : `Data efetiva considerada: ${dateBR(c.effectiveBlockedDate)}`}
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">2b</span>
            <div>
              <strong>Dias utilizados após o vencimento até o bloqueio</strong>
              <p>
                Calculamos a diferença de dias entre o vencimento considerado (<b>{dateBR(due)}</b>) e a data efetiva do bloqueio (<b>{dateBR(c.effectiveBlockedDate)}</b>) e multiplicamos pelo valor diário.
              </p>
              <code>
                {c.usedDays} dias × {brl(c.daily)} = {brl(c.used)}
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">3</span>
            <div>
              <strong>Dias da reativação até o próximo vencimento (inclusivo)</strong>
              <p>
                Contamos da data da reativação (<b>{dateBR(reactivation)}</b>) até o próximo vencimento (<b>{dateBR(nextDue)}</b>) incluindo ambos os dias (<code>+ 1</code>) e multiplicamos pelo valor diário.
              </p>
              <code>
                {c.futureDays} dias × {brl(c.daily)} = {brl(c.future)}
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">4</span>
            <div>
              <strong>Soma e arredondamento para múltiplo de R$ 5,00</strong>
              <p>
                Somamos os dois períodos (<b>{brl(c.used)} + {brl(c.future)} = {brl(c.raw)}</b>) e arredondamos o resultado para o <b>múltiplo de R$ 5,00 mais próximo</b>.
              </p>
              <code>
                Subtotal {brl(c.raw)} → Arredondado: {brl(c.rounded)} (Total: {brl(c.total)})
              </code>
            </div>
          </div>
        </div>
      );
    }

    if (mode === "vencimento") {
      return (
        <div className="how-steps">
          <div className="how-step">
            <span className="how-num">1</span>
            <div>
              <strong>Valor diário da mensalidade (÷ 30)</strong>
              <p>
                Dividimos a mensalidade de <b>{brl(m)}</b> por <b>30 dias</b> para obter o valor proporcional de cada dia adicional.
              </p>
              <code>
                {brl(m)} ÷ 30 = {brl(c.daily)} por dia
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">2</span>
            <div>
              <strong>Intervalo entre o vencimento atual e o novo vencimento</strong>
              <p>
                Calculamos quantos dias existem entre o vencimento atual (<b>{dateBR(oldDue)}</b>) e o novo vencimento (<b>{dateBR(newDue)}</b>) e multiplicamos pelo valor diário.
              </p>
              <code>
                {c.days} dias × {brl(c.daily)} = {brl(c.raw)} (bruto)
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">3</span>
            <div>
              <strong>Arredondamento do proporcional (múltiplo de R$ 5,00)</strong>
              <p>
                O valor proporcional bruto de <b>{brl(c.raw)}</b> é arredondado para o múltiplo de <b>R$ 5,00</b> mais próximo.
              </p>
              <code>
                {brl(c.raw)} → Proporcional arredondado: {brl(c.rounded)}
              </code>
            </div>
          </div>

          <div className="how-step">
            <span className="how-num">4</span>
            <div>
              <strong>Soma com a mensalidade e taxa de boleto (R$ 1,20)</strong>
              <p>
                Ao valor final do próximo pagamento somamos a mensalidade base (<b>{brl(m)}</b>), o proporcional arredondado (<b>{brl(c.rounded)}</b>) e a taxa fixa de geração de boleto de <b>R$ 1,20</b>.
              </p>
              <code>
                {brl(m)} + {brl(c.rounded)} + R$ 1,20 = {brl(c.total)}
              </code>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="how-steps">
        <div className="how-step">
          <span className="how-num">1</span>
          <div>
            <strong>Diferença mensal entre os planos</strong>
            <p>
              Subtraímos a mensalidade atual (<b>{brl(oldM)}</b>) da nova mensalidade (<b>{brl(newM)}</b>). O proporcional incide apenas sobre essa diferença.
            </p>
            <code>
              {brl(newM)} − {brl(oldM)} = {brl(c.difference)} de diferença
            </code>
          </div>
        </div>

        <div className="how-step">
          <span className="how-num">2</span>
          <div>
            <strong>Valor diário da diferença (÷ 30)</strong>
            <p>
              Dividimos a diferença mensal de <b>{brl(c.difference)}</b> por <b>30 dias</b> para achar o valor proporcional por dia.
            </p>
            <code>
              {brl(c.difference)} ÷ 30 = {brl(c.daily)} por dia
            </code>
          </div>
        </div>

        <div className="how-step">
          <span className="how-num">3</span>
          <div>
            <strong>Dias até o próximo vencimento e arredondamento</strong>
            <p>
              Contamos os dias entre a data inicial considerada (<b>{dateBR(c.start)}</b>{!equipmentDate ? " — hoje, pois o campo opcional está vazio" : ""}) e o próximo vencimento (<b>{dateBR(upgradeDue)}</b>), multiplicamos pelo valor diário e arredondamos para o múltiplo de <b>R$ 5,00</b> mais próximo.
            </p>
            <code>
              {c.days} dias × {brl(c.daily)} = {brl(c.raw)} → Arredondado: {brl(c.rounded)}
            </code>
          </div>
        </div>

        <div className="how-step">
          <span className="how-num">4</span>
          <div>
            <strong>Total da próxima cobrança</strong>
            <p>
              Na próxima fatura, o cliente paga a nova mensalidade (<b>{brl(newM)}</b>) mais o proporcional único da mudança de plano (<b>{brl(c.rounded)}</b>).
            </p>
            <code>
              {brl(newM)} + {brl(c.rounded)} = {brl(c.total)}
            </code>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-glow" />
        <div className="brand">
          <div className="brand-logo-frame">
            <img className="brand-logo" src="/vitalnet-logo.png" alt="Vital Net Telecom" />
          </div>
          <div className="brand-text">
            <span className="brand-pill">PORTAL SAC</span>
            <small>Proporcionais</small>
          </div>
        </div>

        <div className="side-label">MÓDULOS DE CÁLCULO</div>
        <nav aria-label="Calculadoras disponíveis">
          {modes.map((item) => (
            <button
              key={item.id}
              className={mode === item.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setMode(item.id);
                setCopied(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-meta">
                <strong>{item.label}</strong>
                <small>{item.short}</small>
              </span>
              {mode === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`history-link ${showHistory ? "is-open" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={showHistory}
            onClick={() => setShowHistory(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Histórico de cálculos</span>
            {history.length > 0 && <em className="history-badge">{history.length}</em>}
          </button>

          <div className="side-foot">
            <strong>Vital Net Telecom</strong>
            <span>Uso interno · Criado por Giliel</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="eyebrow">CENTRAL DE ATENDIMENTO · VITAL NET TELECOM</div>
            <h1>Calculadora de Proporcionais</h1>
            <p>Simule valores com precisão, confira a memória de cálculo e copie a resposta pronta para o cliente.</p>
          </div>
          <div className="top-status">
            <button
              type="button"
              className="how-btn"
              onClick={() => setShowHowItWorks(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Como funciona o cálculo</span>
            </button>
            <div className="status-pill">
              <span className="status-dot" />
              <span>Cálculo instantâneo</span>
            </div>
            <div className="avatar" title="Setor de Atendimento ao Cliente">SAC</div>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <span className="section-kicker">MÓDULO ATIVO</span>
              <h2>{activeModeObj.label}</h2>
              <p>{activeModeObj.short}.</p>
            </div>
            <div className="welcome-actions">
              <button
                type="button"
                className="how-btn how-btn-compact"
                onClick={() => setShowHowItWorks(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Como funciona o cálculo</span>
              </button>
              <button type="button" className="how-btn how-btn-compact" onClick={() => setShowHistory(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Histórico{history.length > 0 ? ` (${history.length})` : ""}</span>
              </button>
              <span className="mode-chip">
                <span className="chip-icon">{activeModeObj.icon}</span>
                {activeModeObj.badge}
              </span>
            </div>
          </div>

          <div className="workspace">
            <section className="panel input-panel">
              <div className="panel-heading">
                <div className="heading-left">
                  <span className="step">01</span>
                  <div>
                    <h3>Parâmetros da simulação</h3>
                    <p>O cálculo e a mensagem são atualizados em tempo real enquanto você preenche.</p>
                  </div>
                </div>
                <span className="required-note">Campos obrigatórios</span>
              </div>

              <div className="form-body">
                {hasSampleValues && (
                  <div className="sample-banner">
                    <span className="sample-banner-dot" />
                    <span>
                      Há campos preenchidos com <strong>valores de exemplo</strong>. Altere-os ou clique em{" "}
                      <button type="button" className="sample-inline-link" onClick={clearFields}>
                        Limpar campos
                      </button>{" "}
                      para iniciar um novo atendimento.
                    </span>
                  </div>
                )}
                {inputFields()}
              </div>

              <div className="form-actions">
                <div className="realtime-hint">
                  <span className="realtime-dot" />
                  <span>Cálculo em tempo real ao digitar</span>
                </div>
                <div className="secondary-actions">
                  <button type="button" className="text-btn clear-btn" onClick={clearFields}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    <span>Limpar campos</span>
                  </button>
                  <button type="button" className="text-btn restore-btn" onClick={resetFields}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    <span>Restaurar exemplo</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="panel result-panel">
              <div className="panel-heading">
                <div className="heading-left">
                  <span className="step step-cyan">02</span>
                  <div>
                    <h3>Memória de cálculo</h3>
                    <p>Detalhamento diário, arredondamento e total.</p>
                  </div>
                </div>
                <span className="live-tag">
                  <span /> TEMPO REAL
                </span>
              </div>

              <div className="result-body">
                {mode === "reativacao" ? (
                  <>
                    <div className="metric-grid">
                      <div className="metric">
                        <small>Valor diário (÷ 30)</small>
                        <strong>{brl(c.daily)}</strong>
                      </div>
                      <div className="metric">
                        <small>Total de dias</small>
                        <strong>
                          {c.usedDays + c.futureDays} <em>dias</em>
                        </strong>
                      </div>
                    </div>
                    {hasUnlock && (
                      <ResultLine
                        label={`Desbloqueio utilizado (${unlockCount} de 3)`}
                        value={
                          unlockRequestDate
                            ? `Solicitado em ${dateBR(unlockRequestDate)}${
                                c.extendedDays > 0 ? ` (+${c.extendedDays}d fim sem./feriado)` : ""
                              }`
                            : "Informe a data"
                        }
                        highlight
                      />
                    )}
                    <ResultLine label="Data efetiva do bloqueio" value={dateBR(c.effectiveBlockedDate)} />
                    <ResultLine label={`${c.usedDays} dias usados após o vencimento`} value={brl(c.used)} />
                    <ResultLine label={`${c.futureDays} dias até o próximo vencimento`} value={brl(c.future)} />
                    <ResultLine label="Subtotal antes do arredondamento" value={brl(c.raw)} muted />
                    <div className="rounding-note">
                      <span>✦</span> Arredondado para o múltiplo de <strong>R$ 5,00</strong> mais próximo
                    </div>
                  </>
                ) : mode === "vencimento" ? (
                  <>
                    <div className="metric-grid">
                      <div className="metric">
                        <small>Valor diário (÷ 30)</small>
                        <strong>{brl(c.daily)}</strong>
                      </div>
                      <div className="metric">
                        <small>Dias adicionais</small>
                        <strong>
                          {c.days} <em>dias</em>
                        </strong>
                      </div>
                    </div>
                    <ResultLine label="Proporcional bruto" value={brl(c.raw)} />
                    <ResultLine label="Proporcional arredondado" value={brl(c.rounded)} highlight />
                    <ResultLine label="Taxa de geração de boleto" value={brl(1.2)} />
                    <ResultLine label="Mensalidade base" value={brl(m)} muted />
                    <div className="rounding-note">
                      <span>✦</span> Proporcional arredondado ao múltiplo de <strong>R$ 5,00</strong> + taxa fixa
                    </div>
                  </>
                ) : (
                  <>
                    <div className="metric-grid">
                      <div className="metric">
                        <small>Diferença mensal</small>
                        <strong>{brl(c.difference)}</strong>
                      </div>
                      <div className="metric">
                        <small>Dias restantes</small>
                        <strong>
                          {c.days} <em>dias</em>
                        </strong>
                      </div>
                    </div>
                    <ResultLine label="Valor diário da diferença" value={brl(c.daily)} />
                    <ResultLine label="Proporcional bruto" value={brl(c.raw)} />
                    <ResultLine label="Proporcional arredondado" value={brl(c.rounded)} highlight />
                    <ResultLine label="Nova mensalidade fixa" value={brl(newM)} muted />
                    <div className="rounding-note">
                      <span>✦</span> Arredondado para o múltiplo de <strong>R$ 5,00</strong> mais próximo
                    </div>
                  </>
                )}

                <div className="total-card">
                  <div className="total-card-bg" />
                  <div className="total-info">
                    <small>
                      {mode === "reativacao"
                        ? "VALOR PROPORCIONAL A PAGAR"
                        : mode === "vencimento"
                          ? "PRÓXIMO PAGAMENTO (COM TAXA)"
                          : "PRÓXIMA MENSALIDADE + PROPORCIONAL"}
                    </small>
                    <strong>{brl(c.total)}</strong>
                    <span>
                      {mode === "reativacao"
                        ? "Valor final após arredondamento"
                        : mode === "vencimento"
                          ? "Mensalidade + proporcional + R$ 1,20"
                          : "Nova mensalidade + proporcional único"}
                    </span>
                  </div>
                  <div className="total-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>

                {c.valid && hasDateWarnings && (
                  <div className="validation">
                    <strong>Confira as datas.</strong> {Object.values(dateWarnings).join(" ")} Se estiver correto, siga normalmente; se não, ajuste os campos destacados em amarelo.
                  </div>
                )}

                {!c.valid && (
                  <div className="validation">
                    Existem campos obrigatórios vazios ou datas fora de ordem. Revise os campos destacados em vermelho.
                  </div>
                )}

                <button className="save-btn" onClick={save} disabled={!c.valid}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Salvar simulação no histórico
                </button>
              </div>
            </section>
          </div>

          <section className="panel message-panel">
            <div className="panel-heading">
              <div className="heading-left">
                <span className="step step-blue">03</span>
                <div>
                  <h3>Mensagem para envio ao cliente</h3>
                  <p>Script gerado automaticamente pronto para colar no atendimento.</p>
                </div>
              </div>
              <button className={`copy-btn ${copied ? "is-copied" : ""}`} onClick={copy} disabled={!message}>
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Mensagem copiada!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copiar mensagem
                  </>
                )}
              </button>
            </div>
            <textarea
              className="message-box"
              value={message}
              readOnly
              placeholder="A mensagem aparece aqui assim que todos os campos obrigatórios estiverem preenchidos e as datas estiverem em ordem."
            />
            <div className="message-footer">
              <span>Texto pronto para envio ao cliente — revise os valores e datas antes de encaminhar.</span>
              <span className="wa-badge">● Formatação otimizada para WhatsApp</span>
            </div>
          </section>

          <footer className="footer">
            <div>
              <strong>VITAL NET TELECOM</strong> <span>•</span> Ferramenta interna de apoio <span>•</span> Confira os critérios vigentes antes de efetivar cobranças.
            </div>
            <p className="confidential-note">
              <strong>Aviso sobre o sistema:</strong> Este sistema é de uso exclusivamente interno. Seu conteúdo, telas e regras não devem ser divulgados, compartilhados ou encaminhados a pessoas externas à empresa (a mensagem gerada no Passo 03 destina-se ao envio ao cliente).
            </p>
          </footer>
        </div>
      </main>

      {showHistory && (
        <>
          <div className="drawer-overlay" onClick={() => setShowHistory(false)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="history-title">
            <div className="drawer-head">
              <div>
                <h3 id="history-title">Histórico de simulações</h3>
                <p>Armazenado exclusivamente neste navegador.</p>
              </div>
              <button
                ref={drawerCloseRef}
                type="button"
                className="drawer-close"
                aria-label="Fechar histórico"
                onClick={() => setShowHistory(false)}
              >
                ×
              </button>
            </div>

            <div className="drawer-body">
              {history.length === 0 ? (
                <p className="empty">Nenhuma simulação salva neste dispositivo ainda. Use “Salvar simulação no histórico” para guardar um resultado.</p>
              ) : (
                <div className="history-list">
                  {history.map((h) => (
                    <div className="history-row" key={h.id}>
                      <div>
                        <strong>{h.title}</strong>
                        <small>
                          {dateBR(h.date)} · {h.details}
                        </small>
                      </div>
                      <b>{brl(h.total)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="drawer-foot">
                <span>
                  {history.length} {history.length === 1 ? "simulação salva" : "simulações salvas"}
                </span>
                <button
                  type="button"
                  className="text-btn danger-btn"
                  onClick={() => {
                    if (confirm("Deseja apagar todo o histórico salvo neste navegador?")) setHistory([]);
                  }}
                >
                  Limpar tudo
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {showHowItWorks && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-modal-title"
          onClick={() => setShowHowItWorks(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-kicker">DETALHAMENTO · {activeModeObj.badge}</span>
                <h3 id="how-modal-title">Como funciona o cálculo — {activeModeObj.label}</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Fechar janela"
                onClick={() => setShowHowItWorks(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">{renderHowItWorksSteps()}</div>

            <div className="modal-footer">
              <span>Valores baseados na simulação atual</span>
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setShowHowItWorks(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" onClick={() => setToast("")}>
          <span className="toast-dot" />
          <span>{toast}</span>
          <button aria-label="Fechar aviso">×</button>
        </div>
      )}
    </div>
  );
}
