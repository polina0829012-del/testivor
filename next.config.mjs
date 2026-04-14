/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 600,
      };
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    /** Иначе webpack может некорректно собрать Prisma: у части делегатов (например questionAnswer) будет undefined. */
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
