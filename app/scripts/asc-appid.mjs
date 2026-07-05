/**
 * Resolves the App Store Connect app ID (ascAppId) for our bundle ID and
 * injects it into eas.json's submit profile so `eas submit` can run
 * non-interactively. The app record must already exist in App Store Connect.
 */
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

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

const res = await fetch(`https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${BUNDLE_ID}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await res.json();
if (!res.ok) throw new Error(JSON.stringify(body));
const app = body.data?.[0];
if (!app) {
  throw new Error(
    `No App Store Connect app found for ${BUNDLE_ID}. Create it once at appstoreconnect.apple.com: ` +
      'My Apps -> + -> New App -> iOS, pick the bundle ID, any unique name, SKU "inspectpro".',
  );
}
console.log('ascAppId:', app.id, '-', app.attributes.name);

const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
eas.submit = eas.submit ?? {};
eas.submit.production = eas.submit.production ?? {};
eas.submit.production.ios = { ...(eas.submit.production.ios ?? {}), ascAppId: app.id };
fs.writeFileSync('eas.json', JSON.stringify(eas, null, 2));
console.log('eas.json submit profile updated');
