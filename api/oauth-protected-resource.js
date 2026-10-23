export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    resource: 'https://moont.ai/mcp',
    authorization_servers: ['https://moont.ai'],
    scopes_supported: ['projects:read', 'projects:write'],
    resource_documentation: 'https://moont.ai/privacidade',
    resource_policy_uri: 'https://moont.ai/privacidade',
    resource_tos_uri: 'https://moont.ai/termos',
  });
}
