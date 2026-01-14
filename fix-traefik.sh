#!/bin/bash

# Script para verificar e corrigir configuração do Traefik

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Diagnóstico e Correção Traefik${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Verificar se o Traefik está na rede reffix
echo -e "${YELLOW}1. Verificando se Traefik está na rede 'reffix'...${NC}"
TRAEFIK_CONTAINER=$(docker ps | grep traefik | awk '{print $1}' | head -1)
if [ ! -z "$TRAEFIK_CONTAINER" ]; then
    if docker inspect $TRAEFIK_CONTAINER | grep -q "reffix"; then
        echo -e "${GREEN}✅ Traefik está na rede 'reffix'${NC}"
    else
        echo -e "${RED}❌ Traefik NÃO está na rede 'reffix'${NC}"
        echo -e "${YELLOW}   Isso pode ser o problema!${NC}"
    fi
else
    echo -e "${RED}❌ Container Traefik não encontrado${NC}"
fi
echo ""

# 2. Verificar labels dos serviços
echo -e "${YELLOW}2. Verificando labels dos serviços...${NC}"
echo -e "${BLUE}Backend:${NC}"
docker service inspect acaiteria_acaiteria-backend --format '{{json .Spec.TaskTemplate.ContainerSpec.Labels}}' 2>/dev/null | python3 -m json.tool 2>/dev/null || docker service inspect acaiteria_acaiteria-backend --format '{{range $k, $v := .Spec.TaskTemplate.ContainerSpec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' 2>/dev/null | grep traefik || echo "Nenhum label Traefik encontrado"

echo ""
echo -e "${BLUE}Frontend:${NC}"
docker service inspect acaiteria_acaiteria-frontend --format '{{json .Spec.TaskTemplate.ContainerSpec.Labels}}' 2>/dev/null | python3 -m json.tool 2>/dev/null || docker service inspect acaiteria_acaiteria-frontend --format '{{range $k, $v := .Spec.TaskTemplate.ContainerSpec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' 2>/dev/null | grep traefik || echo "Nenhum label Traefik encontrado"
echo ""

# 3. Verificar IP do servidor
echo -e "${YELLOW}3. Verificando IP do servidor...${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${GREEN}IP do servidor: ${SERVER_IP}${NC}"
echo ""

# 4. Verificar se o DNS está configurado
echo -e "${YELLOW}4. Verificando DNS...${NC}"
if command -v dig &> /dev/null; then
    DNS_RESULT=$(dig +short api.gestaoloja.reffix.com.br 2>&1)
    if [ ! -z "$DNS_RESULT" ] && [[ ! "$DNS_RESULT" =~ "NXDOMAIN" ]] && [[ ! "$DNS_RESULT" =~ "connection timed out" ]]; then
        echo -e "${GREEN}✅ DNS resolvido: ${DNS_RESULT}${NC}"
    else
        echo -e "${RED}❌ DNS NÃO resolvido${NC}"
        echo -e "${YELLOW}   Configure o DNS para: api.gestaoloja.reffix.com.br -> ${SERVER_IP}${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  dig não disponível, testando com ping...${NC}"
    if ping -c 1 api.gestaoloja.reffix.com.br &> /dev/null; then
        echo -e "${GREEN}✅ DNS resolvido${NC}"
    else
        echo -e "${RED}❌ DNS NÃO resolvido${NC}"
    fi
fi
echo ""

# 5. Solução temporária: usar IP diretamente
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Solução Temporária${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Para testar enquanto o DNS não está configurado:${NC}"
echo ""
echo -e "${GREEN}1. Atualize o .env com o IP do servidor:${NC}"
echo "   VITE_API_URL=http://${SERVER_IP}:3000"
echo "   (ou use https se o Traefik estiver configurado)"
echo ""
echo -e "${GREEN}2. Ou configure o DNS:${NC}"
echo "   api.gestaoloja.reffix.com.br -> ${SERVER_IP}"
echo ""
echo -e "${GREEN}3. Ou adicione no /etc/hosts do seu computador:${NC}"
echo "   ${SERVER_IP} api.gestaoloja.reffix.com.br"
echo ""

