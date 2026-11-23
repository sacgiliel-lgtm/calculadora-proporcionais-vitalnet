[readme_md.md](https://github.com/user-attachments/files/35298983/readme_md.md)
# Calculadora de Proporcionais — Vital Net Telecom (Portal SAC)

Aplicação web interna desenvolvida para a equipe de **Atendimento ao Cliente (SAC) & Cobrança** da **Vital Net Telecom**, projetada para calcular valores proporcionais com precisão, exibir a memória de cálculo detalhada e gerar mensagens padronizadas prontas para envio ao assinante (com formatação otimizada para WhatsApp).

---

## Sumário

- [Visão Geral](#-visão-geral)
- [Módulos e Regras de Cálculo](#-módulos-e-regras-de-cálculo)
  - [1. Reativação](#1-reativação)
  - [2. Troca de Vencimento](#2-troca-de-vencimento)
  - [3. Upgrade de Plano](#3-upgrade-de-plano)
- [Funcionalidades da Interface](#-funcionalidades-da-interface)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Executar Localmente](#-como-executar-localmente)
- [Boas Práticas de Atendimento](#-boas-práticas-de-atendimento)

---

## Visão Geral

Durante atendimentos de regularização financeira, alteração cadastral de vencimento ou mudança de plano, os operadores do SAC precisam calcular cobranças proporcionais baseadas em períodos exatos de utilização.

A **Calculadora de Proporcionais** automatiza esse processo em tempo real, evitando erros manuais de contagem de dias ou arredondamento, além de padronizar a comunicação escrita com o cliente.

## Premissas Gerais de Cálculo

* **Base mensal:** Todas as proporções utilizam a divisão por **30 dias** (`valor / 30`) para obter o valor diário.
* **Precisão decimal:** Os cálculos intermediários são arredondados para **2 casas decimais** (`Number(valor.toFixed(2))`).
* **Arredondamento comercial:** Os valores proporcionais são arredondados para o **múltiplo de R$ 5,00 mais próximo** (`Math.round(valor / 5) * 5`).
* **Diferença de dias:** O intervalo entre datas é calculado em dias corridos (`86.400.000 ms` por dia).

---

## Módulos e Regras de Cálculo

### 1. Reativação
Utilizado para regularizar e reativar conexões suspensas por inadimplência, somando os dias utilizados após o vencimento até o bloqueio efetivo aos dias futuros da reativação até o próximo vencimento.

* **Entradas obrigatórias:**
  * Valor da mensalidade ($M$)
  * Vencimento do boleto considerado ($D_{\text{venc}}$)
  * Data efetiva do bloqueio ($D_{\text{bloq}}$) — considerando finais de semana e feriados em que a conexão permaneceu ativa
  * Data da reativação ($D_{\text{reat}}$)
  * Próximo vencimento ($D_{\text{prox}}$)

* **Fórmulas aplicadas:**
  1. **Valor diário:**
     $$V_{\text{dia}} = \frac{M}{30}$$
  2. **Dias em atraso (uso pós-vencimento):**
     $$\text{Dias}_{\text{uso}} = \max\left(0,\ D_{\text{bloq}} - D_{\text{venc}}\right)$$
     $$V_{\text{uso}} = \text{Dias}_{\text{uso}} \times V_{\text{dia}}$$
  3. **Dias futuros (contagem inclusiva da reativação ao próximo vencimento):**
     $$\text{Dias}_{\text{fut}} = \max\left(0,\ (D_{\text{prox}} - D_{\text{reat}}) + 1\right)$$
     $$V_{\text{fut}} = \text{Dias}_{\text{fut}} \times V_{\text{dia}}$$
  4. **Total a pagar:**
     $$V_{\text{bruto}} = V_{\text{uso}} + V_{\text{fut}}$$
     $$\text{Total} = \text{round}_5(V_{\text{bruto}})$$

---

### 2. Troca de Vencimento
Utilizado quando o assinante solicita alteração na data de vencimento da fatura e há um intervalo adicional de dias a ser coberto entre o vencimento atual e o novo vencimento.

* **Entradas obrigatórias:**
  * Valor da mensalidade ($M$)
  * Vencimento atual ($D_{\text{atual}}$)
  * Novo vencimento ($D_{\text{novo}}$)

* **Fórmulas aplicadas:**
  1. **Valor diário:**
     $$V_{\text{dia}} = \frac{M}{30}$$
  2. **Dias adicionais:**
     $$\text{Dias}_{\text{adic}} = \max\left(0,\ D_{\text{novo}} - D_{\text{atual}}\right)$$
  3. **Proporcional bruto e arredondado:**
     $$V_{\text{bruto}} = V_{\text{dia}} \times \text{Dias}_{\text{adic}}$$
     $$V_{\text{prop}} = \text{round}_5(V_{\text{bruto}})$$
  4. **Total do próximo pagamento (inclui taxa fixa de emissão de boleto de $\text{R\$ } 1,20$):**
     $$\text{Total} = M + V_{\text{prop}} + 1,20$$

---

### 3. Upgrade de Plano
Utilizado na migração para um plano superior (modelo pré-pago), cobrando proporcionalmente apenas a diferença entre os planos até o próximo vencimento, somada à nova mensalidade.

* **Entradas:**
  * Mensalidade atual ($M_{\text{atual}}$) — *obrigatório*
  * Nova mensalidade ($M_{\text{nova}}$) — *obrigatório (deve ser maior que a atual)*
  * Data da troca do equipamento ($D_{\text{equip}}$) — *opcional (se omitida, assume automaticamente a data atual)*
  * Próximo vencimento ($D_{\text{venc}}$) — *obrigatório*

* **Fórmulas aplicadas:**
  1. **Diferença mensal e valor diário:**
     $$\Delta M = M_{\text{nova}} - M_{\text{atual}}$$
     $$V_{\text{dia}} = \frac{\Delta M}{30}$$
  2. **Dias restantes até o próximo vencimento:**
     $$\text{Dias}_{\text{rest}} = \max\left(0,\ D_{\text{venc}} - D_{\text{inicio}}\right)$$
     *(onde $D_{\text{inicio}}$ é $D_{\text{equip}}$ ou a data de hoje)*
  3. **Proporcional bruto e arredondado:**
     $$V_{\text{bruto}} = V_{\text{dia}} \times \text{Dias}_{\text{rest}}$$
     $$V_{\text{prop}} = \text{round}_5(V_{\text{bruto}})$$
  4. **Total da próxima cobrança (única vez):**
     $$\text{Total} = M_{\text{nova}} + V_{\text{prop}}$$

---

## Funcionalidades da Interface

- **Cálculo em Tempo Real:** Atualização instantânea da memória de cálculo e do script de atendimento conforme os campos são preenchidos.
- **Identificação Clara de Dados de Exemplo:**
  - Os campos carregam inicialmente com valores de exemplo sinalizados pela badge **`EXEMPLO`** e por um banner informativo no topo do formulário.
  - Assim que o operador edita um campo, o marcador de exemplo daquele campo desaparece automaticamente.
  - Botão **`Limpar campos`** para zerar rapidamente o formulário ao iniciar um novo atendimento e **`Restaurar exemplo`** para voltar aos valores demonstrativos.
- **Validação Visual de Campos Obrigatórios:** Campos obrigatórios vazios recebem destaque em vermelho, badge **`Campo vazio`** e mensagem orientativa, bloqueando o salvamento no histórico até que os dados estejam válidos.
- **Modal Explicativo (`Como funciona o cálculo`):** Janela centralizada sobreposta à tela (fechável pelo botão `×`, clique externo ou tecla `Esc`) que explica passo a passo a lógica matemática utilizando os valores reais da simulação ativa.
- **Script Pronto com Cópia Rápida:** Gera automaticamente o texto explicativo completo para o cliente com botão **`Copiar mensagem`** e feedback visual.
- **Histórico Local Persistente:** Armazena até 60 simulações salvas no `localStorage` do navegador (`vitalnet-proportional-history`), permitindo consulta rápida e limpeza completa quando necessário.
- **Design Responsivo:** Adaptado para desktops e dispositivos móveis utilizados pela equipe de atendimento.

---

## Tecnologias Utilizadas

- **React 18** + **TypeScript**
- **Vite** (ambiente de desenvolvimento e empacotamento)
- **CSS3 Custom Properties** (identidade visual oficial Vital Net Telecom, tipografia *Plus Jakarta Sans* e *Inter*)
- **Web Storage API (`localStorage`)** e **Clipboard API (`navigator.clipboard`)**

---

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

---

## Como Executar Localmente

### Pré-requisitos
- **Node.js** (versão 18 ou superior recomendada)
- **npm** ou **yarn**

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

---

## Boas Práticas de Atendimento

- Antes de iniciar o cálculo de um cliente real, utilize **`Limpar campos`** para evitar que valores de exemplo permaneçam preenchidos por engano.
- No módulo **Upgrade de Plano**, confirme a renovação de fidelidade contratual de 12 meses e solicite a documentação do titular antes de gerar o link de assinatura, conforme indicado no script automático.
- Utilize o botão **`Como funciona o cálculo`** sempre que precisar explicar detalhadamente a composição do valor ao assinante ou treinar novos colaboradores do SAC.
