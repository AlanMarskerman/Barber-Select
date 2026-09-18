# Alterações da Dashboard

## Arquivos desta pasta
- `dashboard.css`: estilos da nova sidebar e da Dashboard.
- `barber-select-logo.png`: cópia do logo usado pela nova sidebar.
- `ALTERACOES.md`: este resumo.

## Alterações que precisaram ficar nos arquivos originais
As alterações de HTML/JavaScript estão marcadas no próprio código com comentários `DASHBOARD - INÍCIO DA ALTERAÇÃO` e `DASHBOARD - FIM DA ALTERAÇÃO`.

## Arquivos que não aceitam comentários
`package.json` e `package-lock.json` não aceitam comentários. A versão integrada altera os scripts do `package.json` para usar `start-all.js` e iniciar a integração. Por isso essa mudança é documentada aqui, sem inserir comentário inválido no JSON.

## Cadastro MySQL do João
`features/cadastro-mysql/db.js`, `register-server.js` e `schema.sql` foram mantidos iguais ao projeto original do João. Não foram reorganizados como parte da Dashboard.

## Observação
Arquivos `.env`, `.env.register`, `.git` e `node_modules` não estão incluídos no pacote final.
