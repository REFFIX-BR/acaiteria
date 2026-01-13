# Guia de Deploy - Plataforma Açaiteria

Este guia explica como fazer o deploy da aplicação em Docker Swarm.

## 📋 Pré-requisitos

- Docker Engine 20.10+
- Docker Swarm inicializado
- Traefik configurado como reverse proxy
- Rede Docker criada: `acaiteria`
- PostgreSQL configurado (externo ou em outro serviço)

## 🚀 Passo a Passo

### 1. Criar a rede Docker (se não existir)

A rede `reffix` já deve existir no seu ambiente. Se não existir:

```bash
docker network create --driver overlay reffix
```

### 2. Build das imagens

```bash
# Build do backend
cd backend
docker build -t acaiteria-backend:latest .

# Build do frontend
cd ..
docker build -t acaiteria-frontend:latest .

# Ou se estiver usando um registry
docker build -t registry.example.com/acaiteria-backend:latest ./backend
docker build -t registry.example.com/acaiteria-frontend:latest .
docker push registry.example.com/acaiteria-backend:latest
docker push registry.example.com/acaiteria-frontend:latest
```

### 3. Configurar variáveis de ambiente

Configure as seguintes variáveis de ambiente (via arquivo `.env` ou export):

- `DOMAIN` - Domínio da aplicação (padrão: gestaoloja.reffix.com.br)
- `DATABASE_URL` - URL completa de conexão do PostgreSQL
  - Formato: `postgresql://plataformacaiteria:senha@postgres_postgres:5432/acaiteria`
  - O host `postgres_postgres` é o nome do serviço PostgreSQL no Docker Swarm
- `JWT_SECRET` - Chave secreta para JWT (use uma chave forte em produção)
- `FRONTEND_URL` - URL do frontend (padrão: https://gestaoloja.reffix.com.br)
- `VITE_API_URL` - URL da API backend (padrão: https://api.gestaoloja.reffix.com.br)

### 4. Deploy no Swarm

```bash
# Carregar variáveis de ambiente
export DOMAIN=gestaoloja.reffix.com.br
export DATABASE_URL="postgresql://plataformacaiteria:senha@postgres_postgres:5432/acaiteria"
export JWT_SECRET="sua-chave-secreta-forte-aqui"
export FRONTEND_URL="https://gestaoloja.reffix.com.br"
export VITE_API_URL="https://api.gestaoloja.reffix.com.br"

# Deploy do stack
docker stack deploy -c docker-compose.yml acaiteria
```

### 5. Verificar o deploy

```bash
# Ver serviços
docker service ls

# Ver logs do backend
docker service logs acaiteria_acaiteria-backend -f

# Ver logs do frontend
docker service logs acaiteria_acaiteria-frontend -f

# Ver status dos serviços
docker service ps acaiteria_acaiteria-backend
docker service ps acaiteria_acaiteria-frontend

# Testar API
curl https://api.gestaoloja.reffix.com.br/health
```

## 🔄 Atualizações

### Atualizar a aplicação

```bash
# 1. Build novas imagens
docker build -t acaiteria-backend:latest ./backend
docker build -t acaiteria-frontend:latest .

# 2. Atualizar os serviços
docker service update --image acaiteria-backend:latest acaiteria_acaiteria-backend
docker service update --image acaiteria-frontend:latest acaiteria_acaiteria-frontend
```

### Rollback

```bash
docker service rollback acaiteria_acaiteria-frontend
```

## 📊 Monitoramento

### Healthcheck

Ambas as aplicações expõem endpoints de healthcheck:

```bash
# Frontend
curl https://gestaoloja.reffix.com.br/health

# Backend
curl https://api.gestaoloja.reffix.com.br/health
```

### Logs

```bash
# Logs em tempo real
docker service logs -f acaiteria_acaiteria-frontend

# Últimas 100 linhas
docker service logs --tail 100 acaiteria_acaiteria-frontend
```

## 🗄️ Banco de Dados

O PostgreSQL deve ser configurado externamente. Para inicializar o schema:

```bash
# Executar schema no banco PostgreSQL
psql -h postgres_postgres -U plataformacaiteria -d acaiteria < database/schema.sql

# Ou se tiver seeds
psql -h postgres_postgres -U plataformacaiteria -d acaiteria < database/seeds.sql
```

## 🔧 Troubleshooting

### Verificar conectividade

```bash
# Verificar se os serviços estão rodando
docker service ps acaiteria_acaiteria-frontend
docker service ps acaiteria_postgres

# Verificar rede
docker network inspect reffix

# Verificar logs de erro
docker service logs acaiteria_acaiteria-frontend --tail 50
```
```

### Reiniciar serviços

```bash
# Reiniciar frontend
docker service update --force acaiteria_acaiteria-frontend
```

### Escalar serviços

```bash
# Aumentar réplicas do frontend
docker service scale acaiteria_acaiteria-frontend=3
```

## 🛡️ Segurança

### Senhas fortes

- Use senhas fortes para o PostgreSQL
- Não commite o arquivo `.docker.env`
- Use secrets do Docker Swarm para dados sensíveis

### Secrets do Docker Swarm

```bash
# Criar secret
echo "senha_super_secreta" | docker secret create postgres_password -

# Usar no docker-compose
# (adicionar secrets: section no serviço postgres)
```

## 📝 Notas

- **Backend**: API REST Node.js/Express na porta 3000
- **Frontend**: React/Vite servido por Nginx na porta 80
- **Database**: PostgreSQL (externo, conecta via `postgres_postgres`)
- O Traefik deve estar configurado com Let's Encrypt
- Backend e Frontend rodam com 2 réplicas cada para alta disponibilidade
- Healthchecks são executados a cada 30 segundos
- Backend expõe API em `api.${DOMAIN}` e Frontend em `${DOMAIN}`

