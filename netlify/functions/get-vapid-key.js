import { getVapidPublicKey } from './lib/push.js';

export default async (req, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return new Response(
      JSON.stringify({ error: 'VAPID public key not configured on server' }),
      { status: 500, headers }
    );
  }

  return new Response(JSON.stringify({ publicKey }), {
    status: 200,
    headers
  });
};
