import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig, loginRequest, isSSOEnabled } from '@/auth/msalConfig';
import { MsalInstanceProvider } from '@/auth/useMsalSafe';
import { authenticateWithSSO } from '@/auth/authService';
import './index.css';
import App from './App.jsx';

async function bootstrap() {
  let msalInstance = null;

  if (isSSOEnabled()) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    // Handle the redirect response from Azure AD
    try {
      const response = await msalInstance.handleRedirectPromise();
      if (response?.account && response?.idToken) {
        msalInstance.setActiveAccount(response.account);

        // Complete SSO: send idToken to backend, get app JWT
        try {
          const data = await authenticateWithSSO(response.idToken);
          localStorage.setItem('token', data.token);
          localStorage.setItem('employee', JSON.stringify(data.employee));

          // Redirect to appropriate page
          const dest = data.employee.role === 'admin' ? '/admin' : '/events';
          window.history.replaceState({}, '', dest);
        } catch (err) {
          console.error('SSO backend auth failed:', err);
        }
      }
    } catch (err) {
      console.error('SSO redirect handling failed:', err);
    }

    // Set active account if exists
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(accounts[0]);
    }

    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        msalInstance.setActiveAccount(event.payload.account);
      }
    });
  }

  function Root() {
    const app = (
      <MsalInstanceProvider value={msalInstance}>
        <App />
      </MsalInstanceProvider>
    );

    if (msalInstance) {
      return <MsalProvider instance={msalInstance}>{app}</MsalProvider>;
    }
    return app;
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

bootstrap().catch(console.error);
