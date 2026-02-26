import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Simple hardcoded users (same as API)
const users = [
  { id: "1", name: "John Doe", email: "john@example.com" },
  { id: "2", name: "Jane Smith", email: "jane@example.com" },
];

export default function UsersPage() {
  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Simple Users Demo</h1>
            <p className="text-muted-foreground mt-2">
              Displaying hardcoded users. This demonstrates simple integration testing patterns.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>
      </div>

      {/* Simple User List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Users List
            <Badge variant="secondary">{users.length} users</Badge>
          </CardTitle>
          <CardDescription>
            Simple hardcoded user display. Data matches our `/api/simple-users` endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
                data-testid={`user-${user.id}`}>
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-muted-foreground text-sm">{user.email}</p>
                </div>
                <Badge variant="outline">ID: {user.id}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
