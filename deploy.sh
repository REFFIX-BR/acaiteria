#!/bin/bash

# Script de Deploy - Plataforma Açaiteria
# Remove a stack existente e faz deploy completo

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Nome da stack
STACK_NAME="acaiteria"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy - Plataforma Açaiteria${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar se está no Docker Swarm
if ! docker info | grep -q "Swarm: active"; then
    echo -e "${RED}❌ Docker Swarm não está ativo!${NC}"
    echo -e "${YELLOW}Execute: docker swarm init${NC}"
    exit 1
fi

# Verificar se a rede existe
echo -e "${YELLOW}📡 Verificando rede 'reffix'...${NC}"
if ! docker network ls | grep -q "reffix"; then
    echo -e "${YELLOW}⚠️  Rede 'reffix' não encontrada. Criando...${NC}"
    docker network create --driver overlay reffix
    echo -e "${GREEN}✅ Rede 'reffix' criada${NC}"
else
    echo -e "${GREEN}✅ Rede 'reffix' existe${NC}"
fi
echo ""

# Remover stack existente (se houver)
echo -e "${YELLOW}🗑️  Removendo stack existente (se houver)...${NC}"
if docker stack ls | grep -q "$STACK_NAME"; then
    docker stack rm "$STACK_NAME"
    echo -e "${YELLOW}⏳ Aguardando remoção completa...${NC}"
    
    # Aguardar até que a stack seja completamente removida
    while docker stack ls | grep -q "$STACK_NAME"; do
        sleep 2
        echo -n "."
    done
    echo ""
    echo -e "${GREEN}✅ Stack removida${NC}"
else
    echo -e "${GREEN}✅ Nenhuma stack existente encontrada${NC}"
fi
echo ""

# Aguardar um pouco para garantir que tudo foi limpo
sleep 3

# Build das imagens
echo -e "${BLUE}🔨 Build das imagens...${NC}"
echo ""

# Build do backend
echo -e "${YELLOW}📦 Building backend...${NC}"
cd backend
docker build -t acaiteria-backend:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build concluído${NC}"
else
    echo -e "${RED}❌ Erro no build do backend${NC}"
    exit 1
fi
cd ..
echo ""

# Build do frontend
echo -e "${YELLOW}📦 Building frontend...${NC}"
docker build -t acaiteria-frontend:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build concluído${NC}"
else
    echo -e "${RED}❌ Erro no build do frontend${NC}"
    exit 1
fi
echo ""

# Verificar variáveis de ambiente
echo -e "${YELLOW}🔍 Verificando variáveis de ambiente...${NC}"
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}⚠️  DOMAIN não definido, usando padrão: gestaoloja.reffix.com.br${NC}"
    export DOMAIN="gestaoloja.reffix.com.br"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL não definido!${NC}"
    echo -e "${YELLOW}Defina: export DATABASE_URL='postgresql://usuario:senha@host:5432/banco'${NC}"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "${YELLOW}⚠️  JWT_SECRET não definido, usando padrão (NÃO RECOMENDADO PARA PRODUÇÃO)${NC}"
    export JWT_SECRET="your-secret-key-change-in-production"
fi

if [ -z "$FRONTEND_URL" ]; then
    export FRONTEND_URL="https://${DOMAIN}"
    echo -e "${YELLOW}⚠️  FRONTEND_URL não definido, usando: ${FRONTEND_URL}${NC}"
else
    echo -e "${GREEN}✅ FRONTEND_URL: ${FRONTEND_URL}${NC}"
fi

if [ -z "$VITE_API_URL" ]; then
    export VITE_API_URL="https://api.${DOMAIN}"
    echo -e "${YELLOW}⚠️  VITE_API_URL não definido, usando: ${VITE_API_URL}${NC}"
else
    echo -e "${GREEN}✅ VITE_API_URL: ${VITE_API_URL}${NC}"
fi

echo -e "${GREEN}✅ Variáveis de ambiente verificadas${NC}"
echo ""

# Deploy da stack
echo -e "${BLUE}🚀 Fazendo deploy da stack...${NC}"
docker stack deploy -c docker-compose.yml "$STACK_NAME"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Stack deploy iniciado${NC}"
else
    echo -e "${RED}❌ Erro no deploy da stack${NC}"
    exit 1
fi
echo ""

# Aguardar serviços iniciarem
echo -e "${YELLOW}⏳ Aguardando serviços iniciarem...${NC}"
sleep 10

# Verificar status dos serviços
echo ""
echo -e "${BLUE}📊 Status dos serviços:${NC}"
docker service ls | grep "$STACK_NAME" || echo "Nenhum serviço encontrado"

echo ""
echo -e "${YELLOW}⏳ Aguardando serviços ficarem prontos...${NC}"
sleep 15

# Verificar novamente
echo ""
echo -e "${BLUE}📊 Status final dos serviços:${NC}"
docker service ls | grep "$STACK_NAME"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  Ver logs do backend:  ${BLUE}docker service logs -f ${STACK_NAME}_acaiteria-backend${NC}"
echo -e "  Ver logs do frontend: ${BLUE}docker service logs -f ${STACK_NAME}_acaiteria-frontend${NC}"
echo -e "  Ver status:           ${BLUE}docker service ls${NC}"
echo -e "  Ver detalhes:         ${BLUE}docker service ps ${STACK_NAME}_acaiteria-backend${NC}"
echo ""
echo -e "${YELLOW}Testar healthcheck:${NC}"
echo -e "  Backend:  ${BLUE}curl https://api.${DOMAIN}/health${NC}"
echo -e "  Frontend: ${BLUE}curl https://${DOMAIN}/health${NC}"
echo ""

