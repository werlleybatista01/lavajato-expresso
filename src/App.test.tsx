import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

const { signUp, signInWithPassword } = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn() }))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signUp, signInWithPassword,
  } },
}))

function subject() { return render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>) }
describe('autenticação', () => {
  afterEach(cleanup)
  beforeEach(() => { signUp.mockReset(); signInWithPassword.mockReset() })
  it('alterna entre login e cadastro pelo botão', async () => {
    subject(); expect(await screen.findByRole('heading', { name: 'Entrar no sistema' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Criar meu primeiro acesso' }))
    expect(screen.getByRole('heading', { name: 'Criar acesso' })).toBeVisible()
  })
  it('envia o formulário de login e apresenta erro sem quebrar a interface', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Credenciais inválidas' } }); subject()
    fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: 'teste@empresa.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeVisible())
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'teste@empresa.com', password: '12345678' })
  })
})
