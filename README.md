# Lava Jato Expresso ERP

Sistema web estático, offline-first, para controle financeiro e operacional de lava-jato. Os dados ficam no navegador por meio do IndexedDB; não existe servidor ou banco remoto nesta versão.

## Estrutura

```text
.
├── index.html          # Interface e modais
├── css/
│   └── style.css       # Estilos próprios
├── js/
│   ├── app.js          # Inicialização, navegação e tema
│   ├── database.js     # Persistência IndexedDB
│   ├── utils.js        # Utilitários compartilhados
│   └── *.js            # Módulos de domínio
└── scripts/
    └── verify.mjs      # Validação de assets e sintaxe
```

## Desenvolvimento

Requer Node.js 20 ou superior somente para as verificações locais.

```bash
npm run check
npm run serve
```

Não abra o HTML diretamente por `file://`; use um servidor HTTP local para reproduzir o comportamento do GitHub Pages.

## Publicação

O projeto é compatível com GitHub Pages usando a branch `main` e a pasta raiz (`/`). Os caminhos de CSS e JavaScript são relativos para funcionar no subdiretório `/lavajato-expresso/`.

## Dados e segurança

- Os registros são armazenados somente no navegador e não sincronizam entre dispositivos.
- Limpar os dados do navegador apaga a base local.
- Faça exportações periódicas na área de relatórios.
- Funcionários, serviços e itens de estoque são arquivados em vez de apagados, preservando vínculos históricos.
- Receitas e despesas são estornadas, mantendo trilha de auditoria no backup.
- Indicadores de lucro, despesas, ticket e comissões usam o mês corrente; receita anual e acumulada são calculadas separadamente.
- Salários já lançados em despesas não são apagados ao desativar um funcionário. A folha projetada da equipe ativa é recalculada separadamente da contabilidade realizada.
- Esta arquitetura é adequada para produção individual offline em um único navegador. Uso multiusuário exige API autenticada, banco central, controle de acesso, logs no servidor e política de backup testada.

## Validação antes da publicação

`npm run check` valida referências de assets, sintaxe dos módulos, regras financeiras, datas locais, comissões, precificação, transações de estoque e um fluxo de interface simulado.
