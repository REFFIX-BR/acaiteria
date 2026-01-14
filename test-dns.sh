#!/bin/bash

echo "========================================"
echo "  Teste de DNS e Roteamento"
echo "========================================"
echo ""

DOMAIN="api.reffix.com.br"

echo "1. Testando resolução DNS para $DOMAIN..."
IP=$(dig +short $DOMAIN 2>/dev/null || nslookup $DOMAIN 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}')

if [ -z "$IP" ]; then
    echo "❌ DNS não está resolvendo ainda"
    echo "   Aguarde alguns minutos para a propagação do DNS"
    exit 1
else
    echo "✅ DNS resolvido para: $IP"
fi

echo ""
echo "2. Testando conectividade HTTP (ignorando certificado SSL)..."
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 5 "https://$DOMAIN/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Endpoint /health está respondendo (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "⚠️  Endpoint retornou 404 (pode ser problema de roteamento)"
    echo "   Testando se o servidor está respondendo..."
    curl -k -v "https://$DOMAIN/health" 2>&1 | head -20
elif [ "$HTTP_CODE" = "000" ]; then
    echo "❌ Não foi possível conectar ao servidor"
    echo "   Verifique se o DNS está apontando para o IP correto"
else
    echo "⚠️  Endpoint retornou HTTP $HTTP_CODE"
    curl -k -v "https://$DOMAIN/health" 2>&1 | head -20
fi

echo ""
echo "3. Testando endpoint de pagamento..."
PAYMENT_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 5 -X POST "https://$DOMAIN/api/payment/test" -H "Content-Type: application/json" -d '{"test":true}' 2>/dev/null || echo "000")

if [ "$PAYMENT_CODE" = "200" ]; then
    echo "✅ Endpoint /api/payment/test está respondendo (HTTP $PAYMENT_CODE)"
elif [ "$PAYMENT_CODE" = "404" ]; then
    echo "⚠️  Endpoint /api/payment/test retornou 404"
else
    echo "⚠️  Endpoint retornou HTTP $PAYMENT_CODE"
fi

echo ""
echo "========================================"
echo "  Resumo"
echo "========================================"
echo ""
echo "DNS: $DOMAIN -> $IP"
echo "Health Check: HTTP $HTTP_CODE"
echo "Payment Test: HTTP $PAYMENT_CODE"
echo ""
echo "Se ambos retornarem 200, está tudo funcionando! 🎉"
