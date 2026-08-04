const ENV_CONFIG = {
  dev: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    tenantId: import.meta.env.VITE_MSAL_TENANT_ID || '',
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || 'http://localhost:5173',
    // Azure AD app registration must have this URI listed
  },
};

const config = ENV_CONFIG.dev;

export const msalConfig = {
  auth: {
    clientId: config.clientId,
    authority: `https://login.microsoftonline.com/${config.tenantId}`,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

export const isSSOEnabled = () => {
  return !!(config.clientId && config.tenantId);
};
