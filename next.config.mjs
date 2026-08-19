/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Receipt image uploads: allow reasonably large multipart bodies to route
  // handlers. Section 4.1 (OCR service) consumes these.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
