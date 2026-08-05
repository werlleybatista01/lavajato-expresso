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
- Esta arquitetura é adequada para uso individual offline. Uso multiusuário exige API autenticada, banco central e política de backup.
