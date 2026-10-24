export function getDirectOpenLinkProps(url: string) {
  return { href: url, target: "_blank" as const, rel: "noopener noreferrer" };
}
