-- DropIndex
DROP INDEX "external_api_accounts_user_id_external_user_id_key";

-- CreateIndex
CREATE INDEX "external_api_accounts_user_id_idx" ON "external_api_accounts"("user_id");

-- CreateIndex
CREATE INDEX "external_api_accounts_external_user_id_idx" ON "external_api_accounts"("external_user_id");
