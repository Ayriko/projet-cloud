#!/bin/sh
# Génère config.js depuis les variables d'environnement au démarrage du conteneur.
# Exécuté automatiquement par l'image nginx (scripts dans /docker-entrypoint.d/).
set -e

cat > /usr/share/nginx/html/config.js <<EOF
window.APP_CONFIG = {
  AUTH_URL: "${AUTH_URL:-}",
  CORE_URL: "${CORE_URL:-}"
};
EOF

echo "config.js generated (AUTH_URL=${AUTH_URL:-}, CORE_URL=${CORE_URL:-})"
