import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function BaseIcon({ title, children, ...props }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconMenu(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </BaseIcon>
  );
}

export function IconClose(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </BaseIcon>
  );
}

export function IconDashboard(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 13.5V20h6v-6.5H4Z" />
      <path d="M14 4v6h6V4h-6Z" />
      <path d="M14 14h6v6h-6v-6Z" />
      <path d="M4 4h6v6H4V4Z" />
    </BaseIcon>
  );
}

export function IconCustomers(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M4 20c1.2-3.6 4.3-6 8-6s6.8 2.4 8 6" />
    </BaseIcon>
  );
}

export function IconInvoices(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V5a2 2 0 0 1 2-2Z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </BaseIcon>
  );
}

export function IconPayments(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M3 7h18v10H3V7Z" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </BaseIcon>
  );
}

export function IconCommissions(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 18V6" />
      <path d="M4 18h16" />
      <path d="M7 14l3-3 3 2 6-7" />
    </BaseIcon>
  );
}

export function IconProjects(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M12 2l9 5-9 5-9-5 9-5Z" />
      <path d="M21 7v10l-9 5-9-5V7" />
      <path d="M12 12v10" />
    </BaseIcon>
  );
}

export function IconSales(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M6 6h15l-2 8H7L6 6Z" />
      <path d="M6 6l-2-3H2" />
      <path d="M7 18a1.5 1.5 0 1 0 0 .01" />
      <path d="M18 18a1.5 1.5 0 1 0 0 .01" />
    </BaseIcon>
  );
}

export function IconExpenses(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </BaseIcon>
  );
}

export function IconCash(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M3 7h18v10H3V7Z" />
      <path d="M7 11h0.01" />
      <path d="M17 13h0.01" />
      <path d="M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </BaseIcon>
  );
}

export function IconReports(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 17v-6" />
      <path d="M12 17v-9" />
      <path d="M16 17v-4" />
    </BaseIcon>
  );
}

export function IconMasterData(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a7.7 7.7 0 0 0 .1-1l2-1.2-2-3.5-2.3.6a7.8 7.8 0 0 0-1.7-1L15 6h-6l-.5 2.9a7.8 7.8 0 0 0-1.7 1l-2.3-.6-2 3.5 2 1.2a7.7 7.7 0 0 0 .1 1 7.7 7.7 0 0 0-.1 1l-2 1.2 2 3.5 2.3-.6a7.8 7.8 0 0 0 1.7 1L9 21h6l.5-2.9a7.8 7.8 0 0 0 1.7-1l2.3.6 2-3.5-2-1.2a7.7 7.7 0 0 0-.1-1Z" />
    </BaseIcon>
  );
}

export function IconMessaging(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 2-4v-6a8 8 0 0 1 16 0Z" />
      <path d="M8 12h8" />
      <path d="M8 8h5" />
    </BaseIcon>
  );
}

export function IconLogout(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M10 17l1 3h9V4h-9l-1 3" />
      <path d="M3 12h11" />
      <path d="M7 8l-4 4 4 4" />
    </BaseIcon>
  );
}

export function IconUsers(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M2.5 20c1.1-3.3 4-5.5 7.5-5.5" />
      <path d="M14.5 14.5c3.5 0 6.4 2.2 7.5 5.5" />
      <path d="M19 7.5a2.5 2.5 0 1 0-5 0" />
    </BaseIcon>
  );
}

export function IconHelp(props: IconProps): JSX.Element {
  return (
    <BaseIcon {...props}>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
      <path d="M12 17h0.01" />
    </BaseIcon>
  );
}
