#!/bin/bash

# Script para testar se a rota do backend está acessível

echo "=== Testando Rota do Backend ==="
echo ""

# Obter IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "IP do servidor: $SERVER_IP"
echo ""

# Testar health check
echo "1. Testando /health:"
curl -s http://localhost:3000/health || echo "❌ Erro ao acessar /health"
echo ""
echo ""

# Testar rota de pagamento (sem autenticação, deve dar 401 ou 404)
echo "2. Testando /api/payment/process (sem auth, esperado: 401 ou 404):"
curl -s -X POST http://localhost:3000/api/payment/process \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' \
  -w "\nStatus: %{http_code}\n" || echo "❌ Erro ao acessar /api/payment/process"
echo ""
echo ""

# Verificar se o Traefik está roteando
echo "3. Verificando se o Traefik está na rede reffix:"
TRAEFIK_CONTAINER=$(docker ps | grep traefik | awk '{print $1}' | head -1)
if [ ! -z "$TRAEFIK_CONTAINER" ]; then
  echo "Container Traefik: $TRAEFIK_CONTAINER"
  docker inspect $TRAEFIK_CONTAINER | grep -A 5 "Networks" | grep reffix || echo "⚠️  Traefik pode não estar na rede reffix"
else
  echo "❌ Traefik não encontrado"
fi
echo ""
echo ""

# Verificar labels do serviço backend
echo "4. Verificando labels do serviço backend:"
docker service inspect acaiteria_acaiteria-backend --format '{{range $k, $v := .Spec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik || echo "⚠️  Nenhum label Traefik encontrado"
echo ""
echo ""

# Testar acesso via Traefik (se DNS estiver configurado)
echo "5. Testando acesso via Traefik (api.reffix.com.br):"
if command -v dig &> /dev/null; then
  DNS_RESULT=$(dig +short api.reffix.com.br 2>&1)
  if [ ! -z "$DNS_RESULT" ] && [[ ! "$DNS_RESULT" =~ "NXDOMAIN" ]]; then
    echo "DNS resolvido: $DNS_RESULT"
    curl -s -k https://api.reffix.com.br/health || echo "❌ Erro ao acessar via Traefik"
  else
    echo "⚠️  DNS não configurado para api.reffix.com.br"
  fi
else
  echo "⚠️  dig não disponível"
fi
echo ""

