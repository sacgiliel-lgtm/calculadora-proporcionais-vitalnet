import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "reativacao" | "vencimento" | "upgrade";
type MessageChannel = "whatsapp" | "protocolo" | "formal";
type Saved = { id: string; mode: Mode; title: string; total: number; date: string; details: string };

const channels: { id: MessageChannel; label: string; badge: string; hint: string }[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    badge: "Formatação otimizada para WhatsApp",
    hint: "Texto direto e claro com passo a passo para envio ao cliente.",
  },
  {
    id: "protocolo",
    label: "Protocolo / ERP",
    badge: "Registro resumido para Voalle / protocolo",
    hint: "Linha objetiva pronta para colar no relato do atendimento.",
  },
  {
    id: "formal",
    label: "Formal / E-mail",
    badge: "Comunicação formal detalhada",
    hint: "Explicação estruturada para e-mail ou detalhamento formal.",
  },
];

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
  warning,
  tooltip,
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
  tooltip?: string;
}) {
  const isEmpty = required && value.trim() === "";
  const hasWarning = !isEmpty && !!warning;
  return (
    <label
      className={`field ${isEmpty ? "is-empty" : ""} ${hasWarning ? "has-warning" : ""} ${!isEmpty && !hasWarning && isSample ? "is-sample" : ""}`}
    >
      <div className="field-label-row">
        <span className="field-label-text">
          <span>{label}</span>
          {tooltip && (
            <span
              className="field-tooltip-trigger"
              tabIndex={0}
              role="img"
              aria-label={tooltip}
            >
              ?
              <span className="field-tooltip-bubble" role="tooltip">
                {tooltip}
              </span>
            </span>
          )}
        </span>
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
  const [reactivation, setReactivation] = useState(() => today());
  const [nextDue, setNextDue] = useState(DEFAULTS.nextDue);
  const [extraDays, setExtraDays] = useState(0);
  const [oldDue, setOldDue] = useState(DEFAULTS.oldDue);
  const [newDue, setNewDue] = useState(DEFAULTS.newDue);
  const [oldPlan, setOldPlan] = useState(DEFAULTS.oldPlan);
  const [newPlan, setNewPlan] = useState(DEFAULTS.newPlan);
  const [equipmentDate, setEquipmentDate] = useState("");
  const [upgradeDue, setUpgradeDue] = useState(DEFAULTS.upgradeDue);
  const [sampleFlags, setSampleFlags] = useState({
    monthly: true,
    due: true,
    blocked: true,
    nextDue: true,
    oldDue: true,
    newDue: true,
    oldPlan: true,
    newPlan: true,
    upgradeDue: true,
  });
  const [channel, setChannel] = useState<MessageChannel>(() => {
    try {
      const saved = localStorage.getItem("vitalnet-proportional-channel");
      if (saved === "whatsapp" || saved === "protocolo" || saved === "formal") return saved;
    } catch {
      /* ignora falha de storage */
    }
    return "whatsapp";
  });
  const [copied, setCopied] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
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
    const url = (import.meta as { env?: { VITE_ACCESS_WEBHOOK_URL?: string } }).env?.VITE_ACCESS_WEBHOOK_URL || "COLE_SUA_URL_DE_WEBHOOK_AQUI";
    if (!url.startsWith("http")) return;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `👀 Novo acesso à calculadora · ${new Date().toLocaleString("pt-BR")}` }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("vitalnet-proportional-history", JSON.stringify(history));
    } catch {
      /* armazenamento indisponível (ex.: aba privada): segue sem persistir */
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem("vitalnet-proportional-channel", channel);
    } catch {
      /* armazenamento indisponível: segue sem persistir */
    }
  }, [channel]);

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

  const markEdited = (key: keyof typeof sampleFlags) => {
    setSampleFlags((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const hasSampleValues = useMemo(() => {
    if (mode === "reativacao") {
      return Boolean(sampleFlags.monthly || sampleFlags.due || sampleFlags.blocked || sampleFlags.nextDue);
    }
    if (mode === "vencimento") {
      return Boolean(sampleFlags.monthly || sampleFlags.oldDue || sampleFlags.newDue);
    }
    return Boolean(sampleFlags.oldPlan || sampleFlags.newPlan || sampleFlags.upgradeDue);
  }, [mode, sampleFlags]);

  // Avisos (não bloqueiam o cálculo): datas que contradizem o fluxo normal da reativação
  const dateWarnings = useMemo(() => {
    const w: { blocked?: string; reactivation?: string } = {};
    if (mode !== "reativacao") return w;
    if (due && blocked && dayDiff(due, blocked) < 0)
      w.blocked = "O bloqueio está antes do vencimento: nenhum dia de uso após o vencimento será contado.";
    if (reactivation && nextDue && dayDiff(reactivation, nextDue) < 0)
      w.reactivation = "A reativação está depois do próximo vencimento: nenhum dia futuro será contado.";
    return w;
  }, [mode, due, blocked, reactivation, nextDue]);
  const hasDateWarnings = Object.keys(dateWarnings).length > 0;

  const calc = useMemo(() => {
    if (mode === "reativacao") {
      const daily = safe(m / 30);
      const baseUsedDays = due && blocked ? Math.max(0, dayDiff(due, blocked)) : 0;
      const safeExtraDays = Math.max(0, Math.floor(Number(extraDays) || 0));
      const usedDays = baseUsedDays + safeExtraDays;
      const futureDays = reactivation && nextDue ? Math.max(0, dayDiff(reactivation, nextDue) + 1) : 0;
      const used = safe(daily * usedDays),
        future = safe(daily * futureDays),
        raw = safe(used + future),
        rounded = round5(raw);
      return {
        daily,
        baseUsedDays,
        extraDays: safeExtraDays,
        usedDays,
        futureDays,
        used,
        future,
        raw,
        rounded,
        total: rounded,
        valid: m > 0 && baseUsedDays >= 0 && safeExtraDays >= 0 && futureDays >= 0 && !!due && !!blocked && !!reactivation && !!nextDue,
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
  }, [mode, m, due, blocked, reactivation, nextDue, extraDays, oldDue, newDue, oldM, newM, equipmentDate, upgradeDue]);

  const messagesByChannel = useMemo<Record<MessageChannel, string>>(() => {
    // Sem dados válidos não existe mensagem: evita copiar um texto com "R$ 0,00" e datas "—"
    if (!(calc as any).valid) return { whatsapp: "", protocolo: "", formal: "" };
    if (mode === "reativacao") {
      const c = calc as any;
      const extraNote =
        c.extraDays > 0
          ? ` (sendo ${c.baseUsedDays} ${c.baseUsedDays === 1 ? "dia" : "dias"} do período até o bloqueio + ${c.extraDays} ${c.extraDays === 1 ? "dia adicional" : "dias adicionais"} de ajuste/desbloqueios)`
          : "";
      const extraShort = c.extraDays > 0 ? ` (${c.baseUsedDays}+${c.extraDays})` : "";
      return {
        whatsapp: `Verifiquei que sua mensalidade é no valor de ${brl(m)}.\n\nPara regularizar e reativar a conexão, precisamos considerar os dias em que o serviço foi utilizado após o vencimento do primeiro boleto.\n\nA sua conexão continuou funcionando até o dia ${dateBR(blocked)}, ou seja, foram ${c.usedDays} dias de uso após o vencimento de ${dateBR(due)}${extraNote}.\nTambém estamos considerando a ativação da conexão de ${dateBR(reactivation)} até o próximo vencimento, que será em ${dateBR(nextDue)}, totalizando ${c.futureDays} dias de uso.\n\nFizemos o cálculo proporcional da seguinte forma:\n\n📌 ${brl(m)} / 30 dias = ${brl(c.daily)} por dia de uso\n\n${c.usedDays} dias usados após o vencimento de ${dateBR(due)}${extraNote}\n→ ${c.usedDays} x ${brl(c.daily)} = ${brl(c.used)}\n\n${c.futureDays} dias de hoje até o próximo vencimento (${dateBR(nextDue)})\n→ ${c.futureDays} x ${brl(c.daily)} = ${brl(c.future)}\n\n✅ Valor total calculado: ${brl(c.used)} + ${brl(c.future)} = ${brl(c.raw)}\n\nPorém, iremos arredondar o valor para ${brl(c.rounded)}.\n\nEsse valor cobre o período em que o serviço foi utilizado e o período que será utilizado até o próximo vencimento.`,
        protocolo: `[CÁLCULO REATIVAÇÃO] Mensalidade: ${brl(m)} (${brl(c.daily)}/dia) | Venc. considerado: ${dateBR(due)} | Bloqueio: ${dateBR(blocked)} | Reativação: ${dateBR(reactivation)} | Próx. venc.: ${dateBR(nextDue)} | Dias: ${c.usedDays}${extraShort} usados + ${c.futureDays} futuros = ${c.usedDays + c.futureDays}d | Bruto: ${brl(c.raw)} → Arredondado: ${brl(c.rounded)}.`,
        formal: `Prezado(a),\n\nInformamos o detalhamento do cálculo proporcional referente à reativação do seu contrato, cuja mensalidade regular é de ${brl(m)} (equivalente a ${brl(c.daily)} por dia, considerando a base de 30 dias):\n\n1. Período utilizado após o vencimento (${dateBR(due)} até ${dateBR(blocked)}): ${c.usedDays} dias${extraNote}, totalizando ${brl(c.used)}.\n2. Período da reativação até o próximo vencimento (${dateBR(reactivation)} até ${dateBR(nextDue)}): ${c.futureDays} dias, totalizando ${brl(c.future)}.\n\nA soma dos dois períodos resulta em ${brl(c.raw)}, valor que foi arredondado conforme política interna para ${brl(c.rounded)}. Após a regularização deste valor proporcional, as cobranças seguintes seguirão normalmente no valor integral de ${brl(m)}.\n\nPermanecemos à disposição para qualquer esclarecimento.`,
      };
    }
    if (mode === "vencimento") {
      const c = calc as any;
      return {
        whatsapp: `Quando um cliente solicita a mudança da data de vencimento da fatura, é necessário fazer um ajuste proporcional no valor da mensalidade para cobrir os dias a mais entre o vencimento atual e o novo vencimento.\n\nNo seu caso, o vencimento atual é ${dateBR(oldDue)}, e será alterado para ${dateBR(newDue)}. Como a mensalidade é de ${brl(m)}, dividimos esse valor por 30 para obter o valor diário:\n\n${brl(m)} ÷ 30 = ${brl(c.daily)} por dia\n\nDepois, calculamos a diferença entre o vencimento antigo e o novo vencimento, o que dá ${c.days} dias.\n\nAgora, multiplicamos o valor diário pela quantidade de dias adicionais:\n\n${brl(c.daily)} × ${c.days} = ${brl(c.raw)}\n\nO proporcional será arredondado para ${brl(c.rounded)}. Também será acrescentada a taxa de geração de boleto de R$ 1,20.\n\nSeu próximo pagamento será no dia ${dateBR(newDue)} e o valor será de ${brl(c.total)} (mensalidade de ${brl(m)} + proporcional de ${brl(c.rounded)} + taxa de R$ 1,20).\n\nApós esse ajuste, você seguirá normalmente pagando a mensalidade de ${brl(m)} todo mês, no novo dia de vencimento.\n\nEsse ajuste é necessário para garantir que o serviço continue ativo e corretamente coberto durante esse intervalo de dias a mais.\n\nSe estiver de acordo, me confirme e o procedimento será realizado.`,
        protocolo: `[CÁLCULO TROCA DE VENCIMENTO] Mensalidade: ${brl(m)} (${brl(c.daily)}/dia) | Venc. atual: ${dateBR(oldDue)} → Novo venc.: ${dateBR(newDue)} (${c.days} dias adicionais) | Prop. bruto: ${brl(c.raw)} → Arredondado: ${brl(c.rounded)} + Taxa R$ 1,20 | Total próx. fatura: ${brl(c.total)}.`,
        formal: `Prezado(a),\n\nEm atenção à solicitação de alteração da data de vencimento da sua fatura de ${dateBR(oldDue)} para ${dateBR(newDue)}, apresentamos o demonstrativo do ajuste proporcional referente aos ${c.days} dias adicionais de cobertura:\n\n• Mensalidade base: ${brl(m)} (valor diário de ${brl(c.daily)} na base de 30 dias)\n• Proporcional referente a ${c.days} dias: ${brl(c.raw)} (arredondado para ${brl(c.rounded)})\n• Taxa de geração de boleto: R$ 1,20\n\nDessa forma, o valor total da próxima fatura com vencimento em ${dateBR(newDue)} será de ${brl(c.total)}. A partir dos ciclos subsequentes, será cobrada apenas a mensalidade regular de ${brl(m)} na nova data escolhida.\n\nSolicitamos sua confirmação para darmos sequência ao procedimento.`,
      };
    }
    const c = calc as any;
    return {
      whatsapp: `Gostaríamos de informar que, ao aceitar o upgrade, a vigência contratual será renovada por mais um ano. Dessa forma, o contrato não poderá ser rescindido antes deste prazo, pois estará sujeito a multa rescisória.\n\nComo o seu plano é pré-pago, ao realizar uma mudança de plano, é necessário calcular um valor proporcional referente aos dias restantes do plano anterior até o início do novo plano.\n\nNesse caso, será feita a mudança e o valor proporcional será de ${brl(c.rounded)}, que será cobrado junto com o valor do novo plano no próximo vencimento, no dia ${dateBR(upgradeDue)}.\n\nOu seja, neste pagamento você irá pagar:\n\n${brl(newM)} referente ao novo plano mensal\n${brl(c.rounded)} referente ao proporcional da mudança de plano\n\nTotal da próxima cobrança: ${brl(c.total)}.\n\n*Importante:* essa cobrança proporcional acontece somente uma vez, por conta da troca de plano. A partir do mês seguinte, você pagará apenas o valor fixo da nova mensalidade, sem adicionais.\n\nSe estiver de acordo, forneça uma foto do documento de identidade com foto e assinatura do titular (CNH aberta ou RG frente e verso, juntamente com o CPF) para poder fazer o link de assinatura que estarei te enviando junto com o passo a passo de como assinar. Assim que tiver assinado, eu já vejo um horário disponível na agenda e confirmo com você.`,
      protocolo: `[CÁLCULO UPGRADE DE PLANO] Plano atual: ${brl(oldM)} → Novo plano: ${brl(newM)} (dif. ${brl(c.difference)}/mês · ${brl(c.daily)}/dia) | Base inicial: ${dateBR(c.start)} | Próx. venc.: ${dateBR(upgradeDue)} (${c.days} dias) | Prop. bruto: ${brl(c.raw)} → Arredondado: ${brl(c.rounded)} | Total próx. fatura: ${brl(c.total)}.`,
      formal: `Prezado(a),\n\nConforme solicitado, segue o detalhamento financeiro referente à alteração de plano de ${brl(oldM)} para ${brl(newM)} (diferença mensal de ${brl(c.difference)}, equivalente a ${brl(c.daily)}/dia):\n\n• Período proporcional (${dateBR(c.start)} até ${dateBR(upgradeDue)} — ${c.days} dias): ${brl(c.raw)}, arredondado para ${brl(c.rounded)}.\n• Valor da nova mensalidade integral: ${brl(newM)}.\n• Total previsto para o vencimento de ${dateBR(upgradeDue)}: ${brl(c.total)}.\n\nRessaltamos que a cobrança proporcional ocorre apenas nesta primeira fatura após a alteração; nos meses seguintes, será cobrado exclusivamente o valor fixo de ${brl(newM)}. A aceitação do upgrade implica renovação da vigência contratual por 12 meses.\n\nPara darmos continuidade à emissão do termo de aditivo para assinatura digital, solicitamos o envio de documento oficial com foto e assinatura do titular (CNH ou RG frente e verso e CPF).`,
    };
  }, [mode, calc, m, due, blocked, reactivation, nextDue, oldDue, newDue, oldM, newM, upgradeDue]);

  const message = messagesByChannel[channel];

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
          ? `${c.usedDays}${c.extraDays > 0 ? ` (${c.baseUsedDays}+${c.extraDays})` : ""} + ${c.futureDays} dias · proporcional ${brl(c.raw)} → ${brl(c.rounded)}`
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

  const copyProtocol = async () => {
    const text = messagesByChannel.protocolo;
    if (!text) {
      setToast("Preencha os campos obrigatórios para gerar o registro.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedProtocol(true);
      setToast("Resumo de protocolo copiado para colar no ERP.");
      setTimeout(() => setCopiedProtocol(false), 2000);
    } catch {
      setToast("Não foi possível copiar automaticamente. Selecione o texto e copie.");
    }
  };

  const clearFields = () => {
    if (mode === "reativacao") {
      setMonthly("");
      setDue("");
      setBlocked("");
      setReactivation(today()); // a reativação normalmente é hoje: já vem preenchida, sem marcar como exemplo
      setNextDue("");
      setExtraDays(0);
      setSampleFlags((prev) => ({ ...prev, monthly: false, due: false, blocked: false, nextDue: false }));
    } else if (mode === "vencimento") {
      setMonthly("");
      setOldDue("");
      setNewDue("");
      setSampleFlags((prev) => ({ ...prev, monthly: false, oldDue: false, newDue: false }));
    } else {
      setOldPlan("");
      setNewPlan("");
      setEquipmentDate("");
      setUpgradeDue("");
      setSampleFlags((prev) => ({ ...prev, oldPlan: false, newPlan: false, upgradeDue: false }));
    }
    setToast("Campos limpos. Preencha os dados do cliente.");
  };

  const resetFields = () => {
    setMonthly(DEFAULTS.monthly);
    setDue(DEFAULTS.due);
    setBlocked(DEFAULTS.blocked);
    setReactivation(today());
    setNextDue(DEFAULTS.nextDue);
    setExtraDays(0);
    setOldDue(DEFAULTS.oldDue);
    setNewDue(DEFAULTS.newDue);
    setOldPlan(DEFAULTS.oldPlan);
    setNewPlan(DEFAULTS.newPlan);
    setEquipmentDate("");
    setUpgradeDue(DEFAULTS.upgradeDue);
    setSampleFlags({
      monthly: true,
      due: true,
      blocked: true,
      nextDue: true,
      oldDue: true,
      newDue: true,
      oldPlan: true,
      newPlan: true,
      upgradeDue: true,
    });
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
              onChange={(v) => {
                markEdited("monthly");
                setMonthly(v);
              }}
              placeholder="80,00"
              isSample={sampleFlags.monthly}
            />
            <Field
              label="Vencimento do boleto considerado"
              value={due}
              onChange={(v) => {
                markEdited("due");
                setDue(v);
              }}
              type="date"
              isSample={sampleFlags.due}
              tooltip="Data de vencimento do primeiro boleto em atraso que ocasionou o bloqueio do contrato."
            />
          </div>
          <div className="field-grid">
            <Field
              label="Data efetiva do bloqueio"
              value={blocked}
              onChange={(v) => {
                markEdited("blocked");
                setBlocked(v);
              }}
              type="date"
              isSample={sampleFlags.blocked}
              warning={dateWarnings.blocked}
              hint="Data em que o sistema bloqueou a conexão (considerando feriados/finais de semana)."
            />
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
            onChange={(v) => {
              markEdited("nextDue");
              setNextDue(v);
            }}
            type="date"
            isSample={sampleFlags.nextDue}
          />
          <div className="extra-days-box">
            <div className="extra-days-head">
              <div>
                <strong>Dias adicionais manuais (opcional)</strong>
                <p>
                  Opcional: digite a quantidade de dias a mais para somar ao cálculo — ideal para casos de <b>desbloqueios</b> ou outros ajustes extras de uso.
                </p>
              </div>
              <label className="extra-days-field">
                <span>Quantidade de dias a mais (opcional)</span>
                <div className="extra-days-input-wrap">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={extraDays === 0 ? "" : String(extraDays)}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setExtraDays(0);
                        return;
                      }
                      const parsed = Math.max(0, Math.floor(Number(raw)));
                      setExtraDays(Number.isFinite(parsed) ? parsed : 0);
                    }}
                  />
                  <span className="extra-days-unit">
                    {extraDays === 1 ? "dia extra" : "dias extras"}
                  </span>
                </div>
              </label>
            </div>
          </div>
          <div className="notice">
            <span className="notice-icon">ℹ</span>
            <div>
              A contagem futura inclui o dia da reativação e o próximo vencimento. O período em atraso conta a partir do dia seguinte ao vencimento até o bloqueio{extraDays > 0 ? `, somando +${extraDays} ${extraDays === 1 ? "dia manual" : "dias manuais"} (total de ${c.usedDays} dias usados)` : ""}.
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
              onChange={(v) => {
                markEdited("monthly");
                setMonthly(v);
              }}
              placeholder="80,00"
              isSample={sampleFlags.monthly}
            />
            <Field
              label="Vencimento atual"
              value={oldDue}
              onChange={(v) => {
                markEdited("oldDue");
                setOldDue(v);
              }}
              type="date"
              isSample={sampleFlags.oldDue}
            />
          </div>
          <Field
            label="Novo vencimento"
            value={newDue}
            onChange={(v) => {
              markEdited("newDue");
              setNewDue(v);
            }}
            type="date"
            isSample={sampleFlags.newDue}
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
            onChange={(v) => {
              markEdited("oldPlan");
              setOldPlan(v);
            }}
            placeholder="100,00"
            isSample={sampleFlags.oldPlan}
          />
          <Field
            label="Nova mensalidade"
            prefix="R$"
            value={newPlan}
            onChange={(v) => {
              markEdited("newPlan");
              setNewPlan(v);
            }}
            placeholder="160,00"
            isSample={sampleFlags.newPlan}
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
            onChange={(v) => {
              markEdited("upgradeDue");
              setUpgradeDue(v);
            }}
            type="date"
            isSample={sampleFlags.upgradeDue}
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
                Calculamos a diferença de dias entre o vencimento considerado (<b>{dateBR(due)}</b>) e a data efetiva do bloqueio (<b>{dateBR(blocked)}</b>){c.extraDays > 0 ? <> e somamos <b>+{c.extraDays} {c.extraDays === 1 ? "dia manual" : "dias manuais"}</b> (ex.: desbloqueios ou ajustes extras)</> : ""} antes de multiplicar pelo valor diário.
              </p>
              <code>
                {c.extraDays > 0 ? `${c.baseUsedDays} + ${c.extraDays} = ` : ""}{c.usedDays} dias × {brl(c.daily)} = {brl(c.used)}
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
                    <ResultLine
                      label={
                        c.extraDays > 0
                          ? `${c.usedDays} dias usados (${c.baseUsedDays} base + ${c.extraDays} manual)`
                          : `${c.usedDays} dias usados após o vencimento`
                      }
                      value={brl(c.used)}
                    />
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

                <div className="compare-card" aria-label="Resumo comparativo antes e depois">
                  <div className="compare-head">
                    <span className="compare-title">Comparativo antes × depois</span>
                    {c.valid && (
                      <span
                        className={`compare-delta ${
                          mode === "reativacao"
                            ? c.total < m
                              ? "is-discount"
                              : c.total > m
                                ? "is-increase"
                                : "is-neutral"
                            : "is-increase"
                        }`}
                      >
                        {mode === "reativacao"
                          ? c.total === m
                            ? "Igual à mensalidade"
                            : `${c.total > m ? "+" : "−"}${brl(Math.abs(safe(c.total - m)))} vs. mensalidade`
                          : mode === "vencimento"
                            ? `+${brl(safe(c.total - m))} no 1º boleto`
                            : `+${brl(c.rounded)} único + ${brl(c.difference)}/mês`}
                      </span>
                    )}
                  </div>

                  <div className="compare-grid">
                    <div className="compare-col is-before">
                      <span className="compare-tag">Cenário atual</span>
                      {mode === "reativacao" ? (
                        <>
                          <strong>{brl(m)}</strong>
                          <small>Mensalidade padrão (30d)</small>
                          <em>Venc. base: {dateBR(due)}</em>
                        </>
                      ) : mode === "vencimento" ? (
                        <>
                          <strong>{brl(m)}</strong>
                          <small>Mensalidade atual</small>
                          <em>Venc. atual: {dateBR(oldDue)}</em>
                        </>
                      ) : (
                        <>
                          <strong>{brl(oldM)}</strong>
                          <small>Plano anterior</small>
                          <em>Vigência até {dateBR(upgradeDue)}</em>
                        </>
                      )}
                    </div>

                    <div className="compare-arrow" aria-hidden="true">→</div>

                    <div className="compare-col is-after">
                      <span className="compare-tag">Cenário ajustado</span>
                      {mode === "reativacao" ? (
                        <>
                          <strong>{brl(c.total)}</strong>
                          <small>{c.usedDays + c.futureDays} dias proporcionais</small>
                          <em>Próx. venc.: {dateBR(nextDue)}</em>
                        </>
                      ) : mode === "vencimento" ? (
                        <>
                          <strong>{brl(c.total)}</strong>
                          <small>1ª fatura (+{c.days}d + taxa)</small>
                          <em>Novo venc.: {dateBR(newDue)}</em>
                        </>
                      ) : (
                        <>
                          <strong>{brl(c.total)}</strong>
                          <small>1ª fatura · depois {brl(newM)}/mês</small>
                          <em>Venc.: {dateBR(upgradeDue)}</em>
                        </>
                      )}
                    </div>
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
                  <h3>Mensagem e registro do atendimento</h3>
                  <p>Alterne entre o formato para o cliente ou registro rápido de protocolo.</p>
                </div>
              </div>
              <div className="message-actions">
                {channel !== "protocolo" && (
                  <button
                    type="button"
                    className={`copy-proto-btn ${copiedProtocol ? "is-copied" : ""}`}
                    onClick={copyProtocol}
                    disabled={!messagesByChannel.protocolo}
                    title="Copiar resumo em linha única para colar no protocolo do Voalle"
                  >
                    {copiedProtocol ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Protocolo copiado!
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Copiar p/ Protocolo
                      </>
                    )}
                  </button>
                )}
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
            </div>

            <div className="channel-bar" role="tablist" aria-label="Formato da mensagem">
              <div className="channel-tabs">
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    role="tab"
                    aria-selected={channel === ch.id}
                    className={`channel-tab ${channel === ch.id ? "active" : ""}`}
                    onClick={() => {
                      setChannel(ch.id);
                      setCopied(false);
                    }}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <span className="channel-hint">{channels.find((ch) => ch.id === channel)?.hint}</span>
            </div>

            <textarea
              className={`message-box ${channel === "protocolo" ? "is-protocol" : ""}`}
              value={message}
              readOnly
              placeholder="A mensagem aparece aqui assim que todos os campos obrigatórios estiverem preenchidos e as datas estiverem em ordem."
            />
            <div className="message-footer">
              <span>Texto pronto para uso — revise os valores e datas antes de encaminhar ou registrar.</span>
              <span className="wa-badge">● {channels.find((ch) => ch.id === channel)?.badge}</span>
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
