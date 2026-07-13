# Deploy on Kubernetes

Reference manifests live in [`deploy/kubernetes/`](https://github.com/predator2003/enclosed/tree/main/deploy/kubernetes) in the repository. They deploy the app with a hardened pod security context, persistent storage, and an ingress with TLS.

## Architecture facts that shape the deployment

| Fact | Consequence |
| --- | --- |
| Notes are stored on the local filesystem (`fs-lite` driver, `/app/.data`) | A `PersistentVolumeClaim` is required; run **exactly 1 replica** with the `Recreate` strategy (single-writer store on a RWO volume) |
| Client-side encryption uses the browser WebCrypto API, which requires a secure context | The ingress **must terminate TLS** — over plain HTTP the app cannot encrypt/decrypt |
| The container listens on port `8787` and exposes `GET /api/ping` | Use it for readiness/liveness probes |
| Expired notes are cleaned up by an in-process cron task | No Kubernetes `CronJob` needed |
| The server refuses to start when authentication is required and `AUTHENTICATION_JWT_SECRET` is still the default | Always set the secret via a Kubernetes `Secret` |
| The image runs as UID/GID 1000 (non-root) | Set `fsGroup: 1000` so the volume is writable; `PUID`/`PGID` env vars are **not** supported |

## Quick start

```bash
# Build and push your image (this fork bakes the branding in at build time)
docker build -t <registry>/enclosed:v1.16.0 .
docker push <registry>/enclosed:v1.16.0

cd deploy/kubernetes

# Create the secret from the example, set AUTHENTICATION_JWT_SECRET
cp secret.example.yaml secret.yaml
# openssl rand -base64 48

# Adjust the hostname in ingress.yaml and the image in deployment.yaml, then:
kubectl apply -k .
```

## Upload size

The ingress body-size limit must be at least `NOTES_MAX_ENCRYPTED_PAYLOAD_LENGTH` (default 50 MiB) plus some headroom, e.g. for ingress-nginx:

```yaml
nginx.ingress.kubernetes.io/proxy-body-size: 64m
```

If you raise the app limit, raise the ingress limit too, and consider raising `SERVER_API_ROUTES_TIMEOUT_MS` for slow uplinks.

## Using an agent to deploy

If you use Claude Code with cluster access, this prompt generates and applies a complete deployment (adapt the `# ADAPT` lines):

```text
Deploy the self-hosted app "Enclosed" (encrypted notes) to our Kubernetes cluster,
using the reference manifests in deploy/kubernetes/ of this repository as the base.

CONTEXT / ADAPT:
- Namespace:          enclosed
- Image:              <registry>/enclosed:v1.16.0   # ADAPT: your built image
- Ingress hostname:   notes.example.com             # ADAPT
- IngressClass:       nginx                         # ADAPT (traefik, ...)
- TLS:                cert-manager ClusterIssuer "letsencrypt-prod"  # ADAPT
- Storage:            1Gi ReadWriteOnce for /app/.data

REQUIREMENTS:
1. Generate AUTHENTICATION_JWT_SECRET with `openssl rand -base64 48` and create the
   secret with `kubectl create secret` (do not commit it).
2. Keep replicas at 1 with strategy Recreate (single-writer fs storage on RWO volume).
3. Keep the hardened securityContext (runAsNonRoot 1000, fsGroup 1000,
   readOnlyRootFilesystem, drop ALL capabilities).
4. Probes on GET /api/ping port 8787.
5. Ingress with TLS (HTTPS is mandatory for the in-browser encryption) and
   proxy-body-size >= 64m.
6. Apply everything, wait for the pod to be Ready, then show
   `kubectl -n enclosed get pods,svc,ingress` and the final HTTPS URL.
Explain each step briefly before you run it.
```

## Troubleshooting

- **`permission denied` on `/app/.data`** — the volume is not writable for UID 1000: check `fsGroup: 1000`, or add an initContainer that runs `chown -R 1000:1000 /app/.data`.
- **"insecure connection" warning in the app / cannot create notes** — the app is served without HTTPS; fix TLS at the ingress.
- **Uploads fail around 1 MiB** — the ingress body-size limit is at its default; set `proxy-body-size` (see above).
- **Pod stuck in `Pending`** — no default StorageClass; set `storageClassName` in `pvc.yaml`.
