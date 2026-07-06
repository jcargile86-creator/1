/**
 * Provisions iOS App Store signing non-interactively using the App Store
 * Connect API: ensures the bundle ID exists, creates a distribution
 * certificate from a fresh CSR, creates an App Store provisioning profile,
 * and writes credentials.json for `eas build` (credentialsSource: local).
 *
 * Env: EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const API = 'https://api.appstoreconnect.apple.com/v1';
const BUNDLE_ID = 'com.jargile.inspectpro';

const keyPath = process.env.EXPO_ASC_API_KEY_PATH;
const kid = process.env.EXPO_ASC_KEY_ID;
const iss = process.env.EXPO_ASC_ISSUER_ID;
if (!keyPath || !kid || !iss) throw new Error('Missing EXPO_ASC_* env vars');

const token = jwt.sign({}, fs.readFileSync(keyPath), {
  algorithm: 'ES256',
  expiresIn: '15m',
  audience: 'appstoreconnect-v1',
  issuer: iss,
  keyid: kid,
});

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// 1. Bundle ID (create if missing)
const existing = await api('GET', `/bundleIds?filter[identifier]=${BUNDLE_ID}`);
let bundleResourceId = existing.data?.find((d) => d.attributes.identifier === BUNDLE_ID)?.id;
if (!bundleResourceId) {
  const created = await api('POST', '/bundleIds', {
    data: { type: 'bundleIds', attributes: { identifier: BUNDLE_ID, name: 'InspectPro', platform: 'IOS' } },
  });
  bundleResourceId = created.data.id;
  console.log('Registered bundle ID', BUNDLE_ID);
} else {
  console.log('Bundle ID already registered');
}

// 2. Fresh key + CSR
execFileSync('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'dist.key', '-out', 'dist.csr', '-subj', '/CN=InspectPro Distribution/O=Josh Cargile']);
const csrContent = fs
  .readFileSync('dist.csr', 'utf8')
  .replace(/-----(BEGIN|END) CERTIFICATE REQUEST-----/g, '')
  .replace(/\n/g, '');

// 3. Distribution certificate. Apple allows one active iOS distribution cert
// and our previous run's private key died with its CI machine — revoke stale
// certs first (safe: revocation never affects builds already in TestFlight;
// this team's distribution certs exist solely for this pipeline).
const existingCerts = await api('GET', '/certificates?filter[certificateType]=IOS_DISTRIBUTION&limit=20');
for (const c of existingCerts.data ?? []) {
  await api('DELETE', `/certificates/${c.id}`);
  console.log('Revoked stale distribution certificate', c.id);
}
const cert = await api('POST', '/certificates', {
  data: { type: 'certificates', attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent } },
});
fs.writeFileSync('dist.cer', Buffer.from(cert.data.attributes.certificateContent, 'base64'));
console.log('Created distribution certificate', cert.data.id);

// 4. Bundle into a p12 for EAS
execFileSync('openssl', ['x509', '-inform', 'DER', '-in', 'dist.cer', '-out', 'dist.pem']);
const p12Password = 'inspectpro-' + Math.random().toString(36).slice(2, 10);
try {
  execFileSync('openssl', ['pkcs12', '-export', '-legacy', '-out', 'dist.p12', '-inkey', 'dist.key', '-in', 'dist.pem', '-password', `pass:${p12Password}`]);
} catch {
  execFileSync('openssl', ['pkcs12', '-export', '-out', 'dist.p12', '-inkey', 'dist.key', '-in', 'dist.pem', '-password', `pass:${p12Password}`]);
}

// 5. App Store provisioning profile
const profile = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: `inspectpro appstore ${Date.now()}`, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundleResourceId } },
      certificates: { data: [{ type: 'certificates', id: cert.data.id }] },
    },
  },
});
fs.writeFileSync('inspectpro.mobileprovision', Buffer.from(profile.data.attributes.profileContent, 'base64'));
console.log('Created provisioning profile', profile.data.id);

// 6. Local credentials for eas build
fs.writeFileSync(
  'credentials.json',
  JSON.stringify(
    {
      ios: {
        provisioningProfilePath: 'inspectpro.mobileprovision',
        distributionCertificate: { path: 'dist.p12', password: p12Password },
      },
    },
    null,
    2,
  ),
);
console.log('credentials.json written — ready for eas build');
