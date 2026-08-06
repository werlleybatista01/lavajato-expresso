# Lava Jato Expresso ERP

ERP web multiusuário para operação, finanças, equipe, serviços e estoque. A versão 2 substitui a persistência local em IndexedDB por uma arquitetura online com React, TypeScript, PostgreSQL e Supabase Auth.

## Arquitetura

- React 19 + TypeScript + Vite para a aplicação web responsiva.
- TanStack Query para cache, atualização e estados de rede.
- Supabase Auth para sessões e identidade de usuário.
- PostgreSQL como fonte central dos dados.
- Row Level Security em todas as tabelas públicas, isolando cada organização.
- Papéis `owner`, `admin`, `operator` e `viewer`.
- Movimentação de estoque atômica por RPC e trilha de auditoria no banco.
- Receitas preservam nomes, custos e comissões como snapshots históricos.
- Migrações versionadas em `supabase/migrations`.

## Desenvolvimento

```bash
cp .env.example .env.local
npm install
npm run dev
```

Preencha `.env.local` somente com a URL e a chave **publicável** do projeto. Nunca use a chave secreta ou `service_role` no navegador.

## Qualidade

```bash
npm run test
npm run build
npm run check
```

`npm run check` é a barreira obrigatória de publicação: testa as regras financeiras e compila o bundle de produção com checagem estrita de tipos.

## Regras de integridade

- Exclusões operacionais usam arquivamento ou estorno; lançamentos históricos não são recalculados a partir do cadastro atual.
- Um funcionário arquivado deixa a equipe ativa, mas sua comissão congelada continua no atendimento original.
- O banco impede vínculos entre registros de organizações diferentes.
- O último proprietário ativo não pode ser removido.
- Entradas e saídas de estoque são serializadas e não aceitam saldo negativo.
- Toda escrita passa por RLS e as principais entidades mantêm auditoria de antes/depois.

## Produção

O frontend pode ser servido pelo GitHub Pages; dados, autenticação e autorização ficam no Supabase na região `sa-east-1`. Antes de promover uma versão, execute testes, advisors de segurança/desempenho e valide login, permissões de cada papel, estorno, arquivamento e estoque em homologação.

Backups e recuperação devem seguir a política do plano contratado no Supabase. Para operação crítica, habilite PITR e teste restauração periodicamente.
