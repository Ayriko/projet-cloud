// Défauts pour le dev local. En prod, ce fichier est régénéré au démarrage
// du conteneur Nginx à partir des variables d'environnement AUTH_URL / CORE_URL.
window.APP_CONFIG = {
  AUTH_URL: "http://localhost:8080",
  CORE_URL: "http://localhost:8081",
};
