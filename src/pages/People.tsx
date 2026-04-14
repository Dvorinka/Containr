import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function People() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 p-5 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">People</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Manage who can access this self-hosted Containr instance.
          </p>
        </div>
        <Button variant="outline" className="gap-2" disabled>
          <Users className="h-4 w-4" />
          Invite
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/avatars/01.png" alt={user?.name || 'User'} />
                <AvatarFallback>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{user?.name || 'Current user'}</div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
              </div>
            </div>
            <Badge>Owner</Badge>
          </div>
          <div className="p-5 text-sm text-muted-foreground">
            Team invites are ready for the UI path. Project-level members already exist in the database and can be wired to invitation email later.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
