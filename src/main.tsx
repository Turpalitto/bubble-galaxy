import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { setupPlatformGuards } from './utils/yandexSdk';

setupPlatformGuards();

createRoot(document.getElementById('root')!).render(<App />);
