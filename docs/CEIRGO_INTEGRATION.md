# CeirGO Integration — Sadam Gadget

Branch deployment: `feature/v2-pos-mobile-analytics`.

## Scope
Staff-only menu **Admin → Cek IMEI**. The existing local IMEI validation, inventory, POS scan, sales and stock mutation are unchanged.

Services (one IMEI, one paid service per request): `cek_imei`, `cek_sf`, `cek_digi`, `cek_imei_beacukai`, `cek_validity`. SIM Lock and IMEI registration/activation are **not** supported by CeirGO's documented endpoints.

### Activation and spending rules
* No key, manual pause, missing funds, or CeirGO 401/402/403: **"Belum bisa digunakan, silakan aktivasi terlebih dahulu."**
* Endpoint `GET /api/imei-check/status?service_code=cek_imei` performs **only read operations**: `GET /api/wallet/snap` and `GET /api/services/{code}`. It checks actual account price and available balance. It does not create an order.
* `POST /api/imei-check` requires staff login, 15-digit Luhn-valid IMEI, and sufficient balance. It performs a **second preflight** then **one** (never automatically retried) paid `POST /api/order`.
* A human confirmation in the admin page shows the current provider price before attempting the paid request. Staff must avoid clicking repeatedly.
* Invalid key/permissions and insufficient balance do not result in fabricated IMEI statuses.
* CeirGO `429` or `503` is **not** interpreted as BLOCKED.
* A request timeout **after** the paid POST has an uncertain outcome. Do **not** immediately retry; inspect CeirGO order history first.
* Pending orders can be polled via `GET /api/imei-check/orders/{id}` by the staff member who submitted them, using provider order detail (read-only).
* API responses are filtered to status and validity date. Confidential IMEI histories / IMSI / MSISDN are not returned to the frontend.

## Environment (set on VPS only; never commit secrets)
In the backend service's environment, configure:

```env
CEIRGO_ENABLED=true
CEIRGO_API_KEY=YOUR_SECRET_FROM_CEIRGO_DASHBOARD
```

If the key isn't configured, the feature still loads and shows the activation-required message. To temporarily disable paid operations, use `CEIRGO_ENABLED=false`; activation then requires switching it back to true.

Minimum relevant CeirGO API key permissions:
- `wallet.balance.read` — available balance
- `service.read_detail` — service pricing and availability
- `order.create` — paid IMEI lookup
- `order.read` — pending order polling

Create/manage keys at: https://ceirgo.id/dashboard/apikey/new
Official API documentation: https://ceirgo.id/docs
Never put credentials in the React build or browser environment.

**Important:** balance alone is not enough: the CeirGO API key must have each required permission. No deposit or paid order is created by these integration tests.

## Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/imei-check/services` | GET | Read-only supported service list |
| `/api/imei-check/status?service_code=cek_imei` | GET | Balance + service availability preflight |
| `/api/imei-check` | POST | Paid IMEI lookup; JSON `{"imei":"<15-digit>","service_code":"cek_imei"}` |
| `/api/imei-check/orders/{id}` | GET | Read-only pending order refresh (owner of order only) |

All routes require an authenticated owner/admin/staf role. Admin page: `/admin/cek-imei`.
`/api/pos/lookup` and `/api/inventory/validate-imei` continue as LOCAL stock checks.

## Local offline tests

```bash
cd backend
python -m pytest -q tests/test_ceirgo_integration.py
```

Tests use mocked HTTP responses. They never contact CeirGO or use an actual account.

## OpenClaw deployment runbook

1. Back up the existing working release and production database. Verify current git status before pulling. **Do not discard VPS-only config changes.**
2. On the VPS, navigate to the existing project directory, e.g. `~/toko-hp-v2`, then:
   ```bash
   git fetch origin
   git switch feature/v2-pos-mobile-analytics
   git pull --ff-only origin feature/v2-pos-mobile-analytics
   ```
3. Check how the existing VPS deploy supplies backend environment variables (backend `.env` file or Docker Compose env). Add the key **only on the VPS** and ensure it is NOT exposed to frontend or committed.
4. If no key or deposit exists yet, leave `CEIRGO_API_KEY` unset and still deploy. Page must show activation text; no order should be placed.
5. Run backend unit tests (command above) using the project's installed Python environment.
6. Rebuild/restart **only** the existing backend and frontend services using the VPS's current deployment scripts/Compose definitions. No repository Docker Compose file is assumed.
7. Smoke test: log in as staff; visit `/admin/cek-imei`, select each service, press Refresh Status, confirm activation message without credentials. Check inventory/POS scans still work unchanged.
8. Once a valid CeirGO key is configured, run read-only status first. Do not initiate a paid lookup until the user approves spending real balance.
9. After any deploy, check API logs without exposing API keys, balance, passports, IMSI or full IMEI numbers.

## Provider behavior notes
- CeirGO's `cek_imei` may return `UNKNOWN`. It is **not** equivalent to confirmed `BLOCKED`.
- `cek_validity` reports provider dates when available; it does not activate IMEI.
- Backend performs no CeirGO calls at application startup.
- Integration does not prove CeirGO has official government database access; evaluate provider authorization separately.
