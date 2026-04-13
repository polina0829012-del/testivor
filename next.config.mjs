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
    /** Меньше модулей на один импорт — быстрее cold compile в dev. */
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
