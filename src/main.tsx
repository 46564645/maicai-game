import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSplash } from './splash';
import './theme/tokens.css';
import './theme/base.css';
import './components/bits/bits.css';
import './theme/layout.css';
import './board.css';
import './hud.css';
import './phone.css';
import './screens.css';
import './components/cards/cards.css';
import './components/reactbits/reactbits.css';
import './components/reactbits/GradientText.css';
import './demo/demo.css';
import './App.css';

initSplash();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
