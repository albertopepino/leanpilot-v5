import './globals.css';

export const metadata = {
  title: 'LeanPilot',
  description: 'Lean Manufacturing Made Simple',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
