CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_store_idx` ON `categories` (`store_id`);--> statement-breakpoint
CREATE TABLE `option_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`max_select` integer,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `option_groups_product_idx` ON `option_groups` (`product_id`);--> statement-breakpoint
CREATE TABLE `options` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`price_delta_cents` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `options_group_idx` ON `options` (`group_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`options_text` text DEFAULT '[]' NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	`stock_tracked` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`number` integer NOT NULL,
	`token` text NOT NULL,
	`source` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`service` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`scheduled_for` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`payment_method_id` text,
	`payment_kind` text NOT NULL,
	`payment_label` text NOT NULL,
	`payment_instructions` text DEFAULT '' NOT NULL,
	`require_proof` integer DEFAULT false NOT NULL,
	`currency` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`discount_cents` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`promo_id` text,
	`promo_code` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`proof_key` text,
	`proof_type` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_store_number` ON `orders` (`store_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_token` ON `orders` (`token`);--> statement-breakpoint
CREATE INDEX `orders_store_created` ON `orders` (`store_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`require_proof` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_methods_store_kind` ON `payment_methods` (`store_id`,`kind`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`image_key` text,
	`image_type` text,
	`available` integer DEFAULT true NOT NULL,
	`track_stock` integer DEFAULT false NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "products_stock_nonnegative" CHECK("products"."stock" >= 0)
);
--> statement-breakpoint
CREATE INDEX `products_store_idx` ON `products` (`store_id`);--> statement-breakpoint
CREATE TABLE `promos` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`min_subtotal_cents` integer,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`ends_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "promos_uses_within_limit" CHECK("promos"."uses" >= 0 AND ("promos"."max_uses" IS NULL OR "promos"."uses" <= "promos"."max_uses"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promos_store_code` ON `promos` (`store_id`,`code`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`is_open` integer DEFAULT true NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`pickup_enabled` integer DEFAULT true NOT NULL,
	`delivery_enabled` integer DEFAULT false NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`tax_bps` integer DEFAULT 0 NOT NULL,
	`next_order_no` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_slug_unique` ON `stores` (`slug`);--> statement-breakpoint
CREATE INDEX `stores_owner_idx` ON `stores` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
