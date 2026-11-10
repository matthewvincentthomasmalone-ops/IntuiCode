import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, LogOut, Plus } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: "active" | "paused" | "done";
  budget: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) {
        console.error(error);
      } else {
        setProjects(data as Project[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const total = projects.reduce((sum, p) => sum + p.budget, 0);
  const active = projects.filter((p) => p.status === "active");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="flex h-14 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" />
          Projects
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Projects</CardDescription>
              <CardTitle className="text-3xl">{projects.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl">{active.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total budget</CardDescription>
              <CardTitle className="text-3xl">${total.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">All projects</h2>
          <Button onClick={() => navigate("/projects/new")}>
            <Plus className="mr-2 h-4 w-4" /> New project
          </Button>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Card key={project.id} className="cursor-pointer hover:bg-accent" onClick={() => navigate(`/projects/${project.id}`)}>
                <CardContent className="flex items-center justify-between p-4">
                  <span className="font-medium">{project.name}</span>
                  <span className="text-sm capitalize text-muted-foreground">{project.status}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
