import { pathToFileURL } from 'node:url';

const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function deploymentDomain(hostname, publicUrl, redirectHostnames = '') {
  if (!hostnamePattern.test(hostname ?? '') || publicUrl !== `https://${hostname}`) {
    throw new Error('DEV hostname must be a DNS name and PUBLIC_URL its exact HTTPS origin without a trailing slash.');
  }
  const aliases = redirectHostnames.trim() ? redirectHostnames.split(',').map(name => name.trim()) : [];
  if (aliases.length > 5 || aliases.some(name => !hostnamePattern.test(name))) {
    throw new Error('DEV redirect hostnames must be at most five comma-separated DNS names.');
  }
  return { siteAddresses: [...new Set([hostname, ...aliases])].join(', '), canonicalHost: hostname };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = deploymentDomain(process.env.HOSTNAME, process.env.PUBLIC_URL, process.env.REDIRECT_HOSTNAMES);
  console.log(`site_addresses=${config.siteAddresses}`);
}
