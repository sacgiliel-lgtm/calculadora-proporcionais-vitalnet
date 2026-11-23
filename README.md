# Calculadora de Proporcionais — Vital Net Telecom (Portal SAC)

Aplicação web interna desenvolvida para a equipe de **Atendimento ao Cliente (SAC) & Cobrança** da **Vital Net Telecom**, projetada para calcular valores proporcionais com precisão, exibir a memória de cálculo detalhada e gerar mensagens padronizadas prontas para envio ao assinante (com formatação otimizada para WhatsApp).

## Sumário

* [Visão Geral](#-visão-geral)
* [Módulos e Regras de Cálculo](#-módulos-e-regras-de-cálculo)
  * [1. Reativação](#1-reativação)
  * [2. Troca de Vencimento](#2-troca-de-vencimento)
  * [3. Upgrade de Plano](#3-upgrade-de-plano)
* [Funcionalidades da Interface](#-funcionalidades-da-interface)
* [Tecnologias Utilizadas](#-tecnologias-utilizadas)
* [Estrutura do Projeto](#-estrutura-do-projeto)
* [Como Executar Localmente](#-como-executar-localmente)
* [Boas Práticas de Atendimento](#-boas-práticas-de-atendimento)

## Visão Geral

Durante atendimentos de regularização financeira, alteração cadastral de vencimento ou mudança de plano, os operadores do SAC precisam calcular cobranças proporcionais baseadas em períodos exatos de utilização.

A **Calculadora de Proporcionais** automatiza esse processo em tempo real, evitando erros manuais de contagem de dias ou arredondamento, além de padronizar a comunicação escrita com o cliente.

### Premissas Gerais de Cálculo

* **Base mensal padrão:** Todos os cálculos utilizam o divisor comercial de **30 dias** (`valor / 30`) para apuração do valor diário.
* **Precisão intermediária:** Os valores diários e subtotais são tratados com arredondamento padrão de duas casas decimais (`Number(valor.toFixed(2))`) antes da consolidação.
* **Arredondamento comercial:** O valor proporcional final é arredondado para o **múltiplo de R$ 5,00 mais próximo**, conforme a regra:

```text
Valor Arredondado = Math.round(Valor Bruto / 5) * 5
```

## Módulos e Regras de Cálculo

### 1. Reativação

Utilizado para regularizar e reativar conexões suspensas por inadimplência, somando os dias utilizados após o vencimento até o bloqueio efetivo aos dias futuros da reativação até o próximo vencimento.

* **Entradas obrigatórias:**
  * Valor da mensalidade (`M`)
  * Vencimento do boleto considerado (`D_venc`)
  * Data efetiva do bloqueio (`D_bloq`) — considerando finais de semana e feriados em que a conexão permaneceu ativa
  * Data da reativação (`D_reat`)
  * Próximo vencimento (`D_prox`)

* **Fórmulas aplicadas:**

```text
1. Valor diário:
   V_dia = M / 30

2. Dias em atraso (uso pós-vencimento):
   Dias_uso = max(0, D_bloq - D_venc)
   V_uso    = Dias_uso * V_dia

3. Dias futuros (contagem inclusiva da reativação ao próximo vencimento):
   Dias_fut = max(0, (D_prox - D_reat) + 1)
   V_fut    = Dias_fut * V_dia

4. Total a pagar:
   V_bruto = V_uso + V_fut
   Total   = round5(V_bruto)
```

### 2. Troca de Vencimento

Utilizado quando o assinante solicita alteração na data de vencimento da fatura e há um intervalo adicional de dias a ser coberto entre o vencimento atual e o novo vencimento.

* **Entradas obrigatórias:**
  * Valor da mensalidade (`M`)
  * Vencimento atual (`D_atual`)
  * Novo vencimento (`D_novo`)

* **Fórmulas aplicadas:**

```text
1. Valor diário:
   V_dia = M / 30

2. Dias adicionais:
   Dias_adic = max(0, D_novo - D_atual)

3. Proporcional bruto e arredondado:
   V_bruto = V_dia * Dias_adic
   V_prop  = round5(V_bruto)

4. Total do próximo pagamento (inclui taxa fixa de emissão de boleto de R$ 1,20):
   Total = M + V_prop + 1,20
```

### 3. Upgrade de Plano

Utilizado na migração para um plano superior (modelo pré-pago), cobrando proporcionalmente apenas a diferença entre os planos até o próximo vencimento, somada à nova mensalidade.

* **Entradas:**
  * Mensalidade atual (`M_atual`) — *obrigatório*
  * Nova mensalidade (`M_nova`) — *obrigatório (deve ser maior que a atual)*
  * Data da troca do equipamento (`D_equip`) — *opcional (se omitida, assume automaticamente a data atual)*
  * Próximo vencimento (`D_venc`) — *obrigatório*

* **Fórmulas aplicadas:**

```text
1. Diferença mensal e valor diário:
   Diferenca = M_nova - M_atual
   V_dia     = Diferenca / 30

2. Dias restantes até o próximo vencimento (onde D_inicio é D_equip ou a data de hoje):
   Dias_rest = max(0, D_venc - D_inicio)

3. Proporcional bruto e arredondado:
   V_bruto = V_dia * Dias_rest
   V_prop  = round5(V_bruto)

4. Total da próxima cobrança (única vez):
   Total = M_nova + V_prop
```

## Funcionalidades da Interface

* **Cálculo em Tempo Real:** Atualização instantânea da memória de cálculo e do script de atendimento conforme os campos são preenchidos.
* **Identificação Clara de Dados de Exemplo:**
  * Os campos carregam inicialmente com valores de exemplo sinalizados pela badge **`EXEMPLO`** e por um banner informativo no topo do formulário.
  * Assim que o operador edita um campo, o marcador de exemplo daquele campo desaparece automaticamente.
  * Botão **`Limpar campos`** para zerar rapidamente o formulário ao iniciar um novo atendimento e **`Restaurar exemplo`** para voltar aos valores demonstrativos.
* **Validação Visual de Campos Obrigatórios:** Campos obrigatórios vazios recebem destaque em vermelho, badge **`Campo vazio`** e mensagem orientativa, bloqueando o salvamento no histórico até que os dados estejam válidos.
* **Modal Explicativo (`Como funciona o cálculo`):** Janela centralizada sobreposta à tela (fechável pelo botão `×`, clique externo ou tecla `Esc`) que explica passo a passo a lógica matemática utilizando os valores reais da simulação ativa.
* **Script Pronto com Cópia Rápida:** Gera automaticamente o texto explicativo completo para o cliente com botão **`Copiar mensagem`** e feedback visual.
* **Histórico Local Persistente:** Armazena até 60 simulações salvas no `localStorage` do navegador (`vitalnet-proportional-history`), permitindo consulta rápida e limpeza completa quando necessário.
* **Design Responsivo:** Adaptado para desktops e dispositivos móveis utilizados pela equipe de atendimento.

## Tecnologias Utilizadas

* **React 18** + **TypeScript**
* **Vite** (ambiente de desenvolvimento e empacotamento)
* **CSS3 Custom Properties** (identidade visual oficial Vital Net Telecom, tipografia *Plus Jakarta Sans* e *Inter*)
* **Web Storage API (`localStorage`)** e **Clipboard API (`navigator.clipboard`)**

## Estrutura do Projeto

```text
calculadora-proporcionais-vitalnet/
├── public/
│   └── vitalnet-logo.png      # Logotipo oficial Vital Net Telecom
├── src/
│   ├── App.tsx                # Lógica das calculadoras, estados, modal explicativo e templates de mensagem
│   ├── index.css              # Estilos globais, temas, responsividade, estados de validação e modal
│   └── main.tsx               # Ponto de entrada da aplicação React
├── index.html                 # Documento HTML raiz
├── package.json               # Dependências e scripts do projeto
├── tsconfig.json              # Configurações do TypeScript
└── README.md                  # Documentação do sistema
```

## Como Executar Localmente

### Pré-requisitos

* **Node.js** (versão 18 ou superior recomendada)
* **npm** ou **yarn**

### Passo a passo

1. **Instale as dependências:**

```bash
npm install
```

2. **Inicie o servidor de desenvolvimento:**

```bash
npm run dev
```

3. **Acesse no navegador:**
   Abra o endereço exibido no terminal (geralmente `http://localhost:5173`).

4. **Gerar build de produção:**

```bash
npm run build
```

## Boas Práticas de Atendimento

* Antes de iniciar o cálculo de um cliente real, utilize **`Limpar campos`** para evitar que valores de exemplo permaneçam preenchidos por engano.
* No módulo **Upgrade de Plano**, confirme a renovação de fidelidade contratual de 12 meses e solicite a documentação do titular antes de gerar o link de assinatura, conforme indicado no script automático.
* Utilize o botão **`Como funciona o cálculo`** sempre que precisar explicar detalhadamente a composição do valor ao assinante ou treinar novos colaboradores do SAC.
