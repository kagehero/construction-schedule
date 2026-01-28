import type { ReactNode } from "react";
import { clsx } from "clsx";

interface CardProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, actions, children, className }: CardProps) {
  return (
    <section
      className={clsx(
        "rounded-xl bg-cardBg border border-slate-800 shadow-sm",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}


