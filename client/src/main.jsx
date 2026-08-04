import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig, isSSOEnabled } from '@/auth/msalConfig';
import { MsalInstanceProvider } from '@/auth/useMsalSafe';
import './index.css';
import App from './App.jsx';

async function bootstrap() {
  let msalInstance = null;

  if (isSSOEnabled()) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
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
