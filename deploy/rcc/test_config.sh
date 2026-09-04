#!/usr/bin/env bash
# deploy/rcc/test_config.sh — asserts the rendered production config is the
# RCC one: local builds kept, demo seeding off, admin-approve registration,
# frontend on loopback only, nothing else published, cloudflared only under
# the "public" profile.
set -euo pipefail
cd "$(dirname "$0")/../.."

export RCC_DOMAIN=test.example
export POSTGRES_PASSWORD=test-only-password
export JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
export CLOUDFLARE_TUNNEL_TOKEN=test-only-token

base=(docker compose -f docker-compose.prod.yml -f deploy/rcc/docker-compose.rcc.yml)
cfg=$("${base[@]}" config)
cfg_public=$("${base[@]}" --profile public config)

fail() { echo "FAIL: $1" >&2; exit 1; }
has() { grep -qE -- "$1" <<<"$cfg"; }
has_public() { grep -qE -- "$1" <<<"$cfg_public"; }

has 'SEED_DEMO: "false"'                                        || fail "demo seeding is not disabled"
has 'OE_REGISTRATION_MODE: admin-approve'                       || fail "registration mode is not admin-approve"
has 'OE_DEFAULT_REGISTRATION_ROLE: viewer'                      || fail "default registration role is not viewer"
has 'ALLOWED_ORIGINS: https://test\.example,http://localhost:8080' || fail "ALLOWED_ORIGINS must list the tunnel host and the loopback URL"
has 'target: api'                                               || fail "backend no longer builds the api target locally"
has 'dockerfile: deploy/docker/Dockerfile.frontend'             || fail "frontend no longer builds locally"
has 'host_ip: 127\.0\.0\.1' && has 'published: "8080"'          || fail "frontend is not bound to 127.0.0.1:8080"
has 'published: "80"'                                           && fail "port 80 is published"
has 'published: "443"'                                          && fail "port 443 is published"
has 'published: "5432"'                                         && fail "postgres is published to the host"
has_public 'image: cloudflare/cloudflared:'                     || fail "cloudflared missing under --profile public"
has_public 'TUNNEL_TOKEN: test-only-token'                      || fail "cloudflared does not receive the tunnel token"
# Profile membership, not absence: whether `config` omits inactive-profile
# services varies by Compose version, but the rendered profiles list does not.
grep -A3 '^  cloudflared:' <<<"$cfg_public" | grep -q 'profiles:' || fail "cloudflared is not behind the public profile"
grep -A5 '^  cloudflared:' <<<"$cfg_public" | grep -q -- '- public' || fail "cloudflared profile is not named public"

echo "OK: RCC production config"
