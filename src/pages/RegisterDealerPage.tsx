import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dealerRegistrationSchema } from '../utils/validators';
import { supabase, createTransientSupabaseClient } from '../lib/supabaseClient';
import { notifyManufacturerOfDealerApplication } from '../services/productService';
import type { PostgrestError } from '@supabase/supabase-js';

interface DealerRegistrationFormData {
  name: string;
  email: string;
  password: string;
  company: string;
  region: 'us' | 'eu' | 'asia' | 'custom';
  contact_details?: string;
}

export function RegisterDealerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DealerRegistrationFormData>({
    resolver: zodResolver(dealerRegistrationSchema),
  });

  async function onSubmit(data: DealerRegistrationFormData) {
    const registrationClient = createTransientSupabaseClient();
    try {
      setLoading(true);
      setError(null);

      // Sign up with Supabase Auth
      const { data: signUpResult, error: signUpError } = await registrationClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'dealer',
            name: data.name,
            company: data.company,
            region: data.region,
            contact_details: data.contact_details,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const user = signUpResult.user;

      if (!user?.id) {
        throw new Error(
          'User registration requires email confirmation before continuing. Please verify your email via the link we just sent and then sign in.'
        );
      }

      // Create dealer record in pending status via RPC (bypasses RLS restrictions)
      const { data: dealerRecord, error: dealerError } = await supabase.rpc('register_dealer_profile', {
        p_dealer_id: user.id,
        p_name: data.name,
        p_email: data.email,
        p_region: data.region,
        p_region_slug: `${data.region}-pending`,
        p_currency: data.region === 'us' ? 'USD' : data.region === 'eu' ? 'EUR' : data.region === 'asia' ? 'SGD' : 'USD',
        p_status: 'pending',
      });

      if (dealerError) {
        const message =
          (dealerError as PostgrestError)?.message ??
          'We could not create your dealer profile. Please contact support if the problem persists.';
        throw new Error(message);
      }

      if (dealerRecord) {
        await notifyManufacturerOfDealerApplication({
          dealerId: dealerRecord.id,
          dealerName: dealerRecord.name,
          dealerEmail: dealerRecord.email,
          region: dealerRecord.region,
        });
      }

      setSuccess(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const message: string = err?.message ?? 'Registration failed. Please try again.';

      if (message.includes('Email not confirmed')) {
        setError('Please confirm your email address first. Follow the link in the confirmation email, then log in as a dealer.');
      } else if (message.includes('manufacturer accounts')) {
        setError('This email address belongs to the manufacturer account. Please use a different email for dealer access.');
      } else if (message.includes('already exists')) {
        setError('An account with this email already exists. Try signing in or resetting your password.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      await registrationClient.auth.signOut().catch(() => {
        // Ignore cleanup errors for transient client
      });
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: '500px', margin: '100px auto', padding: '20px', textAlign: 'center' }}>
        <h1>Application Submitted!</h1>
        <p>Your dealer application has been submitted successfully.</p>
        <p>You will receive an email notification once the manufacturer reviews your application.</p>
        <p style={{ color: '#666', marginTop: '20px' }}>Redirecting to login page...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', padding: '20px' }}>
      <h1>Register as Dealer</h1>
      <p>Apply to become an authorized Exce1sior dealer</p>

      {error && (
        <div style={{ background: '#fee', color: '#c00', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label htmlFor="name" style={{ display: 'block', marginBottom: '5px' }}>
            Your Name *
          </label>
          <input
            id="name"
            {...register('name')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            disabled={loading}
          />
          {errors.name && <p style={{ color: '#c00', fontSize: '14px', marginTop: '5px' }}>{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="company" style={{ display: 'block', marginBottom: '5px' }}>
            Company Name *
          </label>
          <input
            id="company"
            {...register('company')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            disabled={loading}
          />
          {errors.company && <p style={{ color: '#c00', fontSize: '14px', marginTop: '5px' }}>{errors.company.message}</p>}
        </div>

        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email *
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
            Password * (min 12 characters)
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

        <div>
          <label htmlFor="region" style={{ display: 'block', marginBottom: '5px' }}>
            Region *
          </label>
          <select
            id="region"
            {...register('region')}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
            disabled={loading}
          >
            <option value="us">United States</option>
            <option value="eu">Europe</option>
            <option value="asia">Asia Pacific</option>
            <option value="custom">Other</option>
          </select>
          {errors.region && <p style={{ color: '#c00', fontSize: '14px', marginTop: '5px' }}>{errors.region.message}</p>}
        </div>

        <div>
          <label htmlFor="contact_details" style={{ display: 'block', marginBottom: '5px' }}>
            Additional Contact Details (optional)
          </label>
          <textarea
            id="contact_details"
            {...register('contact_details')}
            rows={3}
            style={{ width: '100%', padding: '8px', fontSize: '16px', fontFamily: 'inherit' }}
            disabled={loading}
          />
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
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>

      <p style={{ marginTop: '20px', textAlign: 'center' }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: '#007bff' }}>
          Sign In
        </a>
      </p>
    </div>
  );
}

