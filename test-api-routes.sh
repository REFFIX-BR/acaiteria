#!/bin/bash

# Script para testar rotas da API

echo "=== Testando Rotas da API ==="
echo ""

API_URL="https://api.reffix.com.br"

# Testar health check
echo "1. Testando /health:"
curl -s "${API_URL}/health" | jq . || curl -s "${API_URL}/health"
echo ""
echo ""

# Testar rota de teste do payment (GET)
echo "2. Testando GET /api/payment/test:"
curl -s "${API_URL}/api/payment/test" | jq . || curl -s "${API_URL}/api/payment/test"
echo ""
echo ""

# Testar rota de teste do payment (POST)
echo "3. Testando POST /api/payment/test:"
curl -s -X POST "${API_URL}/api/payment/test" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}' | jq . || curl -s -X POST "${API_URL}/api/payment/test" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
echo ""
echo ""

# Testar rota /process (sem auth, deve dar 401)
echo "4. Testando POST /api/payment/process (sem auth, esperado: 401):"
curl -s -X POST "${API_URL}/api/payment/process" \
  -H "Content-Type: application/json" \
  -d '{"method": "pix", "planType": "basic"}' \
  -w "\nStatus: %{http_code}\n" | jq . || curl -s -X POST "${API_URL}/api/payment/process" \
  -H "Content-Type: application/json" \
  -d '{"method": "pix", "planType": "basic"}' \
  -w "\nStatus: %{http_code}\n"
echo ""
echo ""

echo "=== Verificando Logs do Backend ==="
echo "Execute: docker service logs -f acaiteria_acaiteria-backend"
echo ""

