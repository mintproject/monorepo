import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';

import { App } from './App';
import { apolloClient } from './lib/apollo-client';
import { AuthProvider } from './lib/auth/AuthProvider';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApolloProvider client={apolloClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ApolloProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
