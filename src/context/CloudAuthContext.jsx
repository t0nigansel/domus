import { createContext, useContext } from 'react';

export const CloudAuthContext = createContext(null);

export const useCloudAuth = () => useContext(CloudAuthContext);
