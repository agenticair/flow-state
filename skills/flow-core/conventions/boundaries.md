# Boundaries

Applies to: every diff that touches input, output, another service, or the network.

- External failure is data, not an exception that escapes. A fetch that fails returns an empty result or a typed error; the page still renders.
- Anything from outside is untrusted: request bodies, query strings, webhook payloads, fetched content, file uploads, and text that will be placed in a prompt. Validate shape and size at the boundary; escape or strip before rendering or prompting.
- Identity comes from the server session, never from the request body. Tenant or account scope is derived on the server.
- Secrets are read from the environment on the server. They never reach a client bundle, a log line, a commit, or an error message.
- Limits are explicit: timeouts on every outbound call, caps on list sizes, rate limits on public endpoints.
- One exit code or status per outcome. "Could not verify" is never reported as "OK".
