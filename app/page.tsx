import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Personal Assistant AI</h1>
        <p className="text-xl mb-8">
          AI-powered email task extraction and approval system
        </p>
        <div className="flex gap-4">
          <Link
            href="/approvals"
            className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            View Task Approvals
          </Link>
          <Link
            href="/tasks"
            className="rounded-lg bg-secondary px-6 py-3 text-secondary-foreground hover:bg-secondary/90 transition-colors"
          >
            View My Tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
