# Restaurant Management (POS) — Node.js + MySQL
## Run locally
1. `npm install`
2. Set `DB_NAME=restro` in `.env` to use your existing `restro` database. If it already has this application's tables and data, do not run the schema or seed scripts.
3. Create a restricted account for the app (choose your own strong password):
   ```sql
   CREATE USER 'restaurant_app'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON restro.* TO 'restaurant_app'@'localhost';
   ```
   Run these statements in MySQL Workbench while connected as a MySQL administrator. If this user already exists, use `ALTER USER` to set its password instead of running `CREATE USER` again.
4. Set `DB_USER=restaurant_app` and `DB_PASSWORD` in `.env` to the account name and the same password you chose above. Keep `DB_NAME=restro`.
5. Run `npm start` and open http://localhost:3000. Sign in or create an account from the single-page app.
6. Sign up. The first account becomes Admin.

If you prefer to use `root`, set `DB_USER=root` and `DB_PASSWORD` to the actual MySQL root password. `ER_ACCESS_DENIED_ERROR` means MySQL rejected the login; the database name and grants do not fix an incorrect password. The app cannot retrieve or reset a MySQL password. Verify the account can log in from `localhost` and that `.env` contains that account's password.

For a new installation only, connect as a MySQL administrator and run `SOURCE database/schema.sql;` followed by `SOURCE database/seed.sql;`. These scripts create and populate `restro`.

## Importing the POS menu
Configure the database connection in `.env`, then run `npm run import:menu`. This imports `pos_menu_items.csv` into the configured database, creates any missing categories, and can be rerun safely using each CSV `item_id` as the item SKU. Existing image URLs are preserved when the CSV has no `image_url` value. To display real menu photos, add an `image_url` column to the CSV or set Picture URL when creating an item in Menu management. Image URLs can be web URLs or local public paths such as `/images/menu/photo.jpg`. The supplied CSV has image prompts but no actual image files or URLs.

The importer adds the `description`, `image_prompt`, and `image_url` columns to an existing `items` table when needed. For a new database, these columns are included in `database/schema.sql`.

Menu photos are served from `public/images/menu/`. Photo source, author, and license information is recorded in `public/images/menu/credits.json`; retain these credits when redistributing the images.

For an existing database, run `npm run migrate:checkout` once to add the discount and round-off order fields and a unique customer mobile-number index used by POS customer lookup.

POS checkout requires a customer name and mobile number; entering a previously used number fills the saved customer details. “Pay & print bill” opens a checkout summary where discount and round-off are applied before payment. Customer details and price adjustments are saved on the order and printed bill.
## Folders
database/ (SQL scripts) · config/ · middleware/ · models/ · controllers/ · routes/ · public/ (HTML, CSS, JS) · server.js













for start the app run the below command
1 npm start 
2 login cred - himanshu1@gmail.com , pass - Admin@123