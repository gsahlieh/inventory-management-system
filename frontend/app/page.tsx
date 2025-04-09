import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Feature card component
const FeatureCard = ({
  icon,
  title,
  description
}: {
  icon: string;
  title: string;
  description: string;
}) => {
  return (
    <div className="flex flex-col p-6 bg-card/60 backdrop-blur-sm rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-300">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

// Role feature component
const RoleFeature = ({
  role,
  color,
  features
}: {
  role: string;
  color: string;
  features: string[];
}) => {
  return (
    <div className="flex flex-col p-6 bg-card/60 backdrop-blur-sm rounded-xl shadow-sm border border-border">
      <div className="flex items-center mb-4">
        <Badge className={`${color} mr-2 px-3 py-1`}>{role}</Badge>
        <h3 className="text-lg font-semibold">{role} Access</h3>
      </div>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Testimonial component
const Testimonial = ({
  quote,
  author,
  role
}: {
  quote: string;
  author: string;
  role: string;
}) => {
  return (
    <div className="flex flex-col p-6 bg-card/40 backdrop-blur-sm rounded-xl shadow-sm">
      <p className="italic text-lg mb-4">"{quote}"</p>
      <div className="mt-auto">
        <p className="font-semibold">{author}</p>
        <p className="text-sm text-muted-foreground">{role}</p>
      </div>
    </div>
  );
};

export default async function Home() {
  return (
    <div className="flex flex-col w-full space-y-20 pb-20 min-h-0">
      {/* Hero Section */}
      <section className="relative text-center flex flex-col items-center justify-center w-full pt-10 md:pt-20">
        <div className="container px-4 sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            Inventory Management Simplified
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="text-primary">📦</span> <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">Take Control of Your Inventory</span>
          </h1>

          <p className="max-w-3xl mx-auto text-xl text-muted-foreground mb-10">
            The complete inventory management solution with role-based access, real-time tracking,
            and intelligent insights to optimize your operations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button asChild size="lg" variant="outline" className="font-medium">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="default" className="font-medium">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>

          {/* Dashboard Preview */}
          <div className="relative mt-10 mx-auto max-w-5xl">
            <div className="bg-card/70 backdrop-blur-sm rounded-xl shadow-2xl border border-border overflow-hidden">
              <div className="bg-card p-2 border-b border-border flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="ml-4 text-xs text-muted-foreground">Inventory Dashboard</div>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-primary/5 to-secondary/20 overflow-hidden">
                <Image 
                  src="/hero-image.png"
                  alt="Dashboard Preview" 
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -bottom-6 -right-6 bg-card rounded-lg shadow-lg p-3 border border-border hidden sm:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">↑</div>
                <div>
                  <div className="text-sm font-semibold">Stock Alert</div>
                  <div className="text-xs text-muted-foreground">+15% this month</div>
                </div>
              </div>
            </div>

            <div className="absolute -top-6 -left-6 bg-card rounded-lg shadow-lg p-3 border border-border hidden sm:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">📦</div>
                <div>
                  <div className="text-sm font-semibold">128 Items</div>
                  <div className="text-xs text-muted-foreground">12 low stock</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="container px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-secondary/50 text-secondary-foreground hover:bg-secondary/60 transition-colors">
            Powerful Features
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Manage Inventory</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our comprehensive solution provides all the tools needed for efficient inventory management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔒"
            title="Role-Based Access Control"
            description="Secure your data with customized permissions for Admins, Managers, and Viewers."
          />
          <FeatureCard
            icon="📋"
            title="Complete Inventory Management"
            description="Add, edit, view, and delete inventory items with ease and precision."
          />
          <FeatureCard
            icon="📤"
            title="Bulk Operations"
            description="Update inventory quantities via bulk CSV upload to save time and reduce errors."
          />
          <FeatureCard
            icon="📊"
            title="Real-time Analytics"
            description="Visualize inventory trends and monitor stock levels with interactive charts."
          />
          <FeatureCard
            icon="🔔"
            title="Low-Stock Alerts"
            description="Get notified instantly when items fall below specified threshold levels."
          />
          <FeatureCard
            icon="📝"
            title="Comprehensive Audit Logging"
            description="Track all system actions with detailed audit logs for complete accountability."
          />
        </div>
      </section>

      {/* Role Permissions Section */}
      <section className="container px-4 bg-muted/30 py-20 -mx-4 sm:-mx-6 lg:-mx-8 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            Tailored Access Levels
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">The Right Access for Every User</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our role-based system ensures users have exactly the permissions they need.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <RoleFeature
            role="Admin"
            color="bg-blue-500/10 text-blue-500"
            features={[
              "Full CRUD operations on items",
              "Manage users and roles",
              "View complete audit logs",
              "Generate monthly reports",
              "Access all analytics"
            ]}
          />
          <RoleFeature
            role="Manager"
            color="bg-green-500/10 text-green-500"
            features={[
              "Update item quantities",
              "Bulk upload via CSV",
              "View low stock alerts",
              "Browse full inventory",
              "Access item trends"
            ]}
          />
          <RoleFeature
            role="Viewer"
            color="bg-amber-500/10 text-amber-500"
            features={[
              "Browse inventory items",
              "Search by name/category",
              "View item details",
              "See quantity history",
              "Access visualizations"
            ]}
          />
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="container px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-secondary/50 text-secondary-foreground hover:bg-secondary/60 transition-colors">
            Trusted Solution
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Businesses of all sizes trust our inventory management system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Testimonial
            quote="We've reduced inventory discrepancies by 85% since implementing this system. The role-based access ensures everyone has exactly the right permissions."
            author="Sarah Johnson"
            role="Inventory Manager, Tech Supplies Inc."
          />
          <Testimonial
            quote="The low-stock alerts have been a game changer for our business. We never run out of critical items anymore, and the audit logs give us complete visibility."
            author="Michael Chen"
            role="Operations Director, Global Retail"
          />
          <Testimonial
            quote="As an admin, I appreciate the comprehensive reporting features. The monthly PDF reports have made our board meetings so much more productive."
            author="Jessica Martinez"
            role="CEO, Logistics Experts"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4">
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 md:p-12 text-center backdrop-blur-sm">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Optimize Your Inventory?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Join thousands of businesses that have transformed their inventory management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="outline" className="font-medium">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="default" className="font-medium">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}