import './globals.css';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const comfortaa = localFont({
  src: [
    {
      path: '../assets/fonts/comfortaa-400.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/comfortaa-500.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/comfortaa-700.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata = {
  title: 'LeanPilot',
  description: 'Lean Manufacturing Made Simple',
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${comfortaa.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
