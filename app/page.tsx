import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Personal Assistant AI</h1>
        <p className="text-xl mb-8">
          AI-powered email task extraction, approval, and follow-up system
        </p>

        {/* Primary Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Link
            href="/review"
            className="rounded-lg bg-foreground px-6 py-3 text-background hover:bg-foreground/90 transition-colors font-medium"
          >
            Review Queue
          </Link>
          <Link
            href="/tasks"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
          >
            My Tasks
          </Link>
          <Link
            href="/waiting-on"
            className="rounded-lg bg-yellow-500 px-6 py-3 text-black hover:bg-yellow-600 transition-colors"
          >
            Waiting On
          </Link>
          <Link
            href="/briefs"
            className="rounded-lg bg-purple-600 px-6 py-3 text-white hover:bg-purple-700 transition-colors"
          >
            Daily Briefs
          </Link>
        </div>

        {/* Secondary Links */}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/settings"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/approvals"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Task Approvals (Legacy)
          </Link>
        </div>
      </div>
    </div>
  );
}
