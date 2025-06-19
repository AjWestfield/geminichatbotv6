/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle node: protocol imports in client-side bundles
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
        stream: false,
        crypto: false,
        buffer: false,
        http: false,
        https: false,
        zlib: false,
        fs: false,
        path: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };

      // Mark LangGraph and related packages as external for client bundles
      config.externals = [
        ...(config.externals || []),
        '@langchain/langgraph',
        '@langchain/core',
        '@langchain/community',
        '@langchain/openai',
        '@langchain/anthropic',
        '@langchain/google-genai',
      ];
    }

    // Ignore node: protocol warnings and Supabase realtime warnings
    config.ignoreWarnings = [
      {
        module: /node:/,
      },
      {
        message: /Critical dependency.*the request of a dependency is an expression/,
        module: /@supabase\/realtime-js/,
      },
      ...(config.ignoreWarnings || []),
    ];

    return config;
  },
};

export default nextConfig;
