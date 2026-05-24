import type { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow: string;
  title?: ReactNode;
};

export function SectionTitle({ eyebrow, title }: SectionTitleProps) {
  return (
    <div className="section-title">
      <span>{eyebrow}</span>
      {title ? <h2>{title}</h2> : null}
    </div>
  );
}
