# ecommerce-api-nodejs

An open source ecommerce api built with Node.js, Express.js, MongoDB, and Stripe.

[![Stars](https://img.shields.io/github/stars/nixrajput/ecommerce-api-nodejs?label=Stars)][repo]
[![Forks](https://img.shields.io/github/forks/nixrajput/ecommerce-api-nodejs?label=Forks)][repo]
[![Watchers](https://img.shields.io/github/watchers/nixrajput/ecommerce-api-nodejs?label=Watchers)][repo]
[![Contributors](https://img.shields.io/github/contributors/nixrajput/ecommerce-api-nodejs?label=Contributors)][repo]

[![GitHub last commit](https://img.shields.io/github/last-commit/nixrajput/ecommerce-api-nodejs?label=Last+Commit)][repo]
[![GitHub issues](https://img.shields.io/github/issues/nixrajput/ecommerce-api-nodejs?label=Issues)][issues]
[![GitHub pull requests](https://img.shields.io/github/issues-pr/nixrajput/ecommerce-api-nodejs?label=Pull+Requests)][pulls]
[![GitHub Licence](https://img.shields.io/github/license/nixrajput/ecommerce-api-nodejs?label=Licence)][license]

## Features

- User Authentication
- Add Product to Cart
- Buy Product
- Payment Checkout
- Add Review
- Add Rating

## Usage

- Clone the repository

```bash
git clone https://github.com/nixrajput/ecommerce-api-nodejs.git
```

- Install required modules
  
```bash
npm install
```

- Create a new file `config.env` in root directory and add following variables.
  
```env
PORT = 4000

DB_URI = 'YOUR MONGODB URI'
DB_NAME = 'ecommerce'

NODE_ENV = 'dev'

JWT_SECRET = 'YOUR JWT SECRET'
JWT_EXPIRES_IN = 7d

COOKIE_EXPIRES_IN = 5

SMTP_FROM = 'Test <noreply@yourcompany.com>'

SENDGRID_API_KEY = 'YOUR SENDGRID API KEY'

# Cloudinary
CLOUDINARY_CLOUD_NAME = 'YOUR CLOUDINARY CLOUD NAME'
CLOUDINARY_API_KEY = 'YOUR CLOUDINARY API KEY'
CLOUDINARY_API_SECRET = 'YOUR CLOUDINARY API SECRET'

# STRIPE CONFIG
STRIPE_API_KEY = 'YOUR STRIPE API KEY'
STRIPE_SECRET_KEY = 'YOUR STRIPE SECRET KEY'
```

- Run the server

```bash
npm run dev
```

## Activities

![Alt](https://repobeats.axiom.co/api/embed/f958e8d373d422293e33c9fb24257cfd2c8dfc24.svg "Repobeats analytics image")

## Connect With Me

[![Instagram: nixrajput](https://img.shields.io/badge/nixrajput-141430?logo=Instagram&logoColor=fff)][instagram]
[![Linkedin: nixrajput](https://img.shields.io/badge/nixrajput-141430?logo=Linkedin&logoColor=fff)][linkedin]
[![GitHub: nixrajput](https://img.shields.io/badge/nixrajput-141430?logo=Github&logoColor=fff)][github]
[![Twitter: nixrajput07](https://img.shields.io/badge/nixrajput07-141430?logo=Twitter&logoColor=fff)][twitter]
[![Facebook: nixrajput07](https://img.shields.io/badge/nixrajput07-141430?logo=Facebook&logoColor=fff)][facebook]

[github]: https://github.com/nixrajput
[facebook]: https://facebook.com/nixrajput07
[twitter]: https://twitter.com/nixrajput07
[instagram]: https://instagram.com/nixrajput
[linkedin]: https://linkedin.com/in/nixrajput
[repo]: https://github.com/nixrajput/ecommerce-api-nodejs
[issues]: https://github.com/nixrajput/ecommerce-api-nodejs/issues
[pulls]: https://github.com/nixrajput/ecommerce-api-nodejs/pulls
[license]: https://github.com/nixrajput/ecommerce-api-nodejs/blob/master/LICENSE.md
