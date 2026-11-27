# Authentication

## Provider and token flow

Supabase Auth is the identity provider. The browser obtains an access token through the Supabase client, then sends it as `Authorization: Bearer <token>` to protected NestJS routes. The API validates it through Supabase Auth and resolves the local RepairProof profile and organization membership before exposing domain data. `SUPABASE_SERVICE_ROLE_KEY` is server-only for privileged provider operations and is not used to accept request bearer tokens.

Public auth controller operations include signup, login, OTP request and OTP verification. Actual email delivery depends on Supabase Auth SMTP/provider configuration. OTP responses are designed to avoid account enumeration. Users must still have an appropriate local profile/membership and role for tenant features.

## Browser/session handling

The frontend auth store coordinates Supabase session state. Never treat a route guard or hidden control as authorization: every API request is independently authenticated and authorized. Sign-out clears browser session state. Use HTTPS in deployed environments and avoid putting tokens in URLs, logs, analytics, screenshots or support tickets.

## Operational guidance

- Configure Supabase redirect URLs and allowed origins per environment.
- Keep `SUPABASE_ANON_KEY` public-only and `SUPABASE_SERVICE_ROLE_KEY` secret.
- Configure CORS allowlist with exact origins and trusted proxy hops correctly.
- Revoke compromised sessions through Supabase operational controls; disable the local account through authorized platform administration when required.
- Use explicit platform-admin grant/revoke CLI with reason; no public signup path grants that role.

## Boundaries and caveats

Authentication establishes a Supabase identity; it does not prove repair expertise, organization legitimacy, device ownership, or evidence truth. Customer bearer authorization links are disabled by default (`CUSTOMER_AUTHORIZATION_ENABLED=false`) and must not be confused with normal user authentication. Public certificate lookup exposes only certificate-safe information; it must not expose evidence or private device/customer identifiers.
