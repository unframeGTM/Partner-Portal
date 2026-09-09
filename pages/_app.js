import Head from 'next/head';
import { Poppins } from 'next/font/google';
import '../styles/globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Unframe Partner Portal</title>
        <meta name="description" content="Unframe partner portal — deal registration and pipeline visibility" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#141414" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <style jsx global>{`
        html { font-family: ${poppins.style.fontFamily}; }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
