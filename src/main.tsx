import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { armSplashWatchdog } from './splash';
import './theme/tokens.css';
import './theme/base.css';
import './theme/layout.css';
import './board.css';
import './hud.css';
import './phone.css';
import './screens.css';
import './components/cards/cards.css';
import './demo/demo.css';
import './App.css';

armSplashWatchdog();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
