import React, { useState } from "react";

type QuestionItem = {
  id: string;
  text: string;
  priority: "none" | "must-have" | "good-to-have";
};

type SectionQuestions = {
  section: string;
  questions: QuestionItem[];
};

const INITIAL_DATA: SectionQuestions[] = [
  {
    section: "Home Page",
    questions: [
      { id: "h1", text: "Should there be additional filters for source country?", priority: "none" },
      { id: "h2", text: "Should we mention supplier names as well apart from country?", priority: "none" },
    ],
  },
  {
    section: "Source Country Deep Dive",
    questions: [
      { id: "d1", text: "Do we need the unified cost component comparison?", priority: "none" },
      { id: "d2", text: "Can we share mapping to confirm if we got this right?", priority: "none" },
      { id: "d3", text: "Do we need all 7 components?", priority: "none" },
      { id: "d4", text: "Filter by year?", priority: "none" },
    ],
  },
  {
    section: "Trends",
    questions: [
      { id: "t1", text: "Should we show difference between the two as percentage in secondary axis?", priority: "none" },
      { id: "t2", text: "Do we need the breakdown for the Deloitte cost components as well?", priority: "none" },
    ],
  },
  {
    section: "Trends 2",
    questions: [
      { id: "t2a", text: "Enable multi select by countries?", priority: "none" },
      { id: "t2b", text: "Should there be a year / month filter here?", priority: "none" },
      { id: "t2c", text: "Is the component break up needed here?", priority: "none" },
    ],
  },
  {
    section: "Simulation",
    questions: [
      { id: "s1", text: "Can we keep it simple like this to start with?", priority: "none" },
      { id: "s2", text: "Should we enable just for the month?", priority: "none" },
      { id: "s3", text: "Year/month filter?", priority: "none" },
      { id: "s4", text: "Should we show other supplier lines as well here?", priority: "none" },
    ],
  },
];

const PRIORITY_STYLES: Record<string, string> = {
  none: "border-border bg-card/30",
  "must-have": "border-destructive/40 bg-destructive/10",
  "good-to-have": "border-success/40 bg-success/10",
};

const PRIORITY_LABELS: Record<string, string> = {
  none: "—",
  "must-have": "Must Have",
  "good-to-have": "Good to Have",
};

const StakeholderChecklist: React.FC = () => {
  const [data, setData] = useState<SectionQuestions[]>(INITIAL_DATA);
  const [isOpen, setIsOpen] = useState(true);

  const cyclePriority = (sectionIdx: number, questionIdx: number) => {
    setData((prev) => {
      const next = prev.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          questions: s.questions.map((q, qi) => {
            if (qi !== questionIdx) return q;
            const order: QuestionItem["priority"][] = ["none", "must-have", "good-to-have"];
            const currentIdx = order.indexOf(q.priority);
            return { ...q, priority: order[(currentIdx + 1) % order.length] };
          }),
        };
      });
      return next;
    });
  };

  return (
    <div className="fixed top-16 right-0 z-40 flex">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="self-start mt-4 rounded-l-md border border-r-0 border-border bg-card px-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
        style={{ writingMode: "vertical-rl" }}
      >
        {isOpen ? "Close" : "Questions"}
      </button>
      {isOpen && (
        <aside className="w-[320px] max-h-[calc(100vh-5rem)] overflow-y-auto border-l border-border bg-[#141414] p-4 shadow-xl">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Questions
          </p>
          <p className="text-[9px] italic text-muted-foreground mb-4">
            Click to cycle: — → Must Have → Good to Have
          </p>
          {data.map((section, sectionIdx) => (
            <div key={section.section} className="mb-4">
              <p className="text-[11px] font-bold text-foreground mb-1.5">{section.section}</p>
              <div className="space-y-1.5">
                {section.questions.map((q, questionIdx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => cyclePriority(sectionIdx, questionIdx)}
                    className={`w-full text-left rounded-md border px-2.5 py-1.5 transition ${PRIORITY_STYLES[q.priority]}`}
                  >
                    <p className="text-[11px] italic text-muted-foreground leading-snug">
                      {q.text}
                    </p>
                    {q.priority !== "none" && (
                      <span className={`text-[9px] font-semibold uppercase ${q.priority === "must-have" ? "text-red-400" : "text-green-400"}`}>
                        {PRIORITY_LABELS[q.priority]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
};

export default StakeholderChecklist;
