# Melhorias de Segurança JWT - Barber-Select

## Resumo das Melhorias Implementadas

### 1. **JWT com Issuer e Audience**
- **Issuer**: `barber-select-api`
- **Audience**: `barber-select-app`
- Validação obrigatória em todas as verificações de token
- Previne uso de tokens de outras aplicações

### 2. **Sistema de Refresh Token**
- **Access Token**: 15 minutos de validade
- **Refresh Token**: 7 dias de validade
- Renovação automática no frontend quando o access token expira
- Endpoint `/auth/refresh` para renovação segura

### 3. **Sessões Vinculadas a Usuários Específicos**
- Cada usuário possui um `userId` único gerado por hash (`role:identity`)
- Token não contém apenas `role`, mas também `userId` e `identity`
- Dois colaboradores com credenciais diferentes terão `userId` distintos
- Sessões são rastreadas no servidor via Map `activeSessions`

### 4. **Invalidação Imediata de Tokens (Blacklist)**
- Token blacklist implementada em memória
- Logout remove a sessão ativa e adiciona o token à blacklist
- Token na blacklist é rejeitado mesmo que ainda não tenha expirado
- Limpeza automática periódica da blacklist

### 5. **Gerenciamento de Sessões Ativas**
- Servidor mantém registro de todas as sessões ativas
- Cada sessão contém:
  - `refreshToken`: para validação
  - `createdAt`: timestamp de criação
  - `lastUsed`: timestamp de último acesso
  - `identity`: identificação do usuário
  - `role`: papel do usuário
- Limpeza automática de sessões antigas (>7 dias sem uso)

## Endpoints da API

### Login
**POST** `/auth/login/cliente` | `/auth/login/colaborador` | `/auth/login/admin`

**Request:**
```json
{
  "identity": "usuario",
  "password": "senha"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "role": "client",
  "userId": "abc123...",
  "identity": "usuario",
  "expiresIn": 900
}
```

### Refresh Token
**POST** `/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "expiresIn": 900
}
```

### Logout
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "message": "Logout realizado com sucesso."
}
```

### Verificar Sessão
**GET** `/auth/session`

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "userId": "abc123...",
  "role": "client",
  "identity": "usuario",
  "sessionCreated": 1695513600000,
  "lastUsed": 1695517200000
}
```

## Estrutura do JWT

### Access Token
```json
{
  "userId": "abc123...",
  "role": "client",
  "identity": "usuario",
  "type": "access",
  "iat": 1695513600,
  "exp": 1695514500,
  "iss": "barber-select-api",
  "aud": "barber-select-app"
}
```

### Refresh Token
```json
{
  "userId": "abc123...",
  "role": "client",
  "identity": "usuario",
  "type": "refresh",
  "jti": "unique-token-id",
  "iat": 1695513600,
  "exp": 1696118400,
  "iss": "barber-select-api",
  "aud": "barber-select-app"
}
```

## Frontend - Mudanças no SessionStorage

### Antes:
```javascript
sessionStorage.getItem("token")
sessionStorage.getItem("role")
```

### Agora:
```javascript
sessionStorage.getItem("accessToken")
sessionStorage.getItem("refreshToken")
sessionStorage.getItem("role")
sessionStorage.getItem("userId")
sessionStorage.getItem("identity")
```

## Fluxo de Autenticação

### 1. Login
```
Cliente → POST /auth/login → Servidor
↓
Servidor valida credenciais
↓
Servidor gera userId hash(role:identity)
↓
Servidor cria accessToken + refreshToken
↓
Servidor registra sessão ativa
↓
Retorna tokens para cliente
↓
Cliente salva no sessionStorage
```

### 2. Requisição Autenticada
```
Cliente → GET /api/resource + Authorization: Bearer {accessToken}
↓
Servidor verifica token na blacklist
↓
Servidor valida JWT (issuer, audience, expiração)
↓
Servidor verifica se sessão existe em activeSessions
↓
Servidor atualiza lastUsed
↓
Servidor processa requisição
```

### 3. Token Expirado (Refresh Automático)
```
Cliente → GET /api/resource + Authorization: Bearer {accessToken expirado}
↓
Servidor retorna 401 + code: "TOKEN_EXPIRED"
↓
Cliente detecta TOKEN_EXPIRED
↓
Cliente → POST /auth/refresh + refreshToken
↓
Servidor valida refreshToken
↓
Servidor verifica se refreshToken corresponde à sessão ativa
↓
Servidor gera novo accessToken
↓
Cliente salva novo accessToken
↓
Cliente refaz requisição original com novo token
```

### 4. Logout
```
Cliente → POST /auth/logout + Authorization: Bearer {accessToken}
↓
Servidor valida token
↓
Servidor remove sessão de activeSessions
↓
Servidor adiciona token à blacklist
↓
Cliente limpa sessionStorage
↓
Cliente redireciona para login
```

## Funções Auxiliares no Frontend

### `authenticatedFetch(url, options)`
Wrapper para `fetch` que:
- Adiciona automaticamente o header `Authorization`
- Detecta expiração de token
- Renova automaticamente usando refresh token
- Refaz a requisição com novo token
- Redireciona para login se refresh falhar

**Exemplo de uso:**
```javascript
const response = await authenticatedFetch('/api/admin/exemplo-protegido', {
  method: 'GET'
});

if (response) {
  const data = await response.json();
  console.log(data);
}
```

### `refreshAccessToken()`
Renova o access token usando o refresh token.

**Retorna:**
- `true`: token renovado com sucesso
- `false`: falha na renovação (refresh expirado ou inválido)

### `logout()`
Realiza logout completo:
1. Chama `/auth/logout` no servidor
2. Limpa sessionStorage
3. Redireciona para página inicial

## Variáveis de Ambiente (.env)

```env
# Segredos JWT (usar chaves fortes e diferentes)
JWT_SECRET=sua_chave_secreta_muito_forte_aqui_min_32_chars
JWT_REFRESH_SECRET=outra_chave_secreta_diferente_para_refresh

# Credenciais dos usuários
CLIENT_LOGIN=cliente
CLIENT_PASSWORD=senha_segura_cliente

STAFF_LOGIN=colaborador
STAFF_PASSWORD=senha_segura_colaborador

ADMIN_LOGIN=admin
ADMIN_PASSWORD=senha_segura_admin
```

## Considerações de Produção

### Armazenamento Persistente
O código atual usa armazenamento em memória (Map e Set). Para produção:

1. **Redis** para sessões ativas e blacklist:
```javascript
// activeSessions → Redis Hash
// tokenBlacklist → Redis Set com TTL
```

2. **Banco de dados** para sessões:
```sql
CREATE TABLE active_sessions (
  user_id VARCHAR(16) PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  last_used TIMESTAMP NOT NULL,
  identity VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL
);

CREATE INDEX idx_last_used ON active_sessions(last_used);
```

### Segurança Adicional
- Implementar rate limiting por userId
- Adicionar detecção de múltiplas sessões simultâneas
- Implementar rotação de refresh tokens
- Adicionar logs de auditoria
- Implementar device fingerprinting
- Considerar refresh token rotation (one-time use)

## Testando as Melhorias

### 1. Login
```bash
curl -X POST http://localhost:3000/auth/login/cliente \
  -H "Content-Type: application/json" \
  -d '{"identity": "cliente", "password": "123456"}'
```

### 2. Acessar Recurso Protegido
```bash
curl -X GET http://localhost:3000/api/admin/exemplo-protegido \
  -H "Authorization: Bearer {accessToken}"
```

### 3. Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "{refreshToken}"}'
```

### 4. Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer {accessToken}"
```

### 5. Verificar Token na Blacklist
```bash
# Após logout, tentar acessar novamente com o mesmo token
curl -X GET http://localhost:3000/api/admin/exemplo-protegido \
  -H "Authorization: Bearer {accessToken_usado_no_logout}"
# Deve retornar: {"error": "Sessão encerrada. Faça login novamente."}
```

## Benefícios Implementados

✅ **Issuer/Audience**: Tokens vinculados à aplicação específica  
✅ **Refresh Token**: Renovação automática sem re-login  
✅ **User-Specific**: Cada usuário tem sessão única identificada  
✅ **Blacklist**: Logout invalida token imediatamente  
✅ **Session Tracking**: Servidor rastreia todas as sessões ativas  
✅ **Auto-Cleanup**: Limpeza automática de sessões e tokens antigos  
✅ **Transparent UX**: Refresh automático invisível para o usuário
