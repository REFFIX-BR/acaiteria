import type { User } from '@/types'
import { getGlobalData, setGlobalData } from '@/lib/storage/storage'

// Simula hash de senha (em produção, usar bcrypt ou similar)
function hashPassword(password: string): string {
  // Simulação simples - em produção usar bcrypt
  return btoa(password).split('').reverse().join('')
}

export function hashPasswordForStorage(password: string): string {
  return hashPassword(password)
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword
}

export function getCurrentUser(): User | null {
  const userId = getGlobalData<string>('currentUserId')
  if (!userId) return null

  const users = getGlobalData<User[]>('users') || []
  return users.find(u => u.id === userId) || null
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    setGlobalData('currentUserId', user.id)
    setGlobalData('currentUser', user)
  } else {
    setGlobalData('currentUserId', null)
    setGlobalData('currentUser', null)
  }
}

export function getAllUsers(): User[] {
  return getGlobalData<User[]>('users') || []
}

export function getUserByEmail(email: string): User | null {
  const users = getAllUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getAllUsers()
  
  // Verifica se email já existe
  if (getUserByEmail(user.email)) {
    throw new Error('Email já cadastrado')
  }

  const newUser: User = {
    ...user,
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    password: hashPasswordForStorage(user.password),
  }

  users.push(newUser)
  setGlobalData('users', users)
  
  return newUser
}

export function authenticateUser(email: string, password: string): User | null {
  const user = getUserByEmail(email)
  
  if (!user) {
    return null
  }

  if (!verifyPassword(password, user.password)) {
    return null
  }

  // Atualiza último login
  const users = getAllUsers()
  const userIndex = users.findIndex(u => u.id === user.id)
  if (userIndex !== -1) {
    users[userIndex] = {
      ...users[userIndex],
      lastLogin: new Date(),
    }
    setGlobalData('users', users)
  }

  return {
    ...user,
    lastLogin: new Date(),
  }
}

export function logout(): void {
  setCurrentUser(null)
  setGlobalData('currentTenantId', null)
  // Remove o token JWT do localStorage
  localStorage.removeItem('auth_token')
}

