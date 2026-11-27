# Calculadora de Proporcionais — Vital Net Telecom (Portal SAC)

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Uso](https://img.shields.io/badge/uso-interno-0f2851)

Aplicação web **interna** da **Vital Net Telecom** para a equipe de **Atendimento ao Cliente (SAC) e Cobrança**. Ela calcula valores proporcionais, mostra a memória de cálculo passo a passo, exibe o comparativo entre cenários e gera mensagens padronizadas prontas para envio ao cliente ou registro de protocolo no ERP (Voalle).

> **Aviso:** o sistema é de uso exclusivamente interno. Telas, regras e valores não devem ser divulgados a pessoas externas à empresa. Somente as mensagens voltadas ao cliente geradas no passo 03 se destinam ao assinante.

## Sumário

- [Visão geral](#visão-geral)
- [Premissas gerais de cálculo](#premissas-gerais-de-cálculo)
- [Módulos e regras de cálculo](#módulos-e-regras-de-cálculo)
  - [1. Reativação](#1-reativação)
  - [2. Troca de vencimento](#2-troca-de-vencimento)
  - [3. Upgrade de plano](#3-upgrade-de-plano)
- [Validações e avisos](#validações-e-avisos)
- [Funcionalidades da interface](#funcionalidades-da-interface)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como executar localmente](#como-executar-localmente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Build, CI e deploy](#build-ci-e-deploy)
- [Como alterar as regras de negócio](#como-alterar-as-regras-de-negócio)
- [Privacidade e armazenamento de dados](#privacidade-e-armazenamento-de-dados)
- [Limitações conhecidas](#limitações-conhecidas)
- [Boas práticas de atendimento](#boas-práticas-de-atendimento)
- [Créditos](#créditos)

## Visão geral

Em atendimentos de regularização financeira, mudança de vencimento ou troca de plano, o operador precisa calcular cobranças proporcionais com base em períodos exatos de uso. Fazer isso à mão gera erros de contagem de dias e de arredondamento, e cada atendente explica o valor de um jeito.

A calculadora resolve isso em três etapas, todas atualizadas em tempo real:

| Etapa | Painel | O que entrega |
|:-----:|--------|---------------|
| **01** | Parâmetros da simulação | Formulário com validação visual de campos obrigatórios, dicas contextuais e avisos de datas |
| **02** | Memória de cálculo | Valor diário, dias contados, subtotal bruto, arredondamento, valor total e comparativo *antes × depois* |
| **03** | Mensagem e registro do atendimento | Scripts prontos para **WhatsApp**, **Protocolo / ERP** e **Formal / E-mail**, com botões de cópia rápida |

## Premissas gerais de cálculo

- **Base mensal comercial de 30 dias.** O valor diário é `mensalidade / 30`, independentemente de o mês ter 28, 29, 30 ou 31 dias.
- **Precisão intermediária de 2 casas.** O valor diário, os subtotais e o total são arredondados a 2 casas decimais (`Number(valor.toFixed(2))`) antes de serem combinados. Por isso `R$ 80,00 / 30` vira `R$ 2,67`, e não `2,6666…`, e as multiplicações seguintes usam `2,67`.
- **Arredondamento comercial para múltiplo de R$ 5,00.** O proporcional final é arredondado para o múltiplo de R$ 5,00 mais próximo. Valores exatamente no meio (por exemplo `R$ 2,50`) sobem, porque a função é `Math.round`.

```text
round5(valor) = Math.round(valor / 5) * 5
```

- **Transparência interna vs. comunicação externa.** Na memória de cálculo e no resumo de **Protocolo / ERP**, tanto o valor bruto quanto o valor arredondado são exibidos. Nas mensagens destinadas ao cliente (**WhatsApp** e **Formal / E-mail**), o texto apresenta diretamente o valor final já arredondado, sem citar o valor bruto nem mencionar que houve arredondamento.
- **Datas sem fuso horário.** Datas são lidas como `AAAA-MM-DD` e fixadas ao meio-dia local. A diferença em dias não sofre efeito de horário de verão nem de fuso.
- **Dia a dia inteiro.** A diferença entre duas datas é sempre um número inteiro de dias.

## Módulos e regras de cálculo

### 1. Reativação

Regulariza e reativa conexões bloqueadas por inadimplência. Soma os dias em que a conexão continuou ativa depois do vencimento (até o bloqueio efetivo) aos dias entre a reativação e o próximo vencimento.

**Entradas**

| Campo | Símbolo | Obrigatório | Observação |
|-------|:-------:|:-----------:|------------|
| Valor da mensalidade | `M` | Sim | Aceita formato brasileiro (`80,00`, `1.250,50`) |
| Vencimento do boleto considerado | `D_venc` | Sim | Vencimento do primeiro boleto em atraso que ocasionou o bloqueio do contrato |
| Data efetiva do bloqueio | `D_bloq` | Sim | Quando o sistema bloqueou de fato, considerando finais de semana e feriados |
| Data da reativação | `D_reat` | Sim | Já vem preenchida com a data de hoje |
| Próximo vencimento | `D_prox` | Sim | |
| Dias adicionais manuais | `Dias_extra` | Não | Número inteiro ≥ 0, ideal para casos de desbloqueios ou ajustes extras de uso |

**Fórmulas**

```text
1. Valor diário
   V_dia = M / 30

2. Dias de uso após o vencimento (a partir do dia seguinte ao vencimento, até o bloqueio)
   Dias_base = max(0, D_bloq - D_venc)
   Dias_uso  = Dias_base + Dias_extra
   V_uso     = Dias_uso * V_dia

3. Dias futuros (contagem inclusiva: conta o dia da reativação e o do próximo vencimento)
   Dias_fut = min(30, max(0, (D_prox - D_reat) + 1))   (teto de 30 dias)
   V_fut    = Dias_fut * V_dia

4. Total a pagar
   V_bruto = V_uso + V_fut
   Total   = round5(V_bruto)
```

**Exemplo** — mensalidade `R$ 80,00`, vencimento `29/10/2026`, bloqueio `06/11/2026`, reativação `25/11/2026`, próximo vencimento `29/11/2026`:

```text
V_dia     = 80,00 / 30                = R$ 2,67
Dias_uso  = 06/11 - 29/10             = 8 dias   → 8 x 2,67 = R$ 21,36
Dias_fut  = (29/11 - 25/11) + 1       = 5 dias   → 5 x 2,67 = R$ 13,35
V_bruto   = 21,36 + 13,35             = R$ 34,71
Total     = round5(34,71)             = R$ 35,00
```

### 2. Troca de vencimento

Usado quando o assinante pede para mudar a data de vencimento e é preciso cobrir os dias entre o vencimento atual e o novo.

**Entradas:** mensalidade (`M`), vencimento atual (`D_atual`) e novo vencimento (`D_novo`), todos obrigatórios.

**Fórmulas**

```text
1. Valor diário
   V_dia = M / 30

2. Dias adicionais
   Dias_adic = max(0, D_novo - D_atual)

3. Proporcional
   V_bruto = Dias_adic * V_dia
   V_prop  = round5(V_bruto)

4. Próximo pagamento (a taxa de R$ 1,20 de geração de boleto é somada
   DEPOIS do arredondamento)
   Total = M + V_prop + 1,20
```

**Exemplo** — mensalidade `R$ 80,00`, de `25/11/2026` para `10/12/2026`:

```text
V_dia    = R$ 2,67
Dias     = 10/12 - 25/11   = 15 dias → 15 x 2,67 = R$ 40,05
V_prop   = round5(40,05)   = R$ 40,00
Total    = 80,00 + 40,00 + 1,20 = R$ 121,20
```

Depois do ajuste, o cliente volta a pagar só a mensalidade, no novo dia de vencimento.

### 3. Upgrade de plano

Usado na migração para um plano superior (modelo pré-pago). Cobra proporcionalmente **apenas a diferença** entre os planos até o próximo vencimento, somada à nova mensalidade, **uma única vez**.

**Entradas**

| Campo | Símbolo | Obrigatório | Observação |
|-------|:-------:|:-----------:|------------|
| Mensalidade atual | `M_atual` | Sim | |
| Nova mensalidade | `M_nova` | Sim | Deve ser **maior** que a atual |
| Data da troca do equipamento | `D_equip` | Não | Se vazio, usa a data de hoje |
| Próximo vencimento | `D_venc` | Sim | |

**Fórmulas**

```text
1. Diferença mensal e valor diário
   Diferenca = M_nova - M_atual
   V_dia     = Diferenca / 30

2. Dias restantes (D_inicio = D_equip, ou hoje se o campo estiver vazio)
   Dias_rest = max(0, D_venc - D_inicio)

3. Proporcional
   V_bruto = Dias_rest * V_dia
   V_prop  = round5(V_bruto)

4. Próxima cobrança (única vez)
   Total = M_nova + V_prop
```

**Exemplo** — de `R$ 100,00` para `R$ 160,00`, troca em `25/11/2026`, próximo vencimento `10/12/2026`:

```text
Diferenca = 160,00 - 100,00 = R$ 60,00
V_dia     = 60,00 / 30      = R$ 2,00
Dias_rest = 10/12 - 25/11   = 15 dias → 15 x 2,00 = R$ 30,00
V_prop    = round5(30,00)   = R$ 30,00
Total     = 160,00 + 30,00  = R$ 190,00
```

## Validações e avisos

A aplicação separa **erros** (bloqueiam a geração das mensagens e o salvamento) de **avisos** (apenas alertam).

| Situação | Tipo | Comportamento |
|----------|:----:|---------------|
| Campo obrigatório vazio | Erro | Campo em vermelho, badge `Campo vazio` e mensagem orientativa |
| Mensalidade ≤ 0 (Reativação e Troca de vencimento) | Erro | Cálculo marcado como inválido |
| Troca de vencimento: novo vencimento não posterior ao atual | Erro | Cálculo inválido (0 dias adicionais) |
| Upgrade: nova mensalidade não superior à atual | Erro | Cálculo inválido |
| Upgrade: próximo vencimento sem dias restantes | Erro | Cálculo inválido (0 dias) |
| Reativação: bloqueio **antes** do vencimento | Aviso | Campo em amarelo, badge `Confira`; nenhum dia de uso pós-vencimento é contado |
| Reativação: reativação **depois** do próximo vencimento | Aviso | Campo em amarelo, badge `Confira`; nenhum dia futuro é contado |
| Reativação: próximo vencimento a **mais de 30 dias** da reativação | Aviso | Campo em amarelo; a contagem futura é limitada a 30 dias (a mensagem informa o teto) |

Enquanto houver erro, os botões **Salvar simulação no histórico**, **Copiar mensagem** e **Copiar p/ Protocolo** ficam desabilitados e a caixa de texto permanece vazia. Isso evita copiar um texto com `R$ 0,00` e datas `—`. Os avisos de data aparecem também como resumo no painel de resultado, e o cálculo segue disponível.

## Funcionalidades da interface

- **Três módulos de cálculo** na barra lateral: Reativação, Troca de vencimento e Upgrade de plano.
- **Cálculo em tempo real:** memória de cálculo, comparativo e mensagens atualizam a cada digitação.
- **Dados de exemplo sinalizados:** os campos iniciam com valores demonstrativos marcados com a badge **`Exemplo`** e um banner no topo do formulário. A badge some do campo assim que ele é editado.
  - **`Limpar campos`** zera o formulário do módulo ativo para um novo atendimento.
  - **`Restaurar exemplo`** devolve os valores demonstrativos.
  - A **Data da reativação** nunca é tratada como exemplo: vem com a data de hoje, inclusive depois de `Limpar campos`.
- **Dias adicionais manuais** (Reativação): campo opcional para somar dias de desbloqueio ou ajuste. A soma aparece discriminada na memória de cálculo, nas mensagens e no histórico (por exemplo `9 (8+1) + 5 dias`).
- **Comparativo antes × depois:** cartão posicionado logo abaixo do total a pagar (`total-card`), contrastando o **Cenário atual** com o **Cenário ajustado** e exibindo um *badge* com a diferença financeira entre eles.
- **Múltiplos formatos de mensagem e registro (Passo 03):**
  - **WhatsApp:** texto direto e claro formatado para envio ao cliente, exibindo diretamente o valor final arredondado (sem citar valor bruto ou arredondamento).
  - **Protocolo / ERP:** resumo técnico em linha única otimizado para colar no relato do atendimento no Voalle, mantendo os valores bruto e arredondado. Pode ser copiado a qualquer momento pelo botão de atalho **`Copiar p/ Protocolo`**, mesmo enquanto outra aba estiver ativa.
  - **Formal / E-mail:** texto estruturado para comunicação formal ao assinante, também apresentando diretamente o valor final arredondado.
  - **Aviso interno no rodapé do painel:** lembra o atendente quando o texto exibe apenas o valor final arredondado (abas de cliente) ou ambos os valores (aba de protocolo).
- **Dicas contextuais (`?`)** em campos cuja regra não é óbvia, como o *Vencimento do boleto considerado*.
- **Modal "Como funciona o cálculo":** explica passo a passo a conta com os valores reais da simulação ativa. Fecha pelo `×`, por clique fora ou pela tecla `Esc`.
- **Histórico local persistente:** guarda até **60** simulações, as mais recentes primeiro. Abre numa **gaveta lateral** (fecha com `×`, clique fora ou `Esc`) e permite limpar tudo, com confirmação.
- **Avisos (toasts)** que desaparecem sozinhos após alguns segundos e podem ser dispensados com um clique.
- **Acessibilidade básica:** `aria-label`s, `role="dialog"`, `role="tablist"`, foco movido para o botão de fechar ao abrir a gaveta, tooltips acessíveis por teclado e respeito a `prefers-reduced-motion`.
- **Design responsivo** para desktop e celular (breakpoints em 1100 px e 760 px).

## Tecnologias

- **React 18** e **TypeScript 5** (modo `strict`)
- **Vite 5** com `@vitejs/plugin-react`
- **CSS puro** com Custom Properties, na identidade visual da Vital Net Telecom (paleta extraída da logo; fontes *Plus Jakarta Sans* e *Inter*, via Google Fonts)
- **Web Storage API** (`localStorage`) e **Clipboard API** (`navigator.clipboard`)
- Sem bibliotecas de UI, de datas ou de estado: nenhuma dependência além de `react` e `react-dom`

## Estrutura do projeto

```text
calculadora-proporcionais-vitalnet/
├── .github/
│   └── workflows/
│       └── build.yml          # CI: instala dependências e roda o build (Node 20)
├── images/                    # Raiz de arquivos estáticos (publicDir do Vite)
│   ├── favicon.svg            # Ícone do site
│   └── vitalnet-logo.png      # Logotipo oficial
├── public/
│   └── favicon.svg            # Cópia do favicon (não é usada: veja "Limitações conhecidas")
├── src/
│   ├── App.tsx                # Cálculos, estados, validações, comparativo, modal, gaveta de histórico e mensagens por canal
│   ├── index.css              # Estilos globais, tema, responsividade e estados de validação
│   └── main.tsx               # Ponto de entrada React
├── index.html                 # Documento HTML raiz (pt-BR, meta tags e favicon)
├── package.json               # Dependências e scripts
├── render.yaml                # Blueprint de deploy no Render (site estático)
├── tsconfig.json              # Configuração do TypeScript
├── vite.config.ts             # Configuração do Vite (publicDir: "images")
└── README.md                  # Este documento
```

## Como executar localmente

### Pré-requisitos

- **Node.js 18 ou superior** (a CI usa a versão 20)
- **npm**

### Passo a passo

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse o endereço exibido no terminal (normalmente `http://localhost:5173`). O servidor escuta em `0.0.0.0`, então também pode ser aberto por outros dispositivos da mesma rede, como um celular, usando o IP da máquina.

## Scripts disponíveis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento com hot reload (`vite --host 0.0.0.0`) |
| `npm run build` | Checa os tipos (`tsc --noEmit`) e gera o build de produção em `dist/` |
| `npm run preview` | Serve o build de `dist/` localmente para conferência (`vite preview --host 0.0.0.0`) |

## Build, CI e deploy

**Integração contínua.** O workflow [`build.yml`](.github/workflows/build.yml) roda a cada push ou pull request na branch `main`: faz checkout, configura o Node 20, executa `npm install` e `npm run build`. Um erro de tipos do TypeScript derruba o build.

**Deploy.** O arquivo [`render.yaml`](render.yaml) descreve um site estático no [Render](https://render.com):

```yaml
services:
  - type: web
    name: calculadora-proporcionais-vitalnet
    runtime: static
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

Para publicar, crie um *Blueprint* no Render apontando para este repositório. Qualquer hospedagem de arquivos estáticos (Netlify, Vercel, GitHub Pages, Nginx etc.) também serve: publique o conteúdo de `dist/`. Como o app tem uma única rota, a regra de rewrite é opcional.

## Como alterar as regras de negócio

Todas as regras ficam em `src/App.tsx`:

| O que mudar | Onde |
|-------------|------|
| Divisor comercial (`30`) | Chamadas `safe(m / 30)` e `safe(difference / 30)` em `calc`, e os textos de explicação e de mensagem |
| Múltiplo de arredondamento (`5`) | Função `round5` |
| Taxa de boleto (`R$ 1,20`) | Constante `fee = 1.2` em `calc` (modo `vencimento`), mais as ocorrências literais `R$ 1,20` nas mensagens, no modal e na tela de resultado |
| Valores de exemplo | Objeto `DEFAULTS` |
| Textos por canal (`whatsapp`, `protocolo`, `formal`) | Objeto `messagesByChannel` (`useMemo`) |
| Limite do histórico (60) | `.slice(0, 60)` em `save` |
| Chaves do `localStorage` | `"vitalnet-proportional-history"` e `"vitalnet-proportional-channel"` |
| Cores e tipografia | Variáveis `:root` em `src/index.css` |

Ao mudar uma regra, ajuste também os textos do modal "Como funciona o cálculo" e das mensagens, para que a explicação continue batendo com a conta.

## Privacidade e armazenamento de dados

- **Cálculos locais no navegador.** Todo o cálculo roda localmente no navegador do atendente, sem envio de dados financeiros ou cadastrais de clientes a servidores externos.
- **Telemetria opcional de acesso.** Caso a variável de ambiente `VITE_ACCESS_WEBHOOK_URL` esteja configurada com uma URL HTTP válida, é enviado apenas um aviso simples de acesso contendo data e hora, sem qualquer dado da simulação ou do cliente.
- **Preferências e histórico local.** O histórico fica armazenado exclusivamente no `localStorage` do navegador em uso na chave `vitalnet-proportional-history` (guardando apenas tipo de cálculo, data, total e resumo numérico, sem nome, CPF ou contrato), e a aba de mensagem selecionada é lembrada na chave `vitalnet-proportional-channel`.
- Em computadores compartilhados, use **Limpar tudo** na gaveta de histórico ao fim do turno. O histórico não sincroniza entre aparelhos.
- Em abas anônimas ou com o armazenamento bloqueado, o app continua funcionando normalmente, apenas sem persistir histórico ou preferência de aba.
- A única chamada externa padrão é o carregamento das fontes do Google Fonts.

## Limitações conhecidas

- **Sem testes automatizados.** A CI valida apenas tipos e build. Confira qualquer mudança nas fórmulas com os exemplos deste README.
- **Fontes dependem de internet.** Sem acesso ao Google Fonts, o navegador usa fontes de sistema e o layout continua funcional.
- **`public/favicon.svg` é redundante.** O Vite está configurado com `publicDir: "images"`, então só o conteúdo de `images/` é copiado para o build. A pasta `public/` pode ser removida, ou então o `publicDir` revisto.
- **Feriados e finais de semana não são calculados.** O operador informa a data efetiva do bloqueio, e a aplicação não consulta calendário.
- **Valores fixos no código.** Taxa de boleto, divisor e arredondamento não são configuráveis pela interface (veja a seção anterior).
- **Reativação não exige ordem de datas.** Datas fora do fluxo normal geram apenas aviso, para que o operador possa tratar casos excepcionais.

## Boas práticas de atendimento

- Antes de atender um cliente real, use **`Limpar campos`** para que valores de exemplo não permaneçam por engano.
- Confira o **bloqueio efetivo** no sistema (fins de semana e feriados deslocam a data) antes de preencher a Reativação.
- Para **desbloqueios** ou dias de uso fora do período normal, use o campo de dias adicionais manuais e confirme a conta no modal.
- No **Upgrade de plano**, confirme a renovação contratual de 12 meses e solicite a documentação do titular antes de gerar o link de assinatura, como indica o script automático.
- Use **`Copiar p/ Protocolo`** para registrar rapidamente os valores bruto e arredondado no atendimento do Voalle, e envie ao cliente o texto das abas **WhatsApp** ou **Formal / E-mail**.
- Use **`Como funciona o cálculo`** para explicar ao assinante como o valor foi composto e para treinar novos colaboradores.
- Revise valores e datas na mensagem antes de enviá-la ao cliente.

## Créditos

Desenvolvido por **Giliel** para a **Vital Net Telecom**. Uso interno. O repositório não define licença de uso externo.
