# Plataforma Multitenant para Açaiterias

Plataforma web completa e multitenant focada exclusivamente em açaiterias, com design moderno, responsivo e experiência de uso simples e intuitiva.

## 🚀 Tecnologias

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **Shadcn/ui**
- **Zustand** (gerenciamento de estado)
- **React Router v6** (roteamento)
- **React Hook Form** + **Zod** (formulários e validação)
- **Recharts** (gráficos e visualizações)
- **Lucide React** (ícones)

## 📦 Instalação

```bash
npm install
```

## 🛠️ Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 🏗️ Build

```bash
npm run build
```

## 🎯 Funcionalidades

- ✅ Sistema multitenant com isolamento completo de dados
- ✅ Dashboard gerencial
- ✅ Fluxo de caixa
- ✅ Sistema de estoque inteligente
- ✅ Cardápio digital
- ✅ Marketing e campanhas
- ✅ Integração WhatsApp (Evolution API)

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes Shadcn/ui
│   └── layout/         # Header, Sidebar, etc.
├── features/           # Funcionalidades por módulo
│   ├── auth/           # Autenticação/Login
│   ├── dashboard/      # Dashboard gerencial
│   ├── cashflow/       # Fluxo de caixa
│   ├── inventory/      # Estoque
│   ├── menu/           # Cardápio digital
│   ├── marketing/      # Marketing e campanhas
│   └── whatsapp/       # Integração WhatsApp
├── lib/                # Utilitários e configurações
│   ├── storage/        # Camada de armazenamento
│   └── tenant/         # Gerenciamento multitenant
├── stores/             # Stores Zustand
├── types/              # Tipos TypeScript
└── hooks/              # Custom hooks
```

## 🔒 Multitenancy

Cada açaiteria (tenant) possui:
- Ambiente completamente isolado
- Identidade visual personalizada (cores, logo, nome)
- Dados armazenados com prefixo `tenant:{id}:`
- Sem compartilhamento de dados entre tenants

## 📝 Licença

Este projeto é privado.

