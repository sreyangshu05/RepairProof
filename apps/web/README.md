# RepairProof web foundation

React, TypeScript, Vite, Tailwind CSS and Radix primitives provide the browser application foundation. The UI follows shadcn/ui conventions (`components.json`) while keeping components owned by this repository.

## Structure

- `src/app`: router, shared providers, route loading and error boundaries.
- `src/components/ui`: accessible, reusable primitives. Keep domain workflows out of this folder.
- `src/components/layout`: shared shell and role-specific workspace layout boundaries.
- `src/features/<feature>`: feature-level forms and UI that coordinate domain interactions.
- `src/pages`: route-level composition. Pages should assemble feature components, not contain the whole product.
- `src/lib`: cross-cutting API, formatting, validation, and class utilities.

Role navigation is deliberately distinct for consumers, technicians, shop administrators and platform administrators. Authentication and authorization must be enforced by the backend; client route separation is a UX boundary only.

## Conventions

- Prefer semantic Tailwind tokens (`bg-card`, `text-muted-foreground`, `border-input`) from `src/index.css`; do not introduce one-off colors where a token applies.
- Use `FormField` for programmatic labels, hints and accessible errors. Use shared Zod schemas and the local React Hook Form resolver for client validation. Server validation remains authoritative.
- Use `apiGet` / `apiPost` from `src/lib/api.ts`; keep transport details out of presentational components. API errors are normalized before reaching feature UI.
- Keep loading and empty states explicit; route chunks use `PageLoading`, and reusable empty-state primitives are in `components/ui`.
- Every interactive control needs a visible focus state, keyboard operation, accessible name and a touch target of at least 44px where practical. Honor reduced motion.
- Do not put secrets in `VITE_*` variables: Vite embeds them in public bundles. Use `.env.example` as the local configuration template.

## Commands

Run from the repository root with pnpm:

- `pnpm --filter @repairproof/web dev`
- `pnpm --filter @repairproof/web typecheck`
- `pnpm --filter @repairproof/web build`
- `pnpm --filter @repairproof/web lint`
- `pnpm --filter @repairproof/web format:check`

Install workspace dependencies with the repository's declared pnpm version before using lint/format commands. Environment values are documented in `.env.example`.

Do not infer backend functionality from a rendered screen. The currently implemented API route families are documented in the repository-level [`docs/api-reference.md`](../../docs/api-reference.md) and the live Swagger document at `/api/docs`. In particular, the API route inventory does not define `/consumer/dashboard`, `/technician/workspace`, or the `/technician/cases/:id/...` namespace. Treat consumer and technician workflows that depend on those paths as incomplete until their client calls match real API contracts and are verified end-to-end. Lifecycle transitions must be decided by the backend; the UI is not the source of truth.

Local fictional fixtures, when enabled by `VITE_ENABLE_DEMO_FIXTURES=true` in development, are mock data and are not verified real-world information. Never silently substitute them for failed API responses. Evidence uses an upload-intent/storage/completion workflow; an object upload alone is not a finalized evidence record. These notes describe the intended client pattern and do not claim a live browser-to-database workflow has passed.
