import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return ["/","/controller"].map(source=>({source,headers:[{key:"Cache-Control",value:"private, no-store"}]}));},
};

export default nextConfig;
