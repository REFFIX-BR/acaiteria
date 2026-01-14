#!/bin/bash

# Script de Verificação - Traefik e DNS
# Verifica se o Traefik está configurado corretamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Verificação Traefik e DNS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Verificar se o Traefik está rodando
echo -e "${YELLOW}1. Verificando se o Traefik está rodando...${NC}"
if docker ps | grep -q traefik; then
    echo -e "${GREEN}✅ Traefik está rodando${NC}"
    docker ps | grep traefik
else
    echo -e "${RED}❌ Traefik NÃO está rodando${NC}"
    echo -e "${YELLOW}   Execute: docker ps -a | grep traefik para ver se existe${NC}"
fi
echo ""

# 2. Verificar se a rede 'reffix' existe
echo -e "${YELLOW}2. Verificando rede 'reffix'...${NC}"
if docker network ls | grep -q reffix; then
    echo -e "${GREEN}✅ Rede 'reffix' existe${NC}"
    docker network inspect reffix --format '{{.Name}}: {{.Driver}}'
else
    echo -e "${RED}❌ Rede 'reffix' NÃO existe${NC}"
    echo -e "${YELLOW}   Execute: docker network create --driver overlay reffix${NC}"
fi
echo ""

# 3. Verificar se a stack está rodando
echo -e "${YELLOW}3. Verificando stack 'acaiteria'...${NC}"
if docker stack ls | grep -q acaiteria; then
    echo -e "${GREEN}✅ Stack 'acaiteria' está rodando${NC}"
    docker stack services acaiteria
else
    echo -e "${RED}❌ Stack 'acaiteria' NÃO está rodando${NC}"
    echo -e "${YELLOW}   Execute: ./deploy.sh para fazer o deploy${NC}"
fi
echo ""

# 4. Verificar serviços da stack
echo -e "${YELLOW}4. Verificando serviços da stack...${NC}"
if docker stack ls | grep -q acaiteria; then
    echo -e "${BLUE}Serviços:${NC}"
    docker stack services acaiteria --format "table {{.Name}}\t{{.Replicas}}\t{{.Image}}"
    
    echo ""
    echo -e "${BLUE}Tasks (tarefas):${NC}"
    docker stack ps acaiteria --format "table {{.Name}}\t{{.CurrentState}}\t{{.Node}}"
fi
echo ""

# 5. Verificar variáveis de ambiente
echo -e "${YELLOW}5. Verificando variáveis de ambiente...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
    if grep -q "DOMAIN=" .env; then
        DOMAIN=$(grep "DOMAIN=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        echo -e "${GREEN}   DOMAIN: ${DOMAIN}${NC}"
    else
        echo -e "${YELLOW}   ⚠️  DOMAIN não definido no .env${NC}"
    fi
    
    if grep -q "VITE_API_URL=" .env; then
        VITE_API_URL=$(grep "VITE_API_URL=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        echo -e "${GREEN}   VITE_API_URL: ${VITE_API_URL}${NC}"
    else
        echo -e "${YELLOW}   ⚠️  VITE_API_URL não definido no .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado${NC}"
fi
echo ""

# 6. Verificar DNS (se DOMAIN estiver definido)
if [ ! -z "$DOMAIN" ]; then
    echo -e "${YELLOW}6. Verificando DNS para api.${DOMAIN}...${NC}"
    if command -v dig &> /dev/null; then
        DNS_RESULT=$(dig +short api.${DOMAIN} 2>&1)
        if [ ! -z "$DNS_RESULT" ] && [[ ! "$DNS_RESULT" =~ "NXDOMAIN" ]]; then
            echo -e "${GREEN}✅ DNS resolvido:${NC}"
            echo "$DNS_RESULT"
        else
            echo -e "${RED}❌ DNS NÃO resolvido (NXDOMAIN)${NC}"
            echo -e "${YELLOW}   Configure o DNS para api.${DOMAIN} apontando para o IP do servidor${NC}"
        fi
    elif command -v nslookup &> /dev/null; then
        NSLOOKUP_RESULT=$(nslookup api.${DOMAIN} 2>&1)
        if [[ "$NSLOOKUP_RESULT" =~ "Name:" ]]; then
            echo -e "${GREEN}✅ DNS resolvido:${NC}"
            echo "$NSLOOKUP_RESULT"
        else
            echo -e "${RED}❌ DNS NÃO resolvido${NC}"
            echo -e "${YELLOW}   Configure o DNS para api.${DOMAIN} apontando para o IP do servidor${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Ferramentas de DNS (dig/nslookup) não disponíveis${NC}"
        echo -e "${YELLOW}   Teste manualmente: ping api.${DOMAIN}${NC}"
    fi
    echo ""
fi

# 7. Verificar labels do Traefik nos serviços
echo -e "${YELLOW}7. Verificando labels do Traefik...${NC}"
if docker stack ls | grep -q acaiteria; then
    echo -e "${BLUE}Backend (acaiteria-backend):${NC}"
    docker service inspect acaiteria_acaiteria-backend --format '{{range .Spec.Labels}}{{.}} {{end}}' 2>/dev/null | grep traefik || echo "Nenhum label Traefik encontrado"
    
    echo ""
    echo -e "${BLUE}Frontend (acaiteria-frontend):${NC}"
    docker service inspect acaiteria_acaiteria-frontend --format '{{range .Spec.Labels}}{{.}} {{end}}' 2>/dev/null | grep traefik || echo "Nenhum label Traefik encontrado"
fi
echo ""

# 8. Verificar logs do Traefik (últimas 20 linhas)
echo -e "${YELLOW}8. Últimas linhas dos logs do Traefik...${NC}"
if docker ps | grep -q traefik; then
    TRAEFIK_CONTAINER=$(docker ps | grep traefik | awk '{print $1}' | head -1)
    echo -e "${BLUE}Logs do Traefik (últimas 20 linhas):${NC}"
    docker logs --tail 20 $TRAEFIK_CONTAINER 2>&1 | tail -20
else
    echo -e "${YELLOW}⚠️  Traefik não está rodando, não é possível ver logs${NC}"
fi
echo ""

# 9. Resumo e recomendações
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Resumo e Recomendações${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Para resolver o problema ERR_NAME_NOT_RESOLVED:${NC}"
echo ""
echo "1. ${GREEN}Verifique o DNS:${NC}"
echo "   - Configure um registro A ou CNAME para api.${DOMAIN:-gestaoloja.reffix.com.br}"
echo "   - Aponte para o IP do servidor onde o Traefik está rodando"
echo ""
echo "2. ${GREEN}Verifique o Traefik:${NC}"
echo "   - Certifique-se de que o Traefik está rodando e acessível"
echo "   - Verifique se os labels estão corretos no docker-compose.yml"
echo ""
echo "3. ${GREEN}Verifique os certificados SSL:${NC}"
echo "   - O Let's Encrypt pode levar alguns minutos para gerar o certificado"
echo "   - Verifique os logs do Traefik para erros de certificado"
echo ""
echo "4. ${GREEN}Teste localmente:${NC}"
echo "   - Se o DNS não estiver configurado, você pode testar usando o IP do servidor"
echo "   - Ou adicione uma entrada no /etc/hosts (Linux/Mac) ou C:\\Windows\\System32\\drivers\\etc\\hosts (Windows)"
echo ""

