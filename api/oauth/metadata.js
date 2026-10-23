export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    issuer: 'https://moont.ai', authorization_endpoint: 'https://moont.ai/oauth/authorize',
    token_endpoint: 'https://moont.ai/oauth/token', registration_endpoint: 'https://moont.ai/oauth/register',
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['projects:read', 'projects:write'],
  });
}
