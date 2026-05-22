import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { handleCallback } from '../lib/auth/oauth2-adapter';

type Status = 'processing' | 'success' | 'error';

/**
 * Handles the OAuth2 redirect callback.
 * The IdP sends the user here after authentication.
 * This page exchanges the authorization code (or stores the implicit token),
 * then redirects to the home page.
 */
export function OAuth2CallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  // Prevent double-invocation in React StrictMode
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    handleCallback()
      .then((result) => {
        if (result.type === 'error') {
          setStatus('error');
          setErrorMessage(result.error ?? 'Authentication failed');
          return;
        }
        setStatus('success');
        // Give React a moment to flush state before navigating
        setTimeout(() => navigate('/'), 100);
      })
      .catch((err: unknown) => {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Unknown error during authentication';
        setErrorMessage(message);
      });
  }, [navigate]);

  if (status === 'processing') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div
            className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent mx-auto"
            aria-label="Loading"
            role="status"
          />
          <p className="text-sm text-muted-foreground">Completing sign-in...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-semibold text-destructive mb-2">Authentication Failed</h1>
          <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
          <button
            className="text-sm underline text-primary"
            onClick={() => (window.location.href = '/')}
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  // success — brief flash before navigate fires
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Signed in. Redirecting...</p>
    </div>
  );
}
