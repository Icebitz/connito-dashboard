import Head from "next/head";

import Leaderboard from "../src/dashboard/dashboard";

export default function Home() {
  return (
    <>
      <Head><title>Connito Subnet 102 Leaderboard</title></Head>
      <Leaderboard />
    </>
  );
}
