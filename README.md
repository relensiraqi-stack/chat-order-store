# Chat Order Store

Run small online stores with a shareable link: customers browse your products, check out with pickup or delivery, pay you directly and send you the order in a chat.

Inspired by https://take.app

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create stores with a link, currency, chat number, opening switch, pickup, flat-fee delivery, tax and manual payment methods.
- Manage categories and products with photos, sizes, add-ons and stock counts.
- Customers order from the public store link with a cart, options, a date and time and a promo code.
- Customers get a private order page and a ready-made order message to copy or send in a chat.
- Work through orders newest first with search, filters and status changes, and enter phone or counter orders by hand.
- Customers upload a payment proof; you view it and mark the order paid or reject it.
- Create promo codes with percent or fixed discounts, minimums, usage limits and end dates.

Left out: accounts and sign-in, which your Gateway handles; card payment processors; chat automation and broadcasts; distance-based delivery and couriers; reservations; analytics, imports and integrations; store themes and custom domains; native apps.

## Setup

Needs an EveryApp Gateway and a Cloudflare account with R2 turned on. There are no secrets or settings to fill in.

```sh
pnpm install
pnpm dev            # run locally behind the local launcher
pnpm test           # unit tests
pnpm run deploy     # deploy to your Gateway
```

The checks in `checks/` run against a packaged release with the oss.new runtime.

## Limitations

- Every member of your organization can create stores; each store is managed only by the member who created it. Admins can see every store and unpublish any.
- Stores live at `/s/<link>` on the app's address; custom domains aren't supported.
- The app never handles money: customers pay you directly, and you confirm payments by hand.
- The chat button opens a WhatsApp link to the store's number; it was not exercised in local tests.
