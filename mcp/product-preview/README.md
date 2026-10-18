# MCP product previews

Customer server version 1.1.0, deployed 2026-10-18 to `desygn-customer-mcp`.

The custom-shirt flow previously saved only text. This extension uses the existing Desygn Lab upload, design, and supplier mockup APIs through the store service binding. It adds `get_custom_shirt_options`, `create_product_preview`, and `get_product_preview`, then requires a ready, same-owner `preview_id` on custom-shirt drafts.

The review page displays the selected product mockup, garment options, and resolution warnings. Original PNG artwork and the approved garment/placement reference are passed to the existing staff-quote order flow only after customer submission. Published shirt drafts display their verified variant image. The shared page shell uses the storefront logo, cream background, blue accents, navigation, and footer.

## Preserved behavior

- Existing OAuth identities, permissions, databases, bindings, and payment handling are preserved.
- Preview tools do not create store orders, publish products, or charge money.
- Preview metadata and private studio session cookies are stored in the existing OAuth KV namespace, scoped to the owning connection, for 30 days. Cookie values are never returned to the client.
- Retries reuse request keys; supplier mockups are polled after a 15-second interval.
- Artwork accepts a PNG up to 10 MB. Downloads are bounded and restricted to HTTPS OpenAI/Desygn Shop hosts with redirects disabled.
- Existing custom drafts without previews must be recreated with artwork before submission.

## Deployment

`patch-worker.mjs` guards the exact known 2026-10-17 application bundle anchors and throws if they no longer match. It adds an import of `product-preview.mjs`; upload both modules together while retaining the existing runtime configuration and binding types. Do not replace the OAuth implementation or recreate resources.

Only the customer Worker was deployed. Applying the prepared extension to `desygn-shop-mcp` was rejected by automatic approval review because the separate production Admin service is outside the clearly authorized customer-facing update. Obtain explicit user approval before applying it there. The original `/mcp-order` test link belongs to that unchanged Admin service; customer links use `/customer-order`.

## Verification

Run `node --test product-preview.test.mjs`. The tests cover the upload/design/mockup/draft/attachment flow with mocked supplier responses, same-owner enforcement, retry behavior, malformed input, URL restrictions, HTML escaping, and preserved cookie/CSP protections.

The live customer page and health check were verified after deployment. Shirt and print catalogs and the existing payment connection remained available. A live supplier mockup and new customer draft have not yet been exercised through ChatGPT: this conversation still exposes the previous MCP tool schema. Do not describe the original birthday artwork as attached or the birthday test as complete.

Customer deployment: `31e4768214c94c7facb97af64bc58a77` (Unicode-preserving module update).