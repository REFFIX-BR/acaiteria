#!/bin/bash

# Script para conectar Traefik à rede reffix e verificar configuração

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Correção Traefik - Rede e Configuração${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Encontrar container do Traefik
echo -e "${YELLOW}1. Encontrando container do Traefik...${NC}"
TRAEFIK_CONTAINER=$(docker ps | grep traefik | awk '{print $1}' | head -1)
if [ -z "$TRAEFIK_CONTAINER" ]; then
  echo -e "${RED}❌ Container Traefik não encontrado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Container Traefik: $TRAEFIK_CONTAINER${NC}"
echo ""

# 2. Verificar se está na rede reffix
echo -e "${YELLOW}2. Verificando se Traefik está na rede 'reffix'...${NC}"
if docker inspect $TRAEFIK_CONTAINER | grep -q "reffix"; then
  echo -e "${GREEN}✅ Traefik já está na rede 'reffix'${NC}"
else
  echo -e "${YELLOW}⚠️  Traefik NÃO está na rede 'reffix'${NC}"
  echo -e "${YELLOW}   Conectando à rede...${NC}"
  docker network connect reffix $TRAEFIK_CONTAINER
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Traefik conectado à rede 'reffix'${NC}"
  else
    echo -e "${RED}❌ Erro ao conectar Traefik à rede 'reffix'${NC}"
  fi
fi
echo ""

# 3. Verificar se o Traefik está configurado para Docker Swarm
echo -e "${YELLOW}3. Verificando configuração do Traefik...${NC}"
docker inspect $TRAEFIK_CONTAINER | grep -i "swarm\|docker" || echo -e "${YELLOW}⚠️  Verifique se o Traefik está configurado para escutar no Docker Swarm${NC}"
echo ""

# 4. Verificar labels dos serviços
echo -e "${YELLOW}4. Verificando labels dos serviços...${NC}"
echo -e "${BLUE}Backend:${NC}"
docker service inspect acaiteria_acaiteria-backend --format '{{range $k, $v := .Spec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik || echo "Nenhum label Traefik encontrado"
echo ""

# 5. Resumo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Próximos Passos${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}1. Criar DNS na Cloudflare:${NC}"
echo "   - Tipo: A ou CNAME"
echo "   - Nome: api.reffix.com.br"
echo "   - Valor: IP do servidor (ou CNAME para gestaoloja.reffix.com.br)"
echo ""
echo -e "${GREEN}2. Aguardar propagação do DNS (alguns minutos)${NC}"
echo ""
echo -e "${GREEN}3. Fazer redeploy da stack:${NC}"
echo "   ./deploy.sh"
echo ""
echo -e "${GREEN}4. Testar novamente${NC}"
echo ""

