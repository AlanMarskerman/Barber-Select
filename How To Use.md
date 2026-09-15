# Guia de execução — Barber-Select

Este documento explica como preparar e iniciar o projeto **Barber-Select** localmente. Execute todos os comandos no terminal, a partir da pasta raiz do projeto — a mesma pasta que contém o arquivo `package.json`.

## 1. Pré-requisitos

Antes de iniciar, instale os seguintes itens no computador:

- [Node.js](https://nodejs.org/) — recomenda-se uma versão LTS.
- npm — é instalado automaticamente junto com o Node.js.
- Git — necessário somente se você for clonar o projeto a partir do GitHub.
- Um navegador atualizado, como Google Chrome, Microsoft Edge ou Firefox.

Para verificar se Node.js e npm estão instalados, abra um terminal e execute:

```bash
node -v
npm -v
```

Os dois comandos devem retornar números de versão. Caso apareça uma mensagem como `node is not recognized` ou `command not found`, instale ou reinstale o Node.js e abra um novo terminal.

## 2. Abrir a pasta correta

No VS Code:

1. Abra a pasta do projeto em **File > Open Folder**.
2. Confirme que existe um arquivo chamado `package.json` na raiz.
3. Abra o terminal integrado em **Terminal > New Terminal** ou com `Ctrl + '`.

O terminal deve apontar para a raiz do projeto. Exemplo:

```text
C:\Users\seu-usuario\Desktop\Barber-Select>
```

ou:

```text
.../Barber-Select $
```

Se você estiver em outra pasta, entre na pasta do projeto com `cd`:

```bash
cd caminho/para/Barber-Select
```

No Windows, por exemplo:

```powershell
cd "C:\Users\seu-usuario\Desktop\Barber-Select"
```

## 3. Instalar as dependências

Com o terminal aberto na raiz do projeto, execute:

```bash
npm install
```

Esse comando lê o arquivo `package.json`, baixa as bibliotecas necessárias e cria a pasta `node_modules`.

Execute `npm install` quando:

- Você está executando o projeto pela primeira vez.
- Acabou de clonar ou baixar o projeto.
- O `package.json` ou `package-lock.json` foi alterado.
- Uma dependência nova foi adicionada, por exemplo com `npm install helmet`.

Não envie a pasta `node_modules` para o GitHub. Ela deve estar no arquivo `.gitignore`.

## 4. Variáveis de ambiente

Se o projeto usar variáveis de ambiente, crie ou confira o arquivo `.env` na raiz, no mesmo nível do `package.json`.

Exemplo de estrutura:

```text
Barber-Select/
├── .env
├── package.json
├── package-lock.json
├── server.js
├── public/
└── node_modules/
```

Um exemplo de `.env` pode ser:

```env
PORT=3000
JWT_SECRET=troque-por-uma-chave-forte-e-secreta
```

Use os nomes de variáveis efetivamente esperados pelo seu `server.js`. Nunca envie o `.env` ao GitHub, pois ele pode conter chaves, senhas, tokens ou dados de banco de dados.

No `.gitignore`, mantenha pelo menos:

```gitignore
node_modules/
.env
.env.*
!.env.example
```

Se existir um arquivo `.env.example`, use-o como modelo:

```bash
cp .env.example .env
```

No PowerShell do Windows, use:

```powershell
Copy-Item .env.example .env
```

Depois, edite o `.env` com os valores locais necessários.

## 5. Iniciar o servidor

Depois de instalar as dependências, execute na raiz do projeto:

```bash
npm start
```

Esse comando executa o script `start` definido no `package.json`. Em geral, ele inicia o arquivo principal do backend, como `server.js`.

Se o terminal mostrar uma mensagem semelhante a esta, o servidor está ativo:

```text
Servidor rodando em http://localhost:3000
```

Abra o navegador e acesse:

```text
http://localhost:3000
```

Não abra os arquivos HTML diretamente com duplo clique ou por `file:///...`. Use sempre a URL `http://localhost:...`, pois o frontend depende do servidor Node.js para arquivos estáticos, autenticação, APIs e cabeçalhos de segurança como CSP/Helmet.

## 6. Modo de desenvolvimento

Caso o projeto tenha um script de desenvolvimento configurado no `package.json`, você pode usar:

```bash
npm run dev
```

Normalmente esse comando usa uma ferramenta como `nodemon` para reiniciar o servidor após alterações nos arquivos.

Para descobrir quais comandos existem no projeto, execute:

```bash
npm run
```

Use `npm run dev` apenas se ele aparecer na lista de scripts disponíveis.

## 7. Acessar as páginas

Com o servidor em execução, as páginas devem ser abertas pelo navegador usando URLs locais. Alguns exemplos, conforme a estrutura do projeto:

```text
http://localhost:3000/
http://localhost:3000/client/profile.html
http://localhost:3000/client/request.html
http://localhost:3000/client/settings.html
http://localhost:3000/staff/settings.html
```

As páginas protegidas devem ser acessadas depois do login, porque usam a sessão/token armazenado no navegador e verificam o perfil com `requireAuth()`.

## 8. Parar o servidor

Para encerrar o servidor Node.js, volte ao terminal onde `npm start` está rodando e pressione:

```text
Ctrl + C
```

Se o terminal perguntar se deseja encerrar o processo, confirme com `Y` ou `S`, conforme o idioma do sistema.

## 9. Fluxo diário recomendado

Para trabalhar no projeto no dia a dia:

1. Abra a pasta **Barber-Select** no VS Code.
2. Abra um terminal integrado na raiz do projeto.
3. Execute `npm install` somente quando necessário.
4. Execute `npm start`.
5. Abra `http://localhost:3000` no navegador.
6. Faça as alterações no código.
7. Atualize a página no navegador.
8. Se o servidor não reiniciar automaticamente, pare-o com `Ctrl + C` e execute `npm start` novamente.

## 10. Solução de problemas

### `npm` ou `node` não é reconhecido

O Node.js não está instalado corretamente ou o terminal antigo não reconheceu a instalação.

1. Instale a versão LTS do Node.js.
2. Feche e abra novamente o VS Code.
3. Abra um novo terminal.
4. Teste novamente:

```bash
node -v
npm -v
```

### Erro: `Cannot find module`

As dependências não foram instaladas ou estão inconsistentes. Na raiz do projeto, execute:

```bash
npm install
```

Se o problema persistir, remova `node_modules` e instale novamente.

No macOS/Linux:

```bash
rm -rf node_modules package-lock.json
npm install
```

No PowerShell do Windows:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

Remova o `package-lock.json` apenas se a reinstalação normal não resolver o problema, pois ele registra versões específicas das dependências.

### Porta já está em uso

Se aparecer um erro como `EADDRINUSE`, outra aplicação já está usando a porta definida no projeto, normalmente `3000`.

Primeiro, encerre outros terminais que possam estar executando o servidor. Alternativamente, altere a variável `PORT` no arquivo `.env`, por exemplo:

```env
PORT=3001
```

Depois reinicie o servidor:

```bash
npm start
```

Acesse então:

```text
http://localhost:3001
```

### Erro de CSP ou scripts bloqueados

O projeto usa Helmet/CSP para impedir scripts inline. Não adicione JavaScript diretamente dentro de blocos como:

```html
<script>
  // código JavaScript inline
</script>
```

Crie um arquivo externo dentro de `public/js/` e carregue-o no HTML:

```html
<script src="/js/nome-do-arquivo.js" defer></script>
```

Mantenha também os caminhos dos arquivos estáticos como caminhos absolutos:

```html
<link rel="stylesheet" href="/styles.css" />
<script src="/js/shared.js" defer></script>
```

### Arquivo `.env` não parece funcionar

Confirme os seguintes pontos:

- O arquivo se chama exatamente `.env`.
- Ele está na raiz do projeto, perto do `package.json`.
- O backend usa `dotenv` ou outro mecanismo para carregar as variáveis.
- Você reiniciou o servidor após alterar o `.env`.
- O `.env` não foi enviado ao repositório remoto.

O aviso do VS Code sobre `python.terminal.useEnvFile` é relacionado à extensão Python e normalmente não impede um projeto Node.js iniciado com `npm start` de funcionar.

## 11. Comandos essenciais

Execute na raiz do projeto:

```bash
npm install
npm start
```

Opcionalmente, se existir no `package.json`:

```bash
npm run dev
```

Para encerrar o servidor:

```text
Ctrl + C
```
