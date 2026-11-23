// What a `<component>.states.tsx` file exports, and how the ui-kit page draws it (ui-kit D010). A states file sits
// next to the component it shows and lists each state worth seeing: empty, filled, each role, each error the
// component can show without a server. The page renders every states file from a generated registry, so a new
// component reaches the page by the check that demands its states file, not by someone remembering to add it.
import type { ReactNode } from "react";

/** One state of a component: a short name ("owner, nothing picked") and the element showing it. */
export type UiState = { name: string; render: () => ReactNode; note?: string };
export type UiStates = UiState[];

/** A states file rendered, ready to cross from a server page into the client page. */
export type UiPageSection = { title: string; file: string; states: { name: string; note?: string; node: ReactNode }[] };

/** Renders each registry entry's states on the server, so server components can be states too. */
export function renderSections(entries: { file: string; states: UiStates }[]): UiPageSection[] {
  return entries.map(({ file, states }) => ({
    title: file.replace(/^.*\//, "").replace(/\.tsx$/, ""),
    file,
    states: states.map((s) => ({ name: s.name, note: s.note, node: s.render() })),
  }));
}

/** One labelled frame per state, at the width the component gets in the app. */
export function StateFrame({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col gap-1">
      <figcaption className="text-sm text-text-muted">
        {name}
        {note ? ` — ${note}` : ""}
      </figcaption>
      <div className="rounded-md border border-dashed border-border bg-background p-3">{children}</div>
    </figure>
  );
}

export function UiPageSections({ sections }: { sections: UiPageSection[] }) {
  return sections.map((section) => (
    <section key={section.file} id={section.title} className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
      <h2 className="m-0 text-lg">
        {section.title} <span className="text-sm font-normal text-text-muted">{section.file}</span>
      </h2>
      {section.states.map((s) => (
        <StateFrame key={s.name} name={s.name} note={s.note}>
          {s.node}
        </StateFrame>
      ))}
    </section>
  ));
}
