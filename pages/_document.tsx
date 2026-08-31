import { Head, Html, Main, NextScript } from "next/document";

import { CONNITO_LOGO_URL } from "../src/dashboard/brand";

export default function Document() {
  return (
    <Html lang="en" data-theme="dark">
      <Head>
        <meta name="description" content="Real-time Bittensor subnet 102 leaderboard dashboard." />
        <link rel="icon" href={CONNITO_LOGO_URL} />
        <link rel="shortcut icon" href={CONNITO_LOGO_URL} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
