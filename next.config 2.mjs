/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  webpack: (config) => {
    // Handle Web Workers for ML detection
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: {
        loader: 'worker-loader',
        options: {
          filename: 'static/[hash].worker.js',
          publicPath: '/_next/'
        }
      }
    });
    
    // Fix for TensorFlow.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    return config;
  },
  // Enable for production deployment
  output: 'standalone',
  // Mapbox GL requires this
  transpilePackages: ['mapbox-gl']
};

export default nextConfig;