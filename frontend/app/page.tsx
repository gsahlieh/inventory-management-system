import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  return (
    <>
      <section className="text-white flex items-center justify-center w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-4 sm:mb-6">📦</div>

            <h1 className="text-3xl sm:text-4xl text-primary font-semibold tracking-tight md:text-5xl lg:text-6xl mb-3 sm:mb-4">
              Organize Your Inventory
            </h1>

            <p className="mt-2 sm:mt-3 text-base sm:text-lg text-gray-400 md:text-xl lg:mt-5">
              Simple, efficient inventory management starts here. Sign in to
              continue or create an account.
            </p>

            <div className="mt-6 sm:mt-8 md:mt-10 flex flex-col sm:flex-row sm:justify-center space-y-3 sm:space-y-0 sm:space-x-4 text-primary">
              <Button
                asChild
                size="lg"
                variant={"outline"}
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant={"default"}
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
