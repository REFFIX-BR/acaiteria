#!/bin/bash

# Script simples para testar DNS e verificar labels

echo "=== Verificando Labels do Traefik ==="
echo ""
echo "Backend labels:"
docker service inspect acaiteria_acaiteria-backend --format '{{range $k, $v := .Spec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik
echo ""
echo "Frontend labels:"
docker service inspect acaiteria_acaiteria-frontend --format '{{range $k, $v := .Spec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' | grep traefik
echo ""
echo "=== Verificando DNS ==="
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "IP do servidor: $SERVER_IP"
echo ""
echo "Testando DNS:"
dig +short api.gestaoloja.reffix.com.br || echo "DNS não resolvido"
echo ""
echo "=== Solução Temporária ==="
echo "Para testar, adicione no seu .env:"
echo "VITE_API_URL=http://$SERVER_IP:3000"
echo ""
echo "Ou configure o DNS para:"
echo "api.gestaoloja.reffix.com.br -> $SERVER_IP"

