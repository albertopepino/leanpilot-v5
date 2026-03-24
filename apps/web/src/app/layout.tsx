import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'LeanPilot',
  description: 'Lean Manufacturing Made Simple',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
