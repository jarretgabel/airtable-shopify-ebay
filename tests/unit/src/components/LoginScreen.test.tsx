import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/components/LoginScreen';

const useAuthStoreMock = vi.fn();

vi.mock('@/stores/auth/authStore', () => ({
  useAuthStore: (selector: (state: { login: (...args: unknown[]) => unknown; requestPasswordReset: (...args: unknown[]) => unknown }) => unknown) => useAuthStoreMock(selector),
}));

describe('LoginScreen', () => {
  it('submits the sign-in form when Enter is pressed in the password field', async () => {
    const login = vi.fn().mockResolvedValue({ success: true, message: '' });
    const requestPasswordReset = vi.fn().mockResolvedValue({ message: 'ok', resetLink: null });
    useAuthStoreMock.mockImplementation((selector) => selector({ login, requestPasswordReset }));
    const onLoggedIn = vi.fn();

    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Owner123!' } });
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('owner@example.com', 'Owner123!');
    });
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('does not render the owner package-script note', () => {
    const login = vi.fn().mockResolvedValue({ success: true, message: '' });
    const requestPasswordReset = vi.fn().mockResolvedValue({ message: 'ok', resetLink: null });
    useAuthStoreMock.mockImplementation((selector) => selector({ login, requestPasswordReset }));

    render(<LoginScreen onLoggedIn={vi.fn()} />);

    expect(screen.queryByText('Owner accounts are created or promoted manually with the package script.')).not.toBeInTheDocument();
  });

  it('logs in from a sample account button', async () => {
    const login = vi.fn().mockResolvedValue({ success: true, message: '' });
    const requestPasswordReset = vi.fn().mockResolvedValue({ message: 'ok', resetLink: null });
    const onLoggedIn = vi.fn();
    useAuthStoreMock.mockImplementation((selector) => selector({ login, requestPasswordReset }));

    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    const processorRow = screen.getByText('Processor: processor@example.com / Processor123!').closest('div');
    if (!processorRow) {
      throw new Error('Expected Processor sample account row to render.');
    }

    fireEvent.click(within(processorRow).getByRole('button', { name: 'Log In as Processor' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('processor@example.com', 'Processor123!');
    });
    expect(screen.getByLabelText('Email')).toHaveValue('processor@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('Processor123!');
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('renders sample credentials but keeps development reset links hidden', async () => {
    const login = vi.fn().mockResolvedValue({ success: true, message: '' });
    const requestPasswordReset = vi.fn().mockResolvedValue({ message: 'Reset sent.', resetLink: 'http://localhost/reset' });
    useAuthStoreMock.mockImplementation((selector) => selector({ login, requestPasswordReset }));

    render(<LoginScreen onLoggedIn={vi.fn()} />);

    expect(screen.getByText('Test account logins')).toBeInTheDocument();
    expect(screen.getByText('Admin: admin@example.com / Admin123!')).toBeInTheDocument();
    expect(screen.getByText('Owner: owner@example.com / Owner123!')).toBeInTheDocument();
    expect(screen.getByText('Developer: developer@example.com / Developer123!')).toBeInTheDocument();
    expect(screen.getByText('Processor: processor@example.com / Processor123!')).toBeInTheDocument();
    expect(screen.getByText('Tester: tester@example.com / Tester123!')).toBeInTheDocument();
    expect(screen.getByText('Photographer: photographer@example.com / Photographer123!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Developer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Processor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Tester' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log In as Photographer' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Account email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Send reset email'));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    });

    expect(screen.queryByText(/Development reset link:/)).not.toBeInTheDocument();
  });
});