import { useEffect, useMemo, useState } from "react";

type Mode = "reativacao" | "vencimento" | "upgrade";
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
const dayDiff = (a: string, b: string) => Math.round((dateFrom(b).getTime() - dateFrom(a).getTime()) / 86400000);
const dateBR = (s: string) => (s ? dateFrom(s).toLocaleDateString("pt-BR") : "—");
const moneyNumber = (s: string) => Number(s.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
const round5 = (n: number) => Math.round(n / 5) * 5;
const safe = (n: number) => Number(n.toFixed(2));

const DEFAULTS = {
  monthly: "80,00",
  due: "2026-10-29",
  blocked: "2026-11-06",
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
}) {
  const isEmpty = required && value.trim() === "";
  return (
    <label className={`field ${isEmpty ? "is-empty" : ""} ${!isEmpty && isSample ? "is-sample" : ""}`}>
      <div className="field-label-row">
        <span>{label}</span>
        {isEmpty ? (
          <span className="empty-badge">Campo vazio</span>
        ) : (
          isSample && <span className="sample-badge">Exemplo</span>
        )}
      </div>
      <div className={`input-wrap ${prefix ? "has-prefix" : ""} ${isEmpty ? "invalid" : ""}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={isEmpty}
        />
      </div>
      {isEmpty ? (
        <small className="error-text">Preencha este campo para calcular corretamente.</small>
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
  const [defaultReactivation] = useState(() => today());
  const [mode, setMode] = useState<Mode>("reativacao");
  const [monthly, setMonthly] = useState(DEFAULTS.monthly);
  const [due, setDue] = useState(DEFAULTS.due);
  const [blocked, setBlocked] = useState(DEFAULTS.blocked);
  const [reactivation, setReactivation] = useState(defaultReactivation);
  const [nextDue, setNextDue] = useState(DEFAULTS.nextDue);
  const [oldDue, setOldDue] = useState(DEFAULTS.oldDue);
  const [newDue, setNewDue] = useState(DEFAULTS.newDue);
  const [oldPlan, setOldPlan] = useState(DEFAULTS.oldPlan);
  const [newPlan, setNewPlan] = useState(DEFAULTS.newPlan);
  const [equipmentDate, setEquipmentDate] = useState("");
  const [upgradeDue, setUpgradeDue] = useState(DEFAULTS.upgradeDue);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Saved[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("vitalnet-proportional-history") || "[]"));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("vitalnet-proportional-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (!showHowItWorks) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHowItWorks(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHowItWorks]);

  const m = moneyNumber(monthly),
    oldM = moneyNumber(oldPlan),
    newM = moneyNumber(newPlan);

  const hasSampleValues = useMemo(() => {
    if (mode === "reativacao") {
      return (
        monthly === DEFAULTS.monthly ||
        due === DEFAULTS.due ||
        blocked === DEFAULTS.blocked ||
        reactivation === defaultReactivation ||
        nextDue === DEFAULTS.nextDue
      );
    }
    if (mode === "vencimento") {
      return monthly === DEFAULTS.monthly || oldDue === DEFAULTS.oldDue || newDue === DEFAULTS.newDue;
    }
    return oldPlan === DEFAULTS.oldPlan || newPlan === DEFAULTS.newPlan || upgradeDue === DEFAULTS.upgradeDue;
  }, [mode, monthly, due, blocked, reactivation, defaultReactivation, nextDue, oldDue, newDue, oldPlan, newPlan, upgradeDue]);

  const calc = useMemo(() => {
    if (mode === "reativacao") {
      const daily = safe(m / 30);
      const usedDays = due && blocked ? Math.max(0, dayDiff(due, blocked)) : 0;
      const futureDays = reactivation && nextDue ? Math.max(0, dayDiff(reactivation, nextDue) + 1) : 0;
      const used = safe(daily * usedDays),
        future = safe(daily * futureDays),
        raw = safe(used + future),
        rounded = round5(raw);
      return {
        daily,
        usedDays,
        futureDays,
        used,
        future,
        raw,
        rounded,
        total: rounded,
        valid: m > 0 && usedDays >= 0 && futureDays >= 0 && !!due && !!blocked && !!reactivation && !!nextDue,
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
  }, [mode, m, due, blocked, reactivation, nextDue, oldDue, newDue, oldM, newM, equipmentDate, upgradeDue]);

  const message = useMemo(() => {
    if (mode === "reativacao") {
      const c = calc as any;
      return `Verifiquei que sua mensalidade é no valor de ${brl(m)}.\n\nPara regularizar e reativar a conexão, precisamos considerar os dias em que o serviço foi utilizado após o vencimento do primeiro boleto.\n\nA sua conexão continuou funcionando até o dia ${dateBR(blocked)}, ou seja, foram ${c.usedDays} dias de uso após o vencimento de ${dateBR(due)}.\nTambém estamos considerando a ativação da conexão de ${dateBR(reactivation)} até o próximo vencimento, que será em ${dateBR(nextDue)}, totalizando ${c.futureDays} dias de uso.\n\nFizemos o cálculo proporcional da seguinte forma:\n\n📌 ${brl(m)} / 30 dias = ${brl(c.daily)} por dia de uso\n\n${c.usedDays} dias usados após o vencimento de ${dateBR(due)}\n→ ${c.usedDays} x ${brl(c.daily)} = ${brl(c.used)}\n\n${c.futureDays} dias de hoje até o próximo vencimento (${dateBR(nextDue)})\n→ ${c.futureDays} x ${brl(c.daily)} = ${brl(c.future)}\n\n✅ Valor total calculado: ${brl(c.used)} + ${brl(c.future)} = ${brl(c.raw)}\n\nPorém, iremos arredondar o valor para ${brl(c.rounded)}.\n\nEsse valor cobre o período em que o serviço foi utilizado e o período que será utilizado até o próximo vencimento.`;
    }
    if (mode === "vencimento") {
      const c = calc as any;
      return `Quando um cliente solicita a mudança da data de vencimento da fatura, é necessário fazer um ajuste proporcional no valor da mensalidade para cobrir os dias a mais entre o vencimento atual e o novo vencimento.\n\nNo seu caso, o vencimento atual é ${dateBR(oldDue)}, e será alterado para ${dateBR(newDue)}. Como a mensalidade é de ${brl(m)}, dividimos esse valor por 30 para obter o valor diário:\n\n${brl(m)} ÷ 30 = ${brl(c.daily)} por dia\n\nDepois, calculamos a diferença entre o vencimento antigo e o novo vencimento, o que dá ${c.days} dias.\n\nAgora, multiplicamos o valor diário pela quantidade de dias adicionais:\n\n${brl(c.daily)} × ${c.days} = ${brl(c.raw)}\n\nO proporcional será arredondado para ${brl(c.rounded)}. Também será acrescentada a taxa de geração de boleto de R$ 1,20.\n\nSeu próximo pagamento será no dia ${dateBR(newDue)} e o valor será de ${brl(c.total)} (mensalidade de ${brl(m)} + proporcional de ${brl(c.rounded)} + taxa de R$ 1,20).\n\nApós esse ajuste, você seguirá normalmente pagando a mensalidade de ${brl(m)} todo mês, no novo dia de vencimento.\n\nEsse ajuste é necessário para garantir que o serviço continue ativo e corretamente coberto durante esse intervalo de dias a mais.\n\nSe estiver de acordo, me confirme e o procedimento será realizado.`;
    }
    const c = calc as any;
    return `Gostaríamos de informar que, ao aceitar o upgrade, a vigência contratual será renovada por mais um ano. Dessa forma, o contrato não poderá ser rescindido antes deste prazo, pois estará sujeito a multa rescisória.\n\nComo o seu plano é pré-pago, ao realizar uma mudança de plano, é necessário calcular um valor proporcional referente aos dias restantes do plano anterior até o início do novo plano.\n\nNesse caso, será feita a mudança e o valor proporcional será de ${brl(c.rounded)}, que será cobrado junto com o valor do novo plano no próximo vencimento, no dia ${dateBR(upgradeDue)}.\n\nOu seja, neste pagamento você irá pagar:\n\n${brl(newM)} referente ao novo plano mensal\n${brl(c.rounded)} referente ao proporcional da mudança de plano\n\nTotal da próxima cobrança: ${brl(c.total)}.\n\n*Importante:* essa cobrança proporcional acontece somente uma vez, por conta da troca de plano. A partir do mês seguinte, você pagará apenas o valor fixo da nova mensalidade, sem adicionais.\n\nSe estiver de acordo, forneça uma foto do documento de identidade com foto e assinatura do titular (CNH aberta ou RG frente e verso, juntamente com o CPF) para poder fazer o link de assinatura que estarei te enviando junto com o passo a passo de como assinar. Assim que tiver assinado, eu já vejo um horário disponível na agenda e confirmo com você.`;
  }, [mode, calc, m, due, blocked, reactivation, nextDue, oldDue, newDue, newM, upgradeDue]);

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
          ? `${c.usedDays} + ${c.futureDays} dias · proporcional ${brl(c.raw)} → ${brl(c.rounded)}`
          : mode === "vencimento"
            ? `${c.days} dias · proporcional ${brl(c.rounded)} + taxa R$ 1,20`
            : `${c.days} dias · proporcional ${brl(c.rounded)}`,
    };
    setHistory((h) => [item, ...h].slice(0, 60));
    setToast("Cálculo salvo no histórico deste dispositivo.");
  };

  const copy = async () => {
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
      setReactivation("");
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
    setReactivation(defaultReactivation);
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
          <div className="field-grid">
            <Field
              label="Data efetiva do bloqueio"
              value={blocked}
              onChange={setBlocked}
              type="date"
              isSample={blocked === DEFAULTS.blocked}
              hint="Data em que o sistema bloqueou a conexão (considerando feriados/finais de semana)."
            />
            <Field
              label="Data da reativação"
              value={reactivation}
              onChange={setReactivation}
              type="date"
              isSample={reactivation === defaultReactivation}
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
              A contagem futura inclui o dia da reativação e o próximo vencimento. O período em atraso conta a partir do dia seguinte ao vencimento até o bloqueio.
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
              <strong>Dias utilizados após o vencimento até o bloqueio</strong>
              <p>
                Calculamos a diferença de dias entre o vencimento considerado (<b>{dateBR(due)}</b>) e a data efetiva do bloqueio (<b>{dateBR(blocked)}</b>) e multiplicamos pelo valor diário.
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
            onClick={() => setShowHistory((v) => !v)}
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
                    <p>Preencha os valores e datas do atendimento.</p>
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
                <button
                  className="primary-btn"
                  onClick={() => {
                    if (!c.valid) {
                      setToast("Preencha os campos obrigatórios e confira as datas.");
                      return;
                    }
                    setToast("Cálculo atualizado com sucesso.");
                  }}
                >
                  <span>Atualizar cálculo</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
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
              <button className={`copy-btn ${copied ? "is-copied" : ""}`} onClick={copy}>
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
            <textarea className="message-box" value={message} readOnly />
            <div className="message-footer">
              <span>Revise os valores e datas antes de encaminhar ao assinante.</span>
              <span className="wa-badge">● Formatação otimizada para WhatsApp</span>
            </div>
          </section>

          {showHistory && (
            <section className="panel history-panel">
              <div className="panel-heading">
                <div className="heading-left">
                  <span className="step">↺</span>
                  <div>
                    <h3>Histórico local de simulações</h3>
                    <p>Armazenado exclusivamente neste navegador.</p>
                  </div>
                </div>
                {history.length > 0 && (
                  <button
                    className="text-btn danger-btn"
                    onClick={() => {
                      if (confirm("Deseja apagar todo o histórico salvo neste navegador?")) setHistory([]);
                    }}
                  >
                    Limpar tudo
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="empty">Nenhuma simulação salva neste dispositivo ainda.</p>
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
            </section>
          )}

          <footer className="footer">
            <strong>VITAL NET TELECOM</strong> <span>•</span> Ferramenta interna de apoio ao SAC <span>•</span> Confira os critérios vigentes antes de efetivar cobranças.
          </footer>
        </div>
      </main>

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
