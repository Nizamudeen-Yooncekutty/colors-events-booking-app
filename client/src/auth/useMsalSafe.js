import { createContext, useContext } from 'react';

const MsalInstanceContext = createContext(null);

export const MsalInstanceProvider = MsalInstanceContext.Provider;

export function useMsalInstance() {
  return useContext(MsalInstanceContext);
}
