# The Desygn Shop Frontend

Static GitHub Pages frontend for The Desygn Shop. The site uses the official brand palette and logo, displays the current Wix catalog, and sends purchase traffic to Wix product pages for product options, cart, payment, and order management.

## Commerce architecture

- GitHub Pages: branded customer-facing website
- Wix Stores: catalog, product detail, cart, checkout, customer accounts, and orders
- Printful: connect directly to Wix for automatic product and fulfillment synchronization
- SinaLite: list through Wix and fulfill manually initially, or automate later through SinaLite's API

## Publish to GitHub Pages

1. Create a public GitHub repository named `desygn-shop-web`.
2. Upload the contents of this directory to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.

## Wix storefront target

`https://cmdesygns6.wixsite.com/the-desygn-shop`

All product cards use exact Wix product URLs retrieved from the Wix Stores V3 catalog on July 20, 2026.
