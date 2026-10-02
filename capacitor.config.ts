import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lacalle.life',
  appName: 'LaCalle Life',
  webDir: 'capacitor-shell',
  // O app inteiro roda a partir daqui — capacitor-shell/ nunca é exibido.
  // Ver auditoria (ponto A/B): a arquitetura atual (middleware por request,
  // rotas dinâmicas com id local, sessão via cookie) não é compatível com
  // export estático, então o caminho viável é apontar o WebView pra própria
  // produção, sem tocar em nada do app Next.js.
  server: {
    url: 'https://lacalle-life-2.vercel.app',
    cleartext: false
  },
  plugins: {
    // As barras do sistema são tratadas no MainActivity (a página é afastada
    // delas), não por variáveis CSS que o site não usa.
    SystemBars: {
      insetsHandling: 'disable'
    }
  }
};

export default config;
