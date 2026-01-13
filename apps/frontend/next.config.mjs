// apps/frontend/next.config.mjs
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    // 🔒 forza UNA sola istanza di react/react-dom
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.resolve(process.cwd(), "node_modules/react"),
      "react-dom": path.resolve(process.cwd(), "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(process.cwd(), "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(process.cwd(), "node_modules/react/jsx-dev-runtime"),
    };
    return config;
  },
};

export default nextConfig;
