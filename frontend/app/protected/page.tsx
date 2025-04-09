// page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server"; // Use server client here
import { redirect } from "next/navigation";
import ApiTestButtons from "../ApiTestButtons";
import { getUserRole } from "@/lib/api/users";

export default async function ProtectedPage() {
  // Use the server client to interact with Supabase auth within the server component
  const supabase = await createClient();

  // Get user AND session using the server client
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Server Component Error getting session:", sessionError);
    return <p className="text-red-500">Error retrieving session information.</p>;
  }

  if (!session) {
    console.error("Server Component: No session found, redirecting.");
    return redirect("/sign-in");
  }

  const accessToken = session.access_token; // Get the token

  let userRole: string | null = null;
  let roleError: string | null = null;

  try {
    console.log(`Fetching role for user ID: ${user.id} using server-obtained token.`);
    // Pass the access token obtained from the server session
    const roleResponse = await getUserRole(user.id, accessToken); // <-- Pass the token

    console.log("roleResponse: ", roleResponse);
    if (roleResponse && typeof roleResponse.role === "string") {
      userRole = roleResponse.role;
      console.log("Fetched user role:", userRole);
    } else {
      console.warn("User role not found or invalid in API response:", roleResponse);
      userRole = null;
    }
  } catch (error) {
    console.error("Failed to fetch user role:", error);
    roleError =
      error instanceof Error
        ? error.message
        : "An unknown error occurred while fetching your role.";
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 sm:p-4 rounded-md text-foreground flex flex-col gap-2 sm:gap-3">
          <h2 className="font-semibold text-lg">
            Welcome to the Inventory Management System
          </h2>
          <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
          {roleError ? (
            <p className="text-red-500 font-semibold">
              Error fetching role: {roleError}
            </p>
          ) : (
            <p>
              Your role:{" "}
              <span className="font-bold uppercase">
                {userRole || "No role assigned"}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Pass token to ApiTestButtons if they also make API calls */}
      {/* <ApiTestButtons authToken={accessToken} /> */}
      {/* <ApiTestButtons /> Assuming ApiTestButtons uses client-side fetching */}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!roleError && userRole === "admin" && (
          <Link href="/protected/admin" className="w-full">
            <Button variant="default" size="lg" className="w-full h-32 text-lg">
              Admin Dashboard
            </Button>
          </Link>
        )}

        {!roleError && (userRole === "manager") && (
          <Link href="/protected/manager" className="w-full">
            <Button
              variant="secondary"
              size="lg"
              className="w-full h-32 text-lg"
            >
              Manager Dashboard
            </Button>
          </Link>
        )}

        {!roleError && (userRole === "viewer") && (
          <Link href="/protected/viewer" className="w-full">
            <Button variant="outline" size="lg" className="w-full h-32 text-lg">
              Viewer Dashboard
            </Button>
          </Link>
        )}

      </div>
    </div>
  );
}
