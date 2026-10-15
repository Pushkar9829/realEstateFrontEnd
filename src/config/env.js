// Public build-time configuration. Only VITE_* variables reach the bundle,
// so nothing secret may ever be placed here.
const env = {
  apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:4102/api').replace(/\/$/, ''),
  appName: import.meta.env.VITE_APP_NAME || 'PropertyDirect',
  hotline: import.meta.env.VITE_HOTLINE || '+91 90000 00000',
  isDev: import.meta.env.DEV,
};

export default env;
