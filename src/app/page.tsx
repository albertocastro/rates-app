import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { hasCompletedOnboarding } from "@/lib/actions/onboarding";

export default async function HomePage() {
  const session = await auth();

  // If user is logged in and onboarded, redirect to status
  if (session?.user) {
    const onboarded = await hasCompletedOnboarding();
    if (onboarded) {
      redirect("/status");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section - Cow themed black & white */}
      <section className="relative overflow-hidden bg-black text-white">
        {/* Cow spots pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-sm" />
          <div className="absolute top-40 right-20 w-48 h-48 bg-white rounded-full blur-sm" />
          <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-white rounded-full blur-sm" />
          <div className="absolute bottom-40 right-1/3 w-24 h-24 bg-white rounded-full blur-sm" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="text-6xl mb-6">🐄</div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Never Miss the Right Time
              <br />
              <span className="text-gray-400">to Refinance</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10">
              Popis Interest Rates monitors mortgage benchmark rates and alerts you when
              conditions match your criteria. Set it once, then wait for the
              perfect moment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login">
                <Button size="lg" variant="white" className="px-8">
                  Get Started Free
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-white border border-white/30 hover:bg-white/10"
                >
                  Learn More
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three simple steps to automated refinance monitoring
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Enter Your Loan Details
              </h3>
              <p className="text-gray-600">
                Tell us about your current mortgage: balance, rate, and remaining
                term. Plus your expected time in the home.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Set Your Thresholds
              </h3>
              <p className="text-gray-600">
                Define when to alert you: target benchmark rate, break-even
                period, or both. You control the criteria.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Receive Your Alert
              </h3>
              <p className="text-gray-600">
                We monitor rates daily and email you when your criteria are met.
                No spam, just one timely notification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Source */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Powered by Official Data
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              We use the{" "}
              <strong>Optimal Blue 30-Year Fixed Rate Mortgage Index</strong>{" "}
              from the Federal Reserve Economic Data (FRED) system. This
              benchmark updates daily on weekdays and reflects actual lender
              pricing.
            </p>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="grid sm:grid-cols-2 gap-6 text-left">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Data Source</h4>
                  <p className="text-gray-600">
                    FRED (Federal Reserve Economic Data)
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Update Frequency</h4>
                  <p className="text-gray-600">Daily (weekdays)</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Series</h4>
                  <p className="text-gray-600">OBMMIC30YF</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Check Cadence</h4>
                  <p className="text-gray-600">Daily at 7 AM UTC</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-5xl mb-6">🐄</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Start Monitoring Today
          </h2>
          <p className="text-xl text-gray-300 mb-10">
            Set up your refinance alert in under 2 minutes. It's free.
          </p>
          <Link href="/login">
            <Button size="lg" variant="white" className="px-8">
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-2xl">🐄</span>
              <span className="text-white font-semibold">Popis Interest Rates</span>
            </div>
            <p className="text-sm">
              Popis Interest Rates uses benchmark rate data as a proxy for refinance
              rates. Actual rates will vary by lender and your credit profile.
              This is not financial advice.
            </p>
            <p className="text-sm mt-4">
              Data source: Optimal Blue Mortgage Market Indices via FRED
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
