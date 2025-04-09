import Link from 'next/link'; // Import Link for navigation if needed
import { Button } from '@/components/ui/button';

export default async function Home() {
  return (
    <>
      <section className="text-white flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl sm:text-7xl md:text-8xl mb-6">📦</div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl mb-4">
              Organize Your Inventory
            </h1>

            <p className="mt-3 text-lg text-gray-400 sm:mt-5 sm:text-xl md:mt-5">
              Simple, efficient inventory management starts here. Sign in to
              continue or create an account.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Button
                asChild
                size="lg"
                variant={"outline"}
                className="opacity-75 cursor-none pointer-events-none"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant={"default"}
                className="opacity-75 cursor-none pointer-events-none"
              >
                <Link href="/sign-up">Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
