import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createJob } from "@/lib/actions/jobs";

export default async function AddJobPage() {
  const { userId } = await getUser();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/applications" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Job</h1>
          <p className="text-sm text-muted-foreground">
            Save a new job to your workspace.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createJob} className="space-y-4">
            <input type="hidden" name="user_id" value={userId} />
            <div className="space-y-2">
              <Label htmlFor="title">Job title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Senior Frontend Engineer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input id="company" name="company" required placeholder="e.g. Acme Technologies" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Job URL</Label>
              <Input id="url" name="url" type="url" placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="e.g. San Francisco, CA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salary">Salary range</Label>
                <Input id="salary" name="salary" placeholder="e.g. 150000-200000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Job description</Label>
              <textarea
                id="description"
                name="description"
                rows={6}
                className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Paste the job description here..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
                Cancel
              </Link>
              <button type="submit" className={buttonVariants()}>
                Save Job
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
