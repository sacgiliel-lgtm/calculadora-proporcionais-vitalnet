import { useEffect, useMemo, useState } from "react";

type Mode = "reativacao" | "vencimento" | "upgrade";
type Saved = { id:string; mode:Mode; title:string; total:number; date:string; details:string };
const brl = (n:number) => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateFrom = (s:string) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d,12); };
const dayDiff = (a:string,b:string) => Math.round((dateFrom(b).getTime()-dateFrom(a).getTime())/86400000);
const dateBR = (s:string) => s ? dateFrom(s).toLocaleDateString("pt-BR") : "—";
const moneyNumber = (s:string) => Number(s.replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"")) || 0;
const round5 = (n:number) => Math.round(n/5)*5;
const safe = (n:number) => Number(n.toFixed(2));
const modes: {id:Mode;label:string;short:string;icon:string}[] = [
  {id:"reativacao",label:"Reativação",short:"Regularização e retorno da conexão",icon:"↻"},
  {id:"vencimento",label:"Troca de vencimento",short:"Ajuste entre duas datas de cobrança",icon:"▦"},
  {id:"upgrade",label:"Upgrade",short:"Diferença proporcional entre planos",icon:"↗"}
];
function Field({label,value,onChange,type="text",hint,placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:"text"|"date";hint?:string;placeholder?:string}) {
  return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{hint&&<small>{hint}</small>}</label>;
}
function ResultLine({label,value,muted=false}:{label:string;value:string;muted?:boolean}) {
  return <div className={`result-line ${muted?"muted":""}`}><span>{label}</span><strong>{value}</strong></div>;
}
export default function App(){
  const [mode,setMode]=useState<Mode>("reativacao");
  const [monthly,setMonthly]=useState("80,00");
  const [due,setDue]=useState("2026-10-29");
  const [blocked,setBlocked]=useState("2026-11-06");
  const [reactivation,setReactivation]=useState(today());
  const [nextDue,setNextDue]=useState("2026-11-29");
  const [oldDue,setOldDue]=useState("2026-11-25");
  const [newDue,setNewDue]=useState("2026-12-10");
  const [oldPlan,setOldPlan]=useState("100,00");
  const [newPlan,setNewPlan]=useState("160,00");
  const [equipmentDate,setEquipmentDate]=useState("");
  const [upgradeDue,setUpgradeDue]=useState("2026-12-10");
  const [copied,setCopied]=useState(false);
  const [history,setHistory]=useState<Saved[]>([]);
  const [showHistory,setShowHistory]=useState(false);
  const [toast,setToast]=useState("");
  useEffect(()=>{try{setHistory(JSON.parse(localStorage.getItem("vitalnet-proportional-history")||"[]"));}catch{}},[]);
  useEffect(()=>{localStorage.setItem("vitalnet-proportional-history",JSON.stringify(history));},[history]);
  const m=moneyNumber(monthly), oldM=moneyNumber(oldPlan), newM=moneyNumber(newPlan);
  const calc=useMemo(()=>{
    if(mode==="reativacao"){
      const daily=safe(m/30);
      const usedDays=due&&blocked?Math.max(0,dayDiff(due,blocked)):0;
      const futureDays=reactivation&&nextDue?Math.max(0,dayDiff(reactivation,nextDue)+1):0;
      const used=safe(daily*usedDays),future=safe(daily*futureDays),raw=safe(used+future),rounded=round5(raw);
      return {daily,usedDays,futureDays,used,future,raw,rounded,total:rounded,valid:m>0&&usedDays>=0&&futureDays>=0&&!!due&&!!blocked&&!!reactivation&&!!nextDue};
    }
    if(mode==="vencimento"){
      const daily=safe(m/30),days=oldDue&&newDue?Math.max(0,dayDiff(oldDue,newDue)):0;
      const raw=safe(daily*days),rounded=round5(raw),fee=1.2,total=safe(m+rounded+fee);
      return {daily,days,raw,rounded,fee,total,valid:m>0&&!!oldDue&&!!newDue&&dayDiff(oldDue,newDue)>0};
    }
    const difference=safe(newM-oldM),daily=safe(difference/30),start=equipmentDate||today();
    const days=upgradeDue&&start?Math.max(0,dayDiff(start,upgradeDue)):0;
    const raw=safe(daily*days),rounded=round5(raw),total=safe(newM+rounded);
    return {difference,daily,days,start,raw,rounded,total,valid:oldM>=0&&newM>oldM&&!!upgradeDue&&days>0};
  },[mode,m,due,blocked,reactivation,nextDue,oldDue,newDue,oldM,newM,equipmentDate]);
  const message=useMemo(()=>{
    if(mode==="reativacao"){
      const c=calc as any;
      return `Verifiquei que sua mensalidade é no valor de ${brl(m)}.\n\nPara regularizar e reativar a conexão, precisamos considerar os dias em que o serviço foi utilizado após o vencimento do primeiro boleto.\n\nA sua conexão continuou funcionando até o dia ${dateBR(blocked)}, ou seja, foram ${c.usedDays} dias de uso após o vencimento de ${dateBR(due)}.\nTambém estamos considerando a ativação da conexão de ${dateBR(reactivation)} até o próximo vencimento, que será em ${dateBR(nextDue)}, totalizando ${c.futureDays} dias de uso.\n\nFizemos o cálculo proporcional da seguinte forma:\n\n📌 ${brl(m)} / 30 dias = ${brl(c.daily)} por dia de uso\n\n${c.usedDays} dias usados após o vencimento de ${dateBR(due)}\n→ ${c.usedDays} x ${brl(c.daily)} = ${brl(c.used)}\n\n${c.futureDays} dias de hoje até o próximo vencimento (${dateBR(nextDue)})\n→ ${c.futureDays} x ${brl(c.daily)} = ${brl(c.future)}\n\n✅ Valor total calculado: ${brl(c.used)} + ${brl(c.future)} = ${brl(c.raw)}\n\nPorém, iremos arredondar o valor para ${brl(c.rounded)}.\n\nEsse valor cobre o período em que o serviço foi utilizado e o período que será utilizado até o próximo vencimento.`;
    }
    if(mode==="vencimento"){
      const c=calc as any;
      return `Quando um cliente solicita a mudança da data de vencimento da fatura, é necessário fazer um ajuste proporcional no valor da mensalidade para cobrir os dias a mais entre o vencimento atual e o novo vencimento.\n\nNo seu caso, o vencimento atual é ${dateBR(oldDue)}, e será alterado para ${dateBR(newDue)}. Como a mensalidade é de ${brl(m)}, dividimos esse valor por 30 para obter o valor diário:\n\n${brl(m)} ÷ 30 = ${brl(c.daily)} por dia\n\nDepois, calculamos a diferença entre o vencimento antigo e o novo vencimento, o que dá ${c.days} dias.\n\nAgora, multiplicamos o valor diário pela quantidade de dias adicionais:\n\n${brl(c.daily)} × ${c.days} = ${brl(c.raw)}\n\nO proporcional será arredondado para ${brl(c.rounded)}. Também será acrescentada a taxa de geração de boleto de R$ 1,20.\n\nSeu próximo pagamento será no dia ${dateBR(newDue)} e o valor será de ${brl(c.total)} (mensalidade de ${brl(m)} + proporcional de ${brl(c.rounded)} + taxa de R$ 1,20).\n\nApós esse ajuste, você seguirá normalmente pagando a mensalidade de ${brl(m)} todo mês, no novo dia de vencimento.\n\nEsse ajuste é necessário para garantir que o serviço continue ativo e corretamente coberto durante esse intervalo de dias a mais.\n\nSe estiver de acordo, me confirme e o procedimento será realizado.`;
    }
    const c=calc as any;
    return `Gostaríamos de informar que, ao aceitar o upgrade, a vigência contratual será renovada por mais um ano. Dessa forma, o contrato não poderá ser rescindido antes deste prazo, pois estará sujeito a multa rescisória.\n\nComo o seu plano é pré-pago, ao realizar uma mudança de plano, é necessário calcular um valor proporcional referente aos dias restantes do plano anterior até o início do novo plano.\n\nNesse caso, será feita a mudança e o valor proporcional será de ${brl(c.rounded)}, que será cobrado junto com o valor do novo plano no próximo vencimento, no dia ${dateBR(upgradeDue)}.\n\nOu seja, neste pagamento você irá pagar:\n\n${brl(newM)} referente ao novo plano mensal\n${brl(c.rounded)} referente ao proporcional da mudança de plano\n\nTotal da próxima cobrança: ${brl(c.total)}.\n\n*Importante:* essa cobrança proporcional acontece somente uma vez, por conta da troca de plano. A partir do mês seguinte, você pagará apenas o valor fixo da nova mensalidade, sem adicionais.\n\nSe estiver de acordo, forneça uma foto do documento de identidade com foto e assinatura do titular (CNH aberta ou RG frente e verso, juntamente com o CPF) para poder fazer o link de assinatura que estarei te enviando junto com o passo a passo de como assinar. Assim que tiver assinado, eu já vejo um horário disponível na agenda e confirmo com você.`;
  },[mode,calc,m,due,blocked,reactivation,nextDue,oldDue,newDue,newM,upgradeDue]);
  const save=()=>{if(!(calc as any).valid){setToast("Preencha os campos e confira as datas para calcular.");return;} const c=calc as any; const item:Saved={id:String(Date.now()),mode,title:modes.find(x=>x.id===mode)!.label,total:c.total,date:today(),details:mode==="reativacao"?`${c.usedDays} + ${c.futureDays} dias; proporcional ${brl(c.raw)} → ${brl(c.rounded)}`:mode==="vencimento"?`${c.days} dias; proporcional ${brl(c.rounded)} + taxa R$ 1,20`:`${c.days} dias; proporcional ${brl(c.rounded)}`};setHistory(h=>[item,...h].slice(0,60));setToast("Cálculo salvo no histórico deste dispositivo.");};
  const copy=async()=>{try{await navigator.clipboard.writeText(message);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setToast("Não foi possível copiar automaticamente. Selecione o texto e copie.");}};
  const inputFields=()=>{
    if(mode==="reativacao")return <><div className="field-grid"><Field label="Valor da mensalidade (R$)" value={monthly} onChange={setMonthly} placeholder="80,00"/><Field label="Vencimento do boleto considerado" value={due} onChange={setDue} type="date"/></div><div className="field-grid"><Field label="Data efetiva do bloqueio" value={blocked} onChange={setBlocked} type="date" hint="O dia informado é considerado como a data do bloqueio à meia-noite."/><Field label="Data da reativação" value={reactivation} onChange={setReactivation} type="date"/></div><Field label="Próximo vencimento" value={nextDue} onChange={setNextDue} type="date"/><div className="notice">A contagem do período futuro considera tanto o dia da reativação quanto o dia do próximo vencimento. O período após o vencimento conta a partir do dia seguinte ao vencimento até a data do bloqueio.</div></>;
    if(mode==="vencimento")return <><div className="field-grid"><Field label="Valor da mensalidade (R$)" value={monthly} onChange={setMonthly} placeholder="80,00"/><Field label="Vencimento atual" value={oldDue} onChange={setOldDue} type="date"/></div><Field label="Novo vencimento" value={newDue} onChange={setNewDue} type="date"/><div className="notice">A taxa de geração de boleto de R$ 1,20 é adicionada depois do arredondamento do proporcional. O cálculo considera a diferença entre as duas datas.</div></>;
    return <><div className="field-grid"><Field label="Mensalidade atual (R$)" value={oldPlan} onChange={setOldPlan} placeholder="100,00"/><Field label="Nova mensalidade (R$)" value={newPlan} onChange={setNewPlan} placeholder="160,00"/></div><div className="field-grid"><Field label="Data da troca do equipamento (opcional)" value={equipmentDate} onChange={setEquipmentDate} type="date" hint="Se deixar em branco, será utilizada a data de hoje."/><Field label="Próximo vencimento" value={upgradeDue} onChange={setUpgradeDue} type="date"/></div><div className="notice">O proporcional é calculado sobre a diferença entre os planos e será acrescentado uma única vez à próxima mensalidade. A data da troca do equipamento define o início do novo plano.</div></>;
  };
  const c=calc as any;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">V</div><div><strong>VITAL NET</strong><small>FERRAMENTAS DO SAC</small></div></div><div className="side-label">CALCULADORAS</div><nav>{modes.map(item=><button key={item.id} className={mode===item.id?"nav-item active":"nav-item"} onClick={()=>{setMode(item.id);setCopied(false);}}><span className="nav-icon">{item.icon}</span><span>{item.label}<small>{item.short}</small></span>{mode===item.id&&<i/>}</button>)}</nav><div className="sidebar-bottom"><button className="history-link" onClick={()=>setShowHistory(v=>!v)}>◷ <span>Histórico de cálculos</span></button><div className="side-foot">Uso interno · SAC<br/>Calculadora de proporcionais v1.0</div></div></aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">CENTRAL DE FERRAMENTAS / SAC</div><h1>Calculadora de proporcionais</h1><p>Calcule valores, confira as regras e gere a mensagem para o cliente.</p></div><div className="top-status"><span className="status-dot"/> Cálculos locais <span className="avatar">SAC</span></div></header>
      <div className="content"><div className="welcome-row"><div><span className="section-kicker">MÓDULO DE CÁLCULO</span><h2>{modes.find(x=>x.id===mode)!.label}</h2><p>{modes.find(x=>x.id===mode)!.short}.</p></div><span className="mode-chip">{modes.find(x=>x.id===mode)!.icon} &nbsp; {mode==="reativacao"?"REGULARIZAÇÃO":mode==="vencimento"?"ALTERAÇÃO DE DATA":"MUDANÇA DE PLANO"}</span></div>
      <div className="workspace"><section className="panel input-panel"><div className="panel-heading"><div><span className="step">01</span><div><h3>Dados do cálculo</h3><p>Informe os dados para realizar a simulação.</p></div></div><span className="required-note">* Campos necessários</span></div><div className="form-body">{inputFields()}</div><div className="form-actions"><button className="primary-btn" onClick={()=>{if(!c.valid){setToast("Confira os campos e as datas informadas.");return;}setToast("Cálculo atualizado.");}}>Calcular proporcional <span>→</span></button><button className="text-btn" onClick={()=>{setMonthly("80,00");setDue("2026-10-29");setBlocked("2026-11-06");setReactivation(today());setNextDue("2026-11-29");setOldDue("2026-11-25");setNewDue("2026-12-10");setOldPlan("100,00");setNewPlan("160,00");setEquipmentDate("");setUpgradeDue("2026-12-10");}}>Limpar campos</button></div></section>
      <section className="panel result-panel"><div className="panel-heading"><div><span className="step">02</span><div><h3>Resultado do cálculo</h3><p>Memória de cálculo e valor final.</p></div></div><span className="live-tag"><span/> SIMULAÇÃO</span></div><div className="result-body">
      {mode==="reativacao"?<><div className="metric-grid"><div className="metric"><small>Valor por dia</small><strong>{brl(c.daily)}</strong></div><div className="metric"><small>Dias considerados</small><strong>{c.usedDays+c.futureDays} <em>dias</em></strong></div></div><ResultLine label={`${c.usedDays} dias após o vencimento`} value={brl(c.used)}/><ResultLine label={`${c.futureDays} dias até o próximo vencimento`} value={brl(c.future)}/><ResultLine label="Total proporcional calculado" value={brl(c.raw)} muted/><div className="rounding-note">Arredondamento para o múltiplo de R$ 5,00 mais próximo</div></>:mode==="vencimento"?<><div className="metric-grid"><div className="metric"><small>Valor por dia</small><strong>{brl(c.daily)}</strong></div><div className="metric"><small>Dias adicionais</small><strong>{c.days} <em>dias</em></strong></div></div><ResultLine label="Proporcional antes do arredondamento" value={brl(c.raw)}/><div className="rounding-note">Arredondamento para o múltiplo de R$ 5,00 mais próximo</div><ResultLine label="Taxa de geração de boleto" value={brl(1.2)}/><ResultLine label="Mensalidade" value={brl(m)} muted/></>:<><div className="metric-grid"><div className="metric"><small>Diferença entre planos</small><strong>{brl(c.difference)}</strong></div><div className="metric"><small>Dias restantes</small><strong>{c.days} <em>dias</em></strong></div></div><ResultLine label="Valor diário da diferença" value={brl(c.daily)}/><ResultLine label="Proporcional antes do arredondamento" value={brl(c.raw)}/><div className="rounding-note">Arredondamento para o múltiplo de R$ 5,00 mais próximo</div><ResultLine label="Nova mensalidade" value={brl(newM)} muted/></>}
      <div className="total-card"><div><small>{mode==="reativacao"?"VALOR PROPORCIONAL A PAGAR":mode==="vencimento"?"PRÓXIMO PAGAMENTO (COM TAXA)":"PRÓXIMA MENSALIDADE + PROPORCIONAL"}</small><strong>{brl(c.total)}</strong><span>{mode==="reativacao"?"Valor após arredondamento":mode==="vencimento"?"Mensalidade + proporcional + R$ 1,20":"Nova mensalidade + proporcional único"}</span></div><div className="total-icon">✓</div></div>
      {!c.valid&&<div className="validation">Preencha os campos e confira se as datas estão em ordem para visualizar um resultado válido.</div>}
      <button className="save-btn" onClick={save} disabled={!c.valid}>＋ Salvar no histórico</button>
      </div></section></div>
      <section className="panel message-panel"><div className="panel-heading"><div><span className="step">03</span><div><h3>Mensagem para o cliente</h3><p>Texto montado automaticamente com os dados informados.</p></div></div><button className="copy-btn" onClick={copy}>{copied?"✓ Copiado":"▢ Copiar mensagem"}</button></div><textarea className="message-box" value={message} readOnly/><div className="message-footer"><span>Revise o texto antes de enviar ao cliente.</span><span>Formato compatível com WhatsApp</span></div></section>
      {showHistory&&<section className="panel history-panel"><div className="panel-heading"><div><span className="step">↺</span><div><h3>Histórico deste dispositivo</h3><p>Os registros ficam salvos apenas neste navegador.</p></div></div><button className="text-btn" onClick={()=>{if(confirm("Deseja apagar todo o histórico salvo neste navegador?"))setHistory([]);}}>Limpar histórico</button></div>{history.length===0?<p className="empty">Nenhum cálculo salvo ainda.</p>:history.map(h=><div className="history-row" key={h.id}><div><strong>{h.title}</strong><small>{dateBR(h.date)} · {h.details}</small></div><b>{brl(h.total)}</b></div>)}</section>}
      <footer className="footer">VITAL NET <span>•</span> Ferramenta interna de apoio ao SAC <span>•</span> Confira os dados antes de concluir qualquer cobrança.</footer>
      </div>
    </main>
    {toast&&<div className="toast" onClick={()=>setToast("")}>{toast} <button>×</button></div>}
  </div>;
}