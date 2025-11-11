import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../hooks/useAuth';
import { loginSchema } from '../utils/validators';
import { logger } from '../utils/logger';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get('role');
  const { signIn, role } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectPending, setRedirectPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    logger.debug('login', { event: 'submit', email: data.email });
    try {
      setLoading(true);
      setError(null);
      await signIn(data.email, data.password);
      setRedirectPending(true);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      logger.error('login', { event: 'signIn:error', error: err });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    logger.debug('login', { event: 'effect', redirectPending, role });
    if (!redirectPending) return;

    if (role === 'admin') {
      navigate('/admin', { replace: true });
      setRedirectPending(false);
    } else if (role === null) {
      // still waiting for profile load
      return;
    } else {
      navigate('/', { replace: true });
      setRedirectPending(false);
    }
  }, [redirectPending, role, navigate]);

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>Login</h1>
      <p>Sign in to access admin panel</p>

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            disabled={loading}
          />
          {errors.email && <p style={{ color: '#c00', fontSize: '14px', marginTop: '5px' }}>{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            disabled={loading}
          />
          {errors.password && <p style={{ color: '#c00', fontSize: '14px', marginTop: '5px' }}>{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

