# VALORY backend simple

## Ce que ça fait
- Affiche ton site sur `/`
- Affiche l'admin sur `/admin`
- Enregistre les commandes dans `data/orders.json`
- Enregistre les produits dans `data/products.json`
- Permet d'ajouter, modifier et supprimer des articles
- Met à jour le stock quand une commande est passée

## Mot de passe admin
Par défaut : `valory123`

Pour le changer en production, ajoute une variable d'environnement :
`ADMIN_PASSWORD=tonmotdepasse`

## Lancer sur ordinateur
```bash
npm install
npm start
```
Puis ouvre : `http://localhost:3000`

## Déployer
Ce projet ne marche pas sur Netlify Drop simple, car Netlify Drop héberge surtout des fichiers statiques. Il faut un hébergeur Node.js comme Render, Railway, Fly.io ou un VPS.
