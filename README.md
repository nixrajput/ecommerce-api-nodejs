# E-commerce API with Node.js, Express, and JavaScript

This repository contains the source code for a E-commerce API built using Node.js Express, and JavaScript. This README.md file provides an overview of the project and instructions on how to set it up and customize it for your own use.

[![Stars](https://img.shields.io/github/stars/nixrajput/ecommerce-api-nodejs?label=Stars&style=flat)][repo]
[![Forks](https://img.shields.io/github/forks/nixrajput/ecommerce-api-nodejs?label=Forks&style=flat)][repo]
[![Watchers](https://img.shields.io/github/watchers/nixrajput/ecommerce-api-nodejs?label=Watchers&style=flat)][repo]
[![Contributors](https://img.shields.io/github/contributors/nixrajput/ecommerce-api-nodejs?label=Contributors&style=flat)][repo]

[![GitHub last commit](https://img.shields.io/github/last-commit/nixrajput/ecommerce-api-nodejs?label=Last+Commit&style=flat)][repo]
[![GitHub issues](https://img.shields.io/github/issues/nixrajput/ecommerce-api-nodejs?label=Issues&style=flat)][issues]
[![GitHub pull requests](https://img.shields.io/github/issues-pr/nixrajput/ecommerce-api-nodejs?label=Pull+Requests&style=flat)][pulls]
[![GitHub Licence](https://img.shields.io/github/license/nixrajput/ecommerce-api-nodejs?label=Licence&style=flat)][license]

## Table of Contents

- [E-commerce API with Node.js, Express, and JavaScript](#e-commerce-api-with-nodejs-express-and-javascript)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Configuration](#configuration)
    - [Database Setup](#database-setup)
    - [Running the Application](#running-the-application)
  - [Deployment](#deployment)
  - [Technologies Used](#technologies-used)
  - [Contributing](#contributing)
  - [License](#license)
  - [Sponsor Me](#sponsor-me)
  - [Connect With Me](#connect-with-me)

## Features

- **User Authentication:** Register, login, and manage user accounts with JWT-based authentication.
- **Product Management:** CRUD operations for products.
- **Shopping Cart:** Add, update, and remove items in the shopping cart.
- **Order Management:** Place orders and view order history.
- **Stripe Payment Gateway:** Integrate Stripe for secure payment processing.
- **MongoDB Integration:** Store and manage data using MongoDB.
- **Server-side Checkout Totals:** The API prices every order from the database: 18% GST, and shipping of ₹50 at ₹1000 or less (free above). The total is subtotal plus GST, the same as the web checkout shows. `POST /api/v1/payment/create` takes the cart as `orderItems` and ignores any `amount`. `POST /api/v1/order/new` ignores client prices and `paymentInfo.status`. It creates the order only after Stripe confirms that the PaymentIntent succeeded for that exact amount, and each PaymentIntent pays for one order only.
- **Sessions:** The API does not store tokens. Changing or resetting a password, or logging out, makes every older token of that account invalid on every device. `PUT /api/v1/password/update` returns a new token. `GET /api/v1/logout` needs the token in the `Authorization` header. A token issued in the same second as a logout is also rejected, because JWT times count whole seconds.
- **Rate Limiting:** Each client IP gets 10 requests per 15 minutes on the register, login and password routes, and 300 per 15 minutes on all routes. The limiter counts in memory per process. On Vercel, each serverless instance counts on its own.

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

You need to have the following software installed on your computer:

- [Node.js](https://nodejs.org/) 26
- [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/) or [Yarn](https://yarnpkg.com/) package manager
- Stripe account and API keys

### Installation

1. Star the repository.

2. Clone this repository to your local machine using the following command:

   ```bash
   git clone https://github.com/nixrajput/ecommerce-api-nodejs.git
   ```

3. Navigate to the project directory:

   ```bash
   cd ecommerce-api-nodejs
   ```

4. Install the project dependencies:

   If you're using npm:

   ```bash
   npm install
   ```

   If you're using pnpm:

   ```bash
   pnpm install
   ```

   If you're using Yarn:

   ```bash
   yarn install
   ```

### Configuration

Before running the application, you need to configure the environment variables. Copy the `.env.example` file to `.env.local` and fill in the necessary values.

```bash
cp .env.example .env.local
```

Two variables are required:

- `STRIPE_SECRET_KEY`: the API creates and checks Stripe payments with it.
- `FRONTEND_URL`: the base URL of your frontend. Password reset emails link to it.

### Database Setup

Make sure you have a database configured and running. Update the database connection details in the `.env.local` file.

### Running the Application

Once the dependencies are installed and the configuration is set up, you can start the application by running:

```bash
npm run dev
#or
pnpm run dev
# or
yarn dev
```

By default, the application will run on port `4000`. You can change the port by modifying the `PORT` environment variable in the `.env.local` file.

Run the tests with `pnpm test`. They need no database.

## Deployment

This API can be deployed using various platforms such as Vercel, Heroku, AWS, Google Cloud Platform, or your own server infrastructure.

Set up environment variables similar to how it's done in the local setup. Ensure that you provide appropriate values for your deployment environment.

Deploy the built application to your chosen platform. Each platform may have its own deployment process. Refer to the documentation of your chosen platform for detailed instructions.

Monitor the deployed application for any issues. Make sure that it's running smoothly and handle any errors or performance issues as needed.

## Technologies Used

- Node.js
- Express.js
- JavaScript
- MongoDB

## Contributing

If you would like to contribute to this project, feel free to fork the repository, make your changes, and submit a pull request. Please follow the guidelines in the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Sponsor Me

- By sponsoring my efforts, you're not merely contributing to the development of my projects; you're investing in its growth and sustainability.
- Your support empowers me to dedicate more time and resources to improving the project's features, addressing issues, and ensuring its continued relevance in the rapidly evolving landscape of technology.
- Your sponsorship directly fuels innovation, fosters a vibrant community, and helps maintain the project's high standards of quality. Together, we can shape the future of the projects and make a lasting impact in the open-source community.
- Thank you for considering sponsoring my work!

[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/nixrajput)

## Connect With Me

[![GitHub: nixrajput](https://img.shields.io/badge/nixrajput-EFF7F6?logo=GitHub&logoColor=333&link=https://www.github.com/nixrajput)][github]
[![Linkedin: nixrajput](https://img.shields.io/badge/nixrajput-EFF7F6?logo=LinkedIn&logoColor=blue&link=https://www.linkedin.com/in/nixrajput)][linkedin]
[![Instagram: nixrajput](https://img.shields.io/badge/nixrajput-EFF7F6?logo=Instagram&link=https://www.instagram.com/nixrajput)][instagram]
[![Twitter: nixrajput07](https://img.shields.io/badge/nixrajput-EFF7F6?logo=X&logoColor=333&link=https://x.com/nixrajput)][twitter]
[![Telegram: nixrajput](https://img.shields.io/badge/nixrajput-EFF7F6?logo=Telegram&link=https://telegram.me/nixrajput)][telegram]
[![Gmail: nkr.nikhi.nkr@gmail.com](https://img.shields.io/badge/nkr.nikhil.nkr@gmail.com-EFF7F6?logo=Gmail&link=mailto:nkr.nikhil.nkr@gmail.com)][gmail]

[github]: https://github.com/nixrajput
[twitter]: https://twitter.com/nixrajput07
[instagram]: https://instagram.com/nixrajput
[linkedin]: https://linkedin.com/in/nixrajput
[telegram]: https://telegram.me/nixrajput
[gmail]: mailto:nkr.nikhil.nkr@gmail.com

[repo]: https://github.com/nixrajput/ecommerce-api-nodejs
[issues]: https://github.com/nixrajput/ecommerce-api-nodejs/issues
[pulls]: https://github.com/nixrajput/ecommerce-api-nodejs/pulls
[license]: https://github.com/nixrajput/ecommerce-api-nodejs/blob/master/LICENSE.md
