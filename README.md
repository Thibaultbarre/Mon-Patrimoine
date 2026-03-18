# Mon Patrimoine 💰

Tableau de bord de projections patrimoniales — Next.js + shadcn/ui + Recharts.

---

## Installation

### 1. Installer Node.js

Télécharge et installe Node.js depuis **https://nodejs.org** (choisis la version LTS).

Pour vérifier que c'est installé, ouvre un terminal et tape :
```
node -v
```

### 2. Lancer le projet

Ouvre un terminal dans le dossier `patrimoine/`, puis :

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

Ouvre ensuite **http://localhost:3000** dans ton navigateur. 🎉

---

## Déployer sur Vercel (gratuit)

1. Crée un compte sur **https://vercel.com**
2. Installe l'outil Vercel : `npm i -g vercel`
3. Dans le dossier du projet : `vercel`
4. Suis les instructions — ton app sera en ligne en 2 minutes

---

## Structure du projet

```
patrimoine/
├── app/
│   ├── globals.css       # Thème shadcn/ui (dark mode)
│   ├── layout.tsx        # Layout principal + font Inter
│   └── page.tsx          # Dashboard complet
├── components/ui/        # Composants shadcn/ui
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── badge.tsx
│   └── separator.tsx
├── lib/utils.ts          # Helper cn()
├── package.json
└── tailwind.config.ts
```
