#!/usr/bin/env node

/**
 * Script para criar usuário no banco de dados
 * 
 * Uso: node database/create-user.js <email> <senha> <nome> <tenant-slug>
 * 
 * Exemplo:
 * node database/create-user.js babinhotr990@gmail.com 072128 "Junior Oliveira" acai-do-bairro
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://plataformacaiteria:plataformaacaiteria@postgres_postgres:5432/acaiteria',
  ssl: false,
});

async function createUser(email, password, name, tenantSlug, createTenant = false) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Verificar ou criar tenant
    let tenantResult = await client.query(
      'SELECT id, name FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [tenantSlug]
    );
    
    let tenant;
    if (tenantResult.rows.length === 0) {
      if (createTenant) {
        console.log(`📦 Criando tenant "${tenantSlug}"...`);
        tenantResult = await client.query(
          `INSERT INTO tenants (id, name, slug, primary_color, secondary_color, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, '#8b5cf6', '#ec4899', NOW(), NOW())
           RETURNING id, name`,
          [name.split(' ')[0] + ' Açaiteria', tenantSlug] // Nome do tenant baseado no nome do usuário
        );
        tenant = tenantResult.rows[0];
        console.log(`✅ Tenant criado: ${tenant.name} (${tenant.id})`);
        
        // Criar subscription (trial)
        await client.query(
          `INSERT INTO subscriptions (tenant_id, plan_type, trial_start_date, trial_end_date, is_active, is_trial, created_at, updated_at)
           VALUES ($1, 'trial', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', true, true, NOW(), NOW())`,
          [tenant.id]
        );
        console.log(`✅ Subscription (trial) criada`);
      } else {
        console.error(`❌ Tenant com slug "${tenantSlug}" não encontrado!`);
        console.log('\nTenants disponíveis:');
        const allTenants = await client.query('SELECT id, name, slug FROM tenants WHERE deleted_at IS NULL');
        allTenants.rows.forEach(t => console.log(`  - ${t.slug} (${t.name})`));
        console.log('\n💡 Dica: Use --create-tenant para criar o tenant automaticamente');
        await client.query('ROLLBACK');
        return;
      }
    } else {
      tenant = tenantResult.rows[0];
      console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.id})`);
    }
    
    // 2. Verificar se o usuário já existe
    const userCheck = await client.query(
      'SELECT id, email, name FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    
    if (userCheck.rows.length > 0) {
      console.log(`⚠️  Usuário já existe: ${userCheck.rows[0].email}`);
      console.log(`   ID: ${userCheck.rows[0].id}`);
      console.log(`   Nome: ${userCheck.rows[0].name}`);
      
      // Perguntar se quer atualizar a senha
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Deseja atualizar a senha? (s/n): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 's') {
        console.log('Operação cancelada.');
        await client.query('ROLLBACK');
        return;
      }
      
      // Atualizar senha
      const passwordHash = await bcrypt.hash(password, 10);
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [passwordHash, email]
      );
      console.log('✅ Senha atualizada com sucesso!');
      await client.query('COMMIT');
      return;
    }
    
    // 3. Gerar hash da senha
    console.log('🔐 Gerando hash da senha...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 4. Criar usuário
    console.log('👤 Criando usuário...');
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, tenant_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'owner', NOW(), NOW())
       RETURNING id, email, name, role`,
      [email, passwordHash, name, tenant.id]
    );
    
    const user = userResult.rows[0];
    console.log('✅ Usuário criado com sucesso!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Tenant: ${tenant.name}`);
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Main
const args = process.argv.slice(2);

if (args.length < 4) {
  console.log('Uso: node database/create-user.js <email> <senha> <nome> <tenant-slug> [--create-tenant]');
  console.log('\nExemplo:');
  console.log('  node database/create-user.js babinhotr990@gmail.com 072128 "Junior Oliveira" acai-do-bairro --create-tenant');
  console.log('\nOpções:');
  console.log('  --create-tenant  Cria o tenant automaticamente se não existir');
  process.exit(1);
}

const createTenant = args.includes('--create-tenant');
const filteredArgs = args.filter(arg => arg !== '--create-tenant');

if (filteredArgs.length < 4) {
  console.error('❌ Argumentos insuficientes');
  process.exit(1);
}

const [email, password, name, tenantSlug] = filteredArgs;

createUser(email, password, name, tenantSlug, createTenant)
  .then(() => {
    console.log('\n✅ Concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro ao criar usuário:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });

