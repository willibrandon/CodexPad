/**
 * @fileoverview Application entry point that sets up React root and imports styles
 * Initializes the React application with StrictMode and performance monitoring
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './light-mode.css';
import './dark-mode.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

/**
 * Create and render the React root component
 * Wraps the App component in StrictMode for development checks
 */
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring setup
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
