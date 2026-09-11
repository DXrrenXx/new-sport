import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SCHOOL_NAME, SYSTEM_NAME } from './config';
import './index.css';

// 浏览器标签标题统一来自 config.ts（index.html 中的 title 为加载前的静态回退）
document.title = `${SCHOOL_NAME}${SYSTEM_NAME}`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
