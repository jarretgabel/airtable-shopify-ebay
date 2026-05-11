import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});