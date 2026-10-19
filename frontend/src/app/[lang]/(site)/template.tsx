/** Re-mounted on every navigation inside the public site, so each page fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
