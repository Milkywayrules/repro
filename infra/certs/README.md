# Local TLS certs

Hostnames come from [`product.ts`](../packages/env/src/lib/product.ts) (`localBaseDomain`, e.g. `userepro.test`). Certs and nginx paths are set by `bun run setup:local`.

## Manual mkcert (if not using setup:local)

Replace `{local-base}` with `localBaseDomain` from `packages/env/src/lib/product.ts` (e.g. `userepro.test`):

```bash
mkcert -cert-file infra/certs/local/{local-base}.pem \
       -key-file infra/certs/local/{local-base}-key.pem \
       "*.{local-base}" {local-base}
```

Symlinks (example for `userepro.test`):

```bash
sudo ln -sf "$PWD/infra/certs/local/userepro.test.pem" /etc/ssl/certs/userepro.test.pem
sudo ln -sf "$PWD/infra/certs/local/userepro.test-key.pem" /etc/ssl/private/userepro.test-key.pem
sudo ln -sf "$PWD/infra/nginx/local.conf" /etc/nginx/sites-enabled/local.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Windows browser (WSL2)

When dev servers run in WSL but you browse on **Windows**, import the WSL mkcert root CA into the **Windows** trust store (one-time per machine). Without this, Chrome/Edge on Windows will warn on `https://console.<local-base>` even though WSL trusts the cert.

### Find `rootCA.pem`

**WSL path** (what mkcert uses inside Linux):

```bash
echo "$(mkcert -CAROOT)/rootCA.pem"
```

**Windows path** (paste in File Explorer or the cert import dialog — distro name varies):

```bash
wslpath -w "$(mkcert -CAROOT)/rootCA.pem"
```

Example: `\\wsl.localhost\ubuntu-D\home\<user>\.local\share\mkcert\rootCA.pem`

`bun run setup:local` prints both paths in the summary when run from WSL.

### Import into Windows

1. Win+R → `certmgr.msc` → Enter
2. **Trusted Root Certification Authorities** → **Certificates**
3. Right-click → **All Tasks** → **Import…**
4. Browse to the Windows path above (change “Files of type” to **All Files** if `.pem` is hidden)
5. Store location: **Trusted Root Certification Authorities** → Finish

Verify: padlock on `https://console.<local-base>` in a Windows browser.

### Verify issuer on the site cert

```bash
openssl x509 -in "infra/certs/local/$(bun -e "import { localBaseDomain } from './packages/env/src/lib/product.ts'; console.log(localBaseDomain)")".pem -noout -issuer
```
