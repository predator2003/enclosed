# Kubernetes deployment

Reference manifests for running this Enclosed fork (WEIN & CO Notes) on Kubernetes.
See the full guide with explanations in [`docs: Self-hosting → Kubernetes`](../../packages/docs/src/self-hosting/kubernetes.md).

## Quick start

```bash
# 1. Build and push the branded image (the branding is baked in at build time)
docker build -t ghcr.io/predator2003/enclosed:v1.16.0-weinco .
docker push ghcr.io/predator2003/enclosed:v1.16.0-weinco

# 2. Create the secret
cp secret.example.yaml secret.yaml
# edit secret.yaml: set AUTHENTICATION_JWT_SECRET (openssl rand -base64 48)
# then uncomment "- secret.yaml" in kustomization.yaml

# 3. Adjust notes.example.com in ingress.yaml, then deploy
kubectl apply -k .

# 4. Check
kubectl -n enclosed get pods
kubectl -n enclosed logs deploy/enclosed
```

## Important operational notes

- **HTTPS is mandatory.** The client-side encryption uses the browser WebCrypto API,
  which is only available in secure contexts. Plain HTTP will show a warning and
  note creation will not work.
- **Exactly 1 replica.** The default fs-lite storage is a single-writer embedded
  store on the PVC. Do not scale the Deployment horizontally.
- **Non-root:** the manifests run the pod as UID/GID 1000 with `fsGroup: 1000`.
  `PUID`/`PGID` environment variables are not supported by the image.
- **Upload size:** the ingress `proxy-body-size` must be at least
  `NOTES_MAX_ENCRYPTED_PAYLOAD_LENGTH` (default 50 MiB) plus headroom.
- **JWT secret:** the server refuses to start when authentication is enabled and
  `AUTHENTICATION_JWT_SECRET` is still the default value.
- **Backups:** all notes are encrypted client-side; backing up the PVC never
  exposes plaintext.
