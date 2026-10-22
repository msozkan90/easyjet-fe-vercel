"use client";

export default function PageContainer({ children }) {
  return (
    <div className="min-h-[360px] w-full min-w-0 rounded-xl border border-line bg-surface p-4 md:p-6">
      {children}
    </div>
  );
}
