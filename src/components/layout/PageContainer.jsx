"use client";

export default function PageContainer({ children }) {
  return (
    <div className="mx-auto w-full min-h-[360px] max-w-[1600px] rounded-xl border border-line bg-surface p-4 md:p-6">
      {children}
    </div>
  );
}
