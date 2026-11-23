# Calculadora de Proporcionais — Vital Net

Aplicação web para apoiar o SAC nos cálculos de reativação, troca de vencimento e upgrade.

## Tecnologias
- React + TypeScript + Vite
- Cálculos executados no navegador
- Histórico salvo localmente no dispositivo (localStorage)

## Desenvolvimento
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Publicação no Render
Este projeto é um site estático. No Render, crie um **Static Site** conectado a este repositório:
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

O arquivo `render.yaml` contém a configuração equivalente para Blueprint.

## Regras implementadas
- **Reativação:** mensalidade ÷ 30; calcula os dias posteriores ao vencimento até a data efetiva do bloqueio e os dias do dia da reativação até o próximo vencimento (contagem inclusiva no período futuro); soma os proporcionais e arredonda o total para o múltiplo de R$ 5,00 mais próximo.
- **Troca de vencimento:** mensalidade ÷ 30; multiplica pela diferença entre a data do vencimento antigo e a nova data; arredonda o proporcional para o múltiplo de R$ 5,00 mais próximo; adiciona R$ 1,20 de taxa de geração de boleto. O próximo pagamento soma mensalidade + proporcional arredondado + taxa.
- **Upgrade:** diferença entre mensalidade nova e antiga ÷ 30; multiplica pelos dias entre a data da troca do equipamento (ou hoje, se não informada) e o próximo vencimento; arredonda o proporcional para o múltiplo de R$ 5,00 mais próximo. O proporcional é somado à nova mensalidade na próxima cobrança.

> Confira sempre datas, valores e critérios com o procedimento interno vigente antes de efetivar cobranças. O sistema é uma ferramenta de apoio ao atendimento.